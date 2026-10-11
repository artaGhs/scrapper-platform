import { MAX_ITEMS } from "./config";
import type { Business, Opportunity, SourceItem, Source } from "./types";

const categories = [
  {
    name: "Food & calorie tracking",
    triggers: /calorie|nutrition|food photo|meal photo/i,
    terms: ["calorie", "food", "meal", "nutrition"],
    features: ["photo", "picture", "camera", "ingredient", "logging", "manual"],
    queries: [
      "calorie app photo",
      "food tracking manual logging",
      "meal picture calories",
    ],
  },
  {
    name: "Shopify & email marketing",
    triggers: /shopify|discount|abandoned cart/i,
    terms: ["shopify", "store", "discount", "email"],
    features: [
      "code",
      "cart",
      "personalized",
      "unique",
      "automatic",
      "welcome",
    ],
    queries: [
      "Shopify unique discount code",
      "Shopify email discount app",
      "personalized discount tool",
    ],
  },
  {
    name: "Website uptime monitoring",
    triggers: /uptime|downtime|monitor.*website|website.*monitor/i,
    terms: ["website", "site", "uptime", "downtime"],
    features: ["alert", "notification", "monitor", "down", "offline", "slack"],
    queries: [
      "website uptime monitor",
      "site down Slack alert",
      "uptime monitoring alternative",
    ],
  },
];
const stop = new Set(
  "this that with from your have when where which there their about people business offers offer product users want need helps help using make without every into simple reduce service we our the and for app tool software".split(
    " ",
  ),
);
function words(value: string): string[] {
  return [
    ...new Set(
      (value.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) || []).filter(
        (word) => !stop.has(word),
      ),
    ),
  ];
}
export function interpret(description: string): Business {
  const category = categories.find((item) => item.triggers.test(description));
  // Only query features stated in the input. This is a disclosed lexical strategy, not an LLM.
  if (category) {
    const featureTerms = category.features.filter((term) =>
      description.toLowerCase().includes(term),
    );
    const terms = category.terms.filter((term) =>
      description.toLowerCase().includes(term),
    );
    const subject = terms.length ? terms : [category.terms[0]];
    const queries = featureTerms.length
      ? [
          ...new Set(
            featureTerms.slice(0, 3).map((term) => `${subject[0]} ${term} app`),
          ),
        ]
      : [
          `${subject.join(" ")} tool`,
          `${subject[0]} recommendation`,
          `${subject[0]} alternative`,
        ];
    return {
      category: category.name,
      summary: description,
      terms: subject,
      featureTerms,
      queries,
    };
  }
  const terms = words(description).slice(0, 8);
  const subject = terms.slice(0, 3).join(" ");
  return {
    category: "Your described business",
    summary: description,
    terms,
    featureTerms: [],
    queries: [
      `${subject} tool`,
      `${subject} recommendation`,
      `${subject} alternative`,
    ],
  };
}

export function originalUrl(
  value: unknown,
  source: Source = "reddit",
): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (source === "x") {
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        !["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(
          url.hostname,
        ) ||
        !/^\/(?:[a-z0-9_]{1,15}|i\/web)\/status\/\d+\/?$/i.test(url.pathname)
      )
        return null;
      url.hostname = "x.com";
      url.search = "";
      url.hash = "";
      return url.toString();
    }
    if (
      url.protocol !== "https:" ||
      !["reddit.com", "www.reddit.com", "old.reddit.com"].includes(
        url.hostname,
      ) ||
      url.username ||
      url.password
    )
      return null;
    if (!/^\/r\/[\w]+\/comments\/[a-z0-9]+(?:\/|$)/i.test(url.pathname))
      return null;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
function publication(value: unknown): string | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const ms =
    typeof value === "number"
      ? value < 1e12
        ? value * 1000
        : value
      : Date.parse(value);
  if (!Number.isFinite(ms) || ms <= 0 || ms > Date.now() + 5 * 60_000)
    return null;
  return new Date(ms).toISOString();
}
export function isDiscussionRecord(
  record: unknown,
  source: Source = "reddit",
): boolean {
  if (!record || typeof record !== "object") return false;
  const row = record as Record<string, unknown>;
  if (source === "x")
    return (
      (!row.type || row.type === "tweet") &&
      !!originalUrl(row.url, "x") &&
      typeof row.text === "string" &&
      row.text.trim().length > 0 &&
      row.isRetweet !== true
    );
  if (
    typeof row.dataType === "string" &&
    !["post", "comment"].includes(row.dataType)
  )
    return false;
  return (
    !!originalUrl(row.url) &&
    [row.title, row.body, row.text].some(
      (value) =>
        typeof value === "string" &&
        value.trim().length > 0 &&
        !["[removed]", "[deleted]"].includes(value),
    )
  );
}
export function normalize(
  records: unknown[],
  now = Date.now(),
  source: Source = "reddit",
): SourceItem[] {
  const seen = new Set<string>();
  const texts = new Set<string>();
  const output: SourceItem[] = [];
  for (const record of records.slice(0, MAX_ITEMS)) {
    if (!isDiscussionRecord(record, source)) continue;
    const row = record as Record<string, unknown>;
    const url = originalUrl(row.url, source);
    const title = typeof row.title === "string" ? row.title.slice(0, 300) : "";
    const text =
      typeof row.body === "string"
        ? row.body.slice(0, 4000)
        : typeof row.text === "string"
          ? row.text.slice(0, 4000)
          : "";
    if (!url || (!text && !title)) continue;
    const combined = `${title} ${text}`.toLowerCase().replace(/[^a-z0-9]/g, "");
    // One entry per discussion; multiple comments in one thread cannot dominate the list.
    const thread =
      source === "x"
        ? url.match(/\/status\/(\d+)/)?.[1] || url
        : url.match(/\/comments\/([a-z0-9]+)/i)?.[1] || url;
    if (seen.has(thread) || texts.has(combined)) continue;
    const publishedAt = publication(row.createdAt ?? row.created_utc);
    if (publishedAt && now - Date.parse(publishedAt) > 30 * 86400_000) continue;
    if (text === "[deleted]" || text === "[removed]") continue;
    seen.add(thread);
    texts.add(combined);
    output.push({
      source,
      id: `${source}:${thread}`,
      url,
      title,
      text,
      community:
        typeof row.communityName === "string"
          ? row.communityName.slice(0, 100)
          : typeof row.subreddit === "string"
            ? `r/${row.subreddit.slice(0, 80)}`
            : null,
      publishedAt,
      synthetic: false,
    });
  }
  return output;
}
const request =
  /\b(?:is there|are there|anyone (?:know|recommend|using)|can (?:anyone|someone)|looking for|recommend(?:ation|ations)?|suggest(?:ion|ions)?|alternative(?:s)?|need (?:an?|some|help)|how (?:do|can) I|what (?:app|tool)|wish there|tired of|takes too long|struggling with)\b/i;
export function rank(
  items: SourceItem[],
  business: Business,
  now = Date.now(),
): Opportunity[] {
  const results: Opportunity[] = [];
  for (const item of items) {
    const content = `${item.title}. ${item.text}`;
    const lowered = content.toLowerCase();
    const evidence = content
      .split(/(?<=[.!?])\s+/)
      .find((sentence) => request.test(sentence));
    if (
      !evidence ||
      /\b(?:use my|try my|i built|we launched|sponsored|affiliate link)\b/i.test(
        content,
      )
    )
      continue;
    const terms = business.terms.filter((term) =>
      new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(
        content,
      ),
    );
    const features = business.featureTerms.filter((term) =>
      lowered.includes(term),
    );
    if (!terms.length || (business.featureTerms.length && !features.length))
      continue;
    if (
      !business.featureTerms.length &&
      business.category === "Your described business" &&
      terms.length < 2
    )
      continue;
    const fit = business.featureTerms.length
      ? 0.7 + Math.min(0.3, features.length * 0.1)
      : Math.min(1, terms.length / 2);
    const ageDays = item.publishedAt
      ? Math.max(0, (now - Date.parse(item.publishedAt)) / 86400_000)
      : null;
    const freshness = ageDays === null ? 0 : Math.max(0, 1 - ageDays / 30);
    const specificity = Math.min(1, (terms.length + features.length) / 4);
    results.push({
      ...item,
      evidence: evidence.trim().slice(0, 700),
      reason: `This request mentions ${[...terms, ...features].slice(0, 3).join(", ")}—details that overlap with your description. ${item.synthetic ? "This fictional request illustrates the matching rule." : "Review the original context to confirm the fit."}`,
      need: /alternative|instead of|switch from/i.test(content)
        ? "Alternative request"
        : "Solution request",
      score: Math.round(
        100 * (0.4 * fit + 0.35 + 0.15 * freshness + 0.1 * specificity),
      ),
      saved: false,
      irrelevant: false,
    });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 10);
}
