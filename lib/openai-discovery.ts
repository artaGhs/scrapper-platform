import { z } from "zod";
import { AppError } from "./config";
import { PROBLEM_DISCOVERY_PROMPT } from "./openai-prompt";
import type { Opportunity } from "./types";

const cleanCitation = (value: string) =>
  value.replace(/\s*\(?\[[^\]]+\]\(https:\/\/[^)]+\)\)?/g, "").trim();

const matchSchema = z.object({
  url: z.string(),
  title: z.string().max(300),
  kind: z.enum(["post", "comment"]),
  publishedAt: z.string().nullable(),
  evidence: z.string().min(10).max(1500),
  authorRole: z.enum(["affected_person", "vendor", "researcher", "unknown"]),
  need: z.string().max(1000),
  fitReason: z.string().max(1500),
});
const resultSchema = z.object({
  businessInterpretation: z.string(),
  matches: z.array(matchSchema).max(10),
  limitations: z.array(z.string()),
});

export function redditRecord(value: string) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["reddit.com", "www.reddit.com", "old.reddit.com"].includes(
        url.hostname,
      ) ||
      url.username ||
      url.password
    )
      return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (
      parts[0] !== "r" ||
      parts[2] !== "comments" ||
      !/^[a-z0-9]+$/i.test(parts[3] || "") ||
      parts.length < 4 ||
      parts.length > 6
    )
      return null;
    if (parts.length === 6 && !/^[a-z0-9]+$/i.test(parts[5])) return null;
    return {
      key: `${parts[3].toLowerCase()}:${parts[5]?.toLowerCase() || "post"}`,
      thread: parts[3].toLowerCase(),
      community: `r/${parts[1]}`,
      kind: parts.length === 6 ? ("comment" as const) : ("post" as const),
      url: `https://www.reddit.com${url.pathname}`,
    };
  } catch {
    return null;
  }
}

export function parseDiscovery(body: Record<string, unknown>) {
  if (body.status !== "completed" || !Array.isArray(body.output))
    throw new AppError(
      "The search could not finish. Please try again later.",
      502,
    );
  const output = body.output as {
    type: string;
    action?: { sources?: { url: string }[] };
    content?: {
      type: string;
      text?: string;
      annotations?: { url?: string }[];
    }[];
  }[];
  const sources = new Map<
    string,
    NonNullable<ReturnType<typeof redditRecord>>
  >();
  for (const item of output) {
    const urls = [
      ...(item.action?.sources || []).map((s) => s.url),
      ...(item.content || []).flatMap((c) =>
        (c.annotations || []).map((a) => a.url || ""),
      ),
    ];
    for (const url of urls) {
      const record = redditRecord(url);
      if (record) sources.set(record.key, record);
    }
  }
  const text = output
    .flatMap((i) => i.content || [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text || "")
    .join("");
  const result = resultSchema.parse(JSON.parse(text));
  const seen = new Set<string>();
  const opportunities: Opportunity[] = [];
  for (const match of result.matches) {
    if (match.authorRole !== "affected_person") continue;
    // Catch explicit role/fit contradictions found during the source audit.
    // This does not require product vocabulary or a request-shaped sentence.
    if (
      /^partial fit\b/i.test(match.fitReason.trim()) ||
      (match.kind === "post" &&
        /\b(?:we|i)\s+(?:built|launched)\s+(?:a|an|our|my)\b/i.test(
          match.title,
        )) ||
      /\b(?:i['’]m|i am|we['’]re|we are) researching\b/i.test(match.evidence)
    )
      continue;
    const record = redditRecord(match.url);
    const source = record && sources.get(record.key);
    if (!source || source.kind !== match.kind || seen.has(source.key)) continue;
    seen.add(source.key);
    opportunities.push({
      id: source.key,
      source: "reddit",
      kind: source.kind,
      title: match.title,
      text: cleanCitation(match.evidence),
      evidence: cleanCitation(match.evidence),
      url: source.url,
      community: source.community,
      // Exact dates from generated summaries were unreliable in the baseline.
      publishedAt: null,
      synthetic: false,
      reason: cleanCitation(match.fitReason),
      need: "Problem context",
      score: 90 - opportunities.length,
      saved: false,
      irrelevant: false,
      reviewMethod: "OpenAI assessment",
    });
  }
  return {
    summary: result.businessInterpretation,
    results: opportunities,
    retrieved: sources.size,
  };
}

async function discoverAngle(
  description: string,
  key: string,
  fetcher: typeof fetch,
  angle: string,
) {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["businessInterpretation", "matches", "limitations"],
    properties: {
      businessInterpretation: { type: "string" },
      matches: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "url",
            "title",
            "kind",
            "publishedAt",
            "evidence",
            "need",
            "fitReason",
            "authorRole",
          ],
          properties: {
            url: { type: "string" },
            title: { type: "string" },
            kind: { type: "string", enum: ["post", "comment"] },
            publishedAt: { type: ["string", "null"] },
            evidence: { type: "string" },
            need: { type: "string" },
            fitReason: { type: "string" },
            authorRole: {
              type: "string",
              enum: ["affected_person", "vendor", "researcher", "unknown"],
            },
          },
        },
      },
      limitations: { type: "array", items: { type: "string" } },
    },
  };
  const response = await fetcher("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(110_000),
    cache: "no-store",
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      store: false,
      reasoning: { effort: "medium" },
      max_tool_calls: 3,
      max_output_tokens: 8000,
      tools: [
        {
          type: "web_search",
          filters: { allowed_domains: ["reddit.com"] },
          search_context_size: "low",
        },
      ],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      instructions:
        PROBLEM_DISCOVERY_PROMPT +
        "\nSearch emphasis for this independent discovery pass: " +
        angle,
      input: JSON.stringify({
        businessDescription: description,
        currentDate: new Date().toISOString().slice(0, 10),
      }),
      text: {
        format: {
          type: "json_schema",
          name: "reddit_opportunities",
          strict: true,
          schema,
        },
      },
    }),
  });
  if (!response.ok)
    throw new AppError(
      "Reddit search is temporarily unavailable. Please try again later.",
      502,
      [400, 401, 403, 429].includes(response.status),
    );
  const body = await response.json();
  const parsed = parseDiscovery(body);
  const usage = body.usage || {};
  const cached = Number(usage.input_tokens_details?.cached_tokens || 0);
  const searches = body.output.filter(
    (o: { type: string; action?: { type: string } }) =>
      o.type === "web_search_call" && o.action?.type === "search",
  ).length;
  const estimatedUsd =
    searches * 0.01 +
    ((Number(usage.input_tokens || 0) - cached) * 0.75) / 1e6 +
    (cached * 0.075) / 1e6 +
    (Number(usage.output_tokens || 0) * 4.5) / 1e6;
  return { ...parsed, estimatedUsd };
}

export async function discoverReddit(
  description: string,
  key: string,
  fetcher: typeof fetch = fetch,
) {
  const passes = await Promise.allSettled([
    discoverAngle(
      description,
      key,
      fetcher,
      "Indirect first-person symptoms, consequences and manual workarounds. Infer language from this business, and search across communities.",
    ),
    discoverAngle(
      description,
      key,
      fetcher,
      "Direct requests, alternatives and unmet needs, including specific comments when accessible. Infer varied queries from this business, and search across communities.",
    ),
  ]);
  const successful = passes.flatMap((pass) =>
    pass.status === "fulfilled" ? [pass.value] : [],
  );
  if (!successful.length)
    throw new AppError(
      "The search could not finish. Please try again later.",
      502,
      passes.every(
        (pass) =>
          pass.status === "rejected" &&
          pass.reason instanceof AppError &&
          pass.reason.noJobStarted,
      ),
    );
  const seen = new Set<string>();
  const results = successful
    .flatMap((pass) => pass.results)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, 10);
  return {
    summary: successful[0].summary,
    results,
    retrieved: results.length,
    estimatedUsd: successful.reduce((sum, pass) => sum + pass.estimatedUsd, 0),
    partial: successful.length !== passes.length,
  };
}
