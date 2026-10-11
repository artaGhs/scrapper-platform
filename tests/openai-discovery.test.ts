import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverReddit, parseDiscovery } from "../lib/openai-discovery";
import { advance } from "../lib/service";
import { ScanStore } from "../lib/sqlite-store";
import { randomUUID } from "node:crypto";
import { publicScan } from "../lib/types";

const url =
  "https://www.reddit.com/r/webhosting/comments/abc123/client_outage/";
const match = {
  authorRole: "affected_person",
  url,
  title: "A client found the outage first",
  kind: "post",
  publishedAt: "2026-10-01",
  evidence: "My client told me the checkout had been down all morning.",
  need: "Undetected client-site outage",
  fitReason:
    "A downtime alert could let the owner respond before the client reports it; no purchase intent is established.",
};
function response(matches: unknown[] = [match]) {
  return {
    status: "completed",
    output: [
      {
        type: "web_search_call",
        action: { type: "search", sources: [{ url }] },
      },
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify({
              businessInterpretation: "Client-site outage alerts",
              matches,
              limitations: [],
            }),
          },
        ],
      },
    ],
    usage: { input_tokens: 1000, output_tokens: 500 },
  };
}

test("problem accounts without category keywords or requests survive without keyword screening", () => {
  const result = parseDiscovery(response());
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].need, "Problem context");
  assert.equal(result.results[0].publishedAt, null);
  assert.equal(result.results[0].synthetic, false);
});
test("source gating rejects invented permalinks, mislabeled comments and duplicate threads", () => {
  const result = parseDiscovery(
    response([
      match,
      {
        ...match,
        url: "https://www.reddit.com/r/webhosting/comments/invented/test/",
      },
      { ...match, kind: "comment" },
      { ...match, url: url.replace("client_outage", "different_slug") },
    ]),
  );
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].url, url);
});
test("incomplete responses are failures, not empty searches", () => {
  assert.throws(() => parseDiscovery({ ...response(), status: "incomplete" }));
});
test("two bounded parallel OpenAI requests uses medium reasoning, broad discovery and source validation", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (_url, init) => {
    calls++;
    const request = JSON.parse(init!.body as string);
    assert.equal(request.model, "gpt-5.4-mini");
    assert.equal(request.reasoning.effort, "medium");
    assert.equal(request.store, false);
    assert.equal(request.max_tool_calls, 3);
    assert.deepEqual(request.tools[0].filters.allowed_domains, ["reddit.com"]);
    assert.match(request.instructions, /Do not require product keywords/);
    assert.match(request.instructions, /specific comment permalink/);
    return Response.json(response());
  };
  const result = await discoverReddit(
    "We alert owners when client sites go down",
    "test-key",
    fetcher,
  );
  assert.equal(calls, 2);
  assert.equal(result.results.length, 1);
  assert.ok(result.estimatedUsd > 0);
});
test("provider rejection stops both independent passes without retries or falls back to paid scraping", async () => {
  let calls = 0;
  await assert.rejects(
    discoverReddit("Client site alerts", "test-key", async () => {
      calls++;
      return Response.json({}, { status: 429 });
    }),
  );
  assert.equal(calls, 2);
});

test("durable OpenAI scan consumes its allowance once and skips Gemini, Apify and keyword screening", async () => {
  const previous = process.env.OPENAI_API_KEY;
  const originalFetch = globalThis.fetch;
  const db = new ScanStore(":memory:");
  let calls = 0;
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "https://api.openai.com/v1/responses");
    calls++;
    const matches = Array.from({ length: 7 }, (_, index) => ({
      ...match,
      url: `https://www.reddit.com/r/webhosting/comments/abc${index}/problem/`,
    }));
    const body = response(matches);
    body.output[0] = {
      type: "web_search_call",
      action: {
        type: "search",
        sources: matches.map((item) => ({ url: item.url })),
      },
    };
    return Response.json(body);
  };
  try {
    let scan = db.create(
      "owner",
      randomUUID(),
      "We alert owners when client sites go down",
      "live",
      0.12,
      2,
      ["reddit"],
      { free: true, ipHash: "test", dailyBudget: 2 },
    );
    scan = await advance(scan.id, "owner", db);
    assert.equal(scan.discoveryEngine, "openai");
    assert.equal(db.allowance("owner").used, false);
    scan = await advance(scan.id, "owner", db);
    assert.equal(scan.results.length, 7);
    assert.equal(db.allowance("owner").used, true);
    scan = await advance(scan.id, "owner", db);
    assert.equal(scan.stage, "complete");
    scan.results = Array.from({ length: 10 }, (_, index) => ({
      ...scan.results[0],
      id: `record-${index}`,
      title: `private-match-${index}`,
    }));
    const preview = publicScan(scan);
    assert.equal(preview.results.length, 3);
    assert.equal(preview.matchCount, 10);
    assert.equal(preview.lockedCount, 7);
    assert.ok(!JSON.stringify(preview).includes("private-match-9"));
    scan.developer = true;
    assert.equal(publicScan(scan).results.length, 10);
    assert.equal(publicScan(scan).lockedCount, 0);
    await advance(scan.id, "owner", db);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
});

test("explicit seller roles, market research and unsupported partial fit cannot fill the target count", () => {
  for (const candidate of [
    { ...match, authorRole: "researcher" },
    { ...match, authorRole: "vendor" },
    { ...match, title: "We built a micro SaaS that detects downtime" },
    {
      ...match,
      evidence:
        "I’m researching a problem that small business owners might have.",
    },
    {
      ...match,
      fitReason:
        "Partial fit. This requires detecting broken checkout workflows.",
    },
  ])
    assert.equal(parseDiscovery(response([candidate])).results.length, 0);
});
