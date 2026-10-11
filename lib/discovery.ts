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
  "this that with from your have when where which there their about people business offers offer product users want need helps help using make without every into simple reduce service we our the and for app tool software sends send provides provide enables enable lets let allows allow platform teams team quickly small automatically".split(
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
  const terms = category
    ? category.terms.filter((term) => description.toLowerCase().includes(term))
    : words(description).slice(0, 8);
  const featureTerms = category
    ? category.features.filter((term) =>
        description.toLowerCase().includes(term),
      )
    : [];
  const phrase =
    category?.name === "Food & calorie tracking"
      ? /calorie/i.test(description)
        ? "calorie tracking"
        : "nutrition tracking"
      : category?.name === "Shopify & email marketing"
        ? /discount/i.test(description)
          ? "Shopify discount"
          : /cart/i.test(description)
            ? "Shopify cart"
            : "Shopify app"
        : category?.name === "Website uptime monitoring"
          ? "uptime monitor"
          : terms.slice(0, 3).join(" ");
  // Broad searches always run alongside a preferred-community query, in one
  // bounded job. Global queries come first so a narrow community cannot be
  // the only source of candidates. Requests are qualified after retrieval.
  const communities =
    category?.name === "Food & calorie tracking"
      ? ["caloriecount", "loseit"]
      : category?.name === "Shopify & email marketing"
        ? ["shopify"]
        : category?.name === "Website uptime monitoring"
          ? ["selfhosted", "webdev", "sysadmin"]
          : [];
  const preferred = communities.map((name) => `subreddit:${name}`).join(" OR ");
  const queryPlans: NonNullable<Business["queryPlans"]> =
    category?.name === "Website uptime monitoring"
      ? [
          {
            phrase:
              "(website OR site) AND (down OR offline OR outage OR unavailable) AND (alert OR notification OR monitor OR notice OR notified OR customers OR missed)",
            signal: "problem",
            rationale:
              "Across Reddit: missed outages and website-down notification problems, without requiring the phrase uptime monitor.",
          },
          {
            phrase: "uptime AND (monitor OR monitoring OR alerts)",
            signal: "recommendation",
            rationale:
              "Across Reddit: category keywords and variants; actual needs are checked in the returned context.",
          },
          {
            phrase: `(uptime OR downtime OR "website down") AND (${preferred})`,
            signal: "problem",
            rationale:
              "An additional focused search in preferred communities; it does not restrict the broader searches.",
          },
        ]
      : category?.name === "Food & calorie tracking"
        ? [
            {
              phrase:
                '(calorie OR calories OR food OR meals) AND (tracking OR logging OR counting) AND (hard OR difficult OR struggling OR tedious OR "how do" OR "how can")',
              signal: "problem",
              rationale:
                "Across Reddit: ordinary tracking questions and friction without requiring app or buying language.",
            },
            {
              phrase: featureTerms.some((term) =>
                ["photo", "picture", "camera"].includes(term),
              )
                ? "(food OR meal) AND (photo OR picture) AND (logging OR tracking OR calories)"
                : "(food OR meal) AND (logging OR tracking) AND (app OR tool)",
              signal: "recommendation",
              rationale:
                "Across Reddit: stated food-logging capabilities and everyday wording.",
            },
            {
              phrase: `("calorie tracking" OR "calorie counting") AND app AND (${preferred})`,
              signal: "recommendation",
              rationale:
                "An additional focused calorie-app search in preferred communities.",
            },
          ]
        : category?.name === "Shopify & email marketing"
          ? [
              {
                phrase:
                  '(Shopify OR ecommerce) AND (discount OR "welcome email") AND (manual OR automate OR unique OR help)',
                signal: "problem",
                rationale:
                  "Across Reddit: discount and welcome-email workflow friction, beyond r/shopify.",
              },
              {
                phrase:
                  "Shopify AND (discount OR email OR cart) AND (app OR tool OR alternative)",
                signal: "recommendation",
                rationale:
                  "Across Reddit: related product categories and replacement discussions.",
              },
              {
                phrase: `Shopify AND (discount OR email OR cart) AND (${preferred})`,
                signal: "recommendation",
                rationale:
                  "An additional focused Shopify search in its preferred community.",
              },
            ]
          : [
              {
                phrase:
                  terms.length > 1
                    ? `${terms[0]} AND (${terms.slice(1, 4).join(" OR ")})`
                    : phrase,
                signal: "recommendation",
                rationale:
                  "Across Reddit: separate business keywords rather than one exact quoted phrase.",
              },
              {
                phrase: `(${terms.slice(0, 4).join(" OR ")}) AND (problem OR struggling OR tedious OR "how do" OR "how can")`,
                signal: "problem",
                rationale:
                  "Across Reddit: business keywords paired with first-person friction and questions.",
              },
              {
                phrase: `(${terms.slice(0, 4).join(" OR ")}) AND (recommend OR alternative OR tool OR app)`,
                signal: "alternative",
                rationale:
                  "Across Reddit: product and replacement discussions; fit is checked after retrieval.",
              },
            ];
  return {
    category: category?.name || "Your described business",
    summary: description,
    terms: terms.length ? terms : [category?.terms[0] || phrase],
    featureTerms,
    categoryPhrase: phrase,
    communities,
    searchScope: "reddit-wide",
    queries: queryPlans.map((plan) => plan.phrase),
    queryPlans,
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
export function cleanSourceText(value: string): string {
  // Remove the actor's RSS transport footer, retaining the discussion's words.
  return value
    .replace(
      /(?:\s|&#32;)*submitted by(?:\s|&#32;)*\/u\/[\w-]+(?:\s|&#32;)*\[link\](?:\s|&#32;)*\[comments\]\s*$/i,
      "",
    )
    .replace(/&#(\d+);/g, (entity, digits: string) => {
      const code = Number(digits);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    })
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
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
    const kind =
      row.dataType === "comment" ||
      /\/comments\/[^/]+\/[^/]+\/[^/]+/.test(url || "")
        ? "comment"
        : "post";
    const title =
      typeof row.title === "string"
        ? cleanSourceText(row.title).slice(0, 300)
        : "";
    const text =
      typeof row.body === "string"
        ? cleanSourceText(row.body).slice(0, 4000)
        : typeof row.text === "string"
          ? cleanSourceText(row.text).slice(0, 4000)
          : "";
    if (!url || (!text && !title)) continue;
    const combined = `${title} ${text}`.toLowerCase().replace(/[^a-z0-9]/g, "");
    // Preserve distinct comments for qualification. Ranking limits each thread
    // to its strongest relevant post or comment afterwards.
    const thread =
      source === "x"
        ? url.match(/\/status\/(\d+)/)?.[1] || url
        : url.match(/\/comments\/([a-z0-9]+)/i)?.[1] || url;
    const commentId =
      kind === "comment"
        ? url.match(/\/comments\/[^/]+\/[^/]+\/([^/]+)/)?.[1]
        : null;
    const identity = commentId ? `${thread}:comment:${commentId}` : thread;
    if (seen.has(identity) || texts.has(combined)) continue;
    const publishedAt = publication(row.createdAt ?? row.created_utc);
    if (
      publishedAt &&
      now - Date.parse(publishedAt) >
        (source === "reddit" ? 365 : 30) * 86400_000
    )
      continue;
    if (text === "[deleted]" || text === "[removed]") continue;
    seen.add(identity);
    texts.add(combined);
    output.push({
      source,
      kind: source === "reddit" ? kind : undefined,
      id: `${source}:${identity}`,
      url,
      title: kind === "comment" ? "" : title,
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
  /\b(?:is there|are there|anyone (?:know|recommend|using)|can (?:anyone|someone)|looking for|recommend(?:ation|ations)?|suggest(?:ion|ions)?|alternative(?:s)?|need (?:an?|some|help)|how (?:do|can|should) (?:i|you(?: guys)?|we|people)|what (?:app|tool)|wish there|tired of|takes too long|struggling with|hard to|difficult to|trouble (?:with|tracking)|hate (?:tracking|logging)|forget to (?:log|track))\b/i;
export function rank(
  items: SourceItem[],
  business: Business,
  now = Date.now(),
): Opportunity[] {
  const results: Opportunity[] = [];
  for (const item of items) {
    const content = `${item.title}. ${item.text}`;
    const lowered = content.toLowerCase();
    const photoEstimationProblem =
      business.category === "Food & calorie tracking" &&
      business.featureTerms.some((term) =>
        ["photo", "picture", "camera"].includes(term),
      ) &&
      /\b(?:calorie(?:s)? estimate|how many (?:calories|cals)|estimate (?:how many )?calories)\b/i.test(
        content,
      ) &&
      /\b(?:photo|picture|pics|meal|food|ate|eating)\b/i.test(content);
    const trackingProblem =
      /\b(?:struggling|hard|difficult|trouble|hate|tired|too long|forget)\b[^.!?]{0,80}\b(?:track\w*|log\w*|count\w*|estimat\w*)\b/i.test(
        content,
      ) ||
      /\b(?:track\w*|log\w*|count\w*)\b[^.!?]{0,80}\b(?:hard|difficult|struggling|too long|tedious|exhausting)\b/i.test(
        content,
      );
    const trackingQuestion =
      /\bhow (?:do|can|should) (?:i|you(?: guys)?|we|people)\b[^.!?]{0,100}\b(?:track\w*|log\w*|count\w*|estimat\w*)\b/i.test(
        content,
      );
    const websiteOutage =
      /\b(?:websites?|sites?|storefront|web (?:app|service))\b/i.test(
        content,
      ) &&
      /\b(?:down|offline|outages?|unavailable|unreachable|downtime)\b/i.test(
        content,
      );
    const uptimeProblem =
      business.category === "Website uptime monitoring" &&
      websiteOutage &&
      ((/\b(?:my|our|we|i)\b/i.test(content) &&
        /\b(?:notic\w*|notif\w*|alerts?|monitor\w*|customers?|miss\w*|again|find out|only found|didn['’]t know)\b/i.test(
          content,
        )) ||
        request.test(content));
    const evidence =
      content
        .split(/(?<=[.!?])\s+/)
        .find(
          (sentence) =>
            request.test(sentence) ||
            (uptimeProblem &&
              /\b(?:down|offline|outages?|unavailable|unreachable|downtime)\b/i.test(
                sentence,
              )) ||
            (trackingProblem &&
              /\b(?:track\w*|log\w*|count\w*|estimat\w*)\b/i.test(sentence) &&
              /hard|difficult|struggling|too long|tedious|exhausting/i.test(
                sentence,
              )),
        ) ||
      (photoEstimationProblem
        ? (item.title || item.text).slice(0, 700)
        : undefined);
    if (
      !evidence ||
      /\b(?:use my|try my|i built|we launched|sponsored|affiliate link|promo code|sign up now|buy now|dm me|we just launched|just shipped|i just built|we built|our app is|check out my)\b/i.test(
        content,
      )
    )
      continue;
    if (
      /\b(?:not looking for|not asking for|do not need|don['’]t need)\b/i.test(
        evidence,
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
    const toolRequest =
      /\b(?:recommend\w*|suggest\w*|looking for|is there|anyone (?:know|using)|need|what|which)\b[^.!?]{0,100}\b(?:apps?|tools?|trackers?|software|interface)\b/i.test(
        content,
      ) ||
      /\b(?:apps?|tools?|trackers?|software)\b[^.!?]{0,100}\brecommend\w*\b/i.test(
        content,
      );
    const categoryAlternative =
      /\b(?:calorie (?:tracking|counting)|food (?:tracking|logging|journaling)|meal tracking)\b[^.!?]{0,50}\balternatives?\b/i.test(
        content,
      ) ||
      /\balternatives?\b[^.!?]{0,50}\b(?:calorie (?:tracking|counting)|food (?:tracking|logging|journaling)|meal tracking)\b/i.test(
        content,
      );
    const coachingRequest =
      /\b(?:looking for|recommend\w*|need)\b[^.!?]{0,80}\b(?:nutrition coach|personal trainer|dietitian)\b/i.test(
        content,
      );
    const domainFit =
      business.category === "Food & calorie tracking"
        ? /\b(?:calories?|nutrition|meals?|food)\b/i.test(content) &&
          !coachingRequest &&
          (photoEstimationProblem ||
            toolRequest ||
            categoryAlternative ||
            trackingProblem ||
            trackingQuestion)
        : business.category === "Shopify & email marketing"
          ? /\bshopify\b/i.test(content) &&
            /\b(?:discount|codes?|email|cart)\b/i.test(content)
          : business.category === "Website uptime monitoring"
            ? (websiteOutage || /\b(?:uptime|downtime)\b/i.test(content)) &&
              /\b(?:websites?|sites?|monitor|alerts?|tools?|service)\b/i.test(
                content,
              )
            : terms.length >= 2;
    const incompatiblePhoto =
      business.featureTerms.some((term) =>
        ["photo", "picture", "camera"].includes(term),
      ) &&
      /\b(?:without (?:a )?(?:photo|camera)|no photos|manual[- ]only|only manual|not (?:a )?photo[- ]based)\b/i.test(
        content,
      );
    const incompatibleSlack =
      business.featureTerms.includes("slack") &&
      /\b(?:not slack|no slack|teams only|email only)\b/i.test(content);
    const incompatibleWebsite =
      business.category === "Website uptime monitoring" &&
      (/\bnot (?:a )?website\b/i.test(content) ||
        /\b(?:don['’]t need|do not need|not (?:really )?(?:looking for|worried about|interested in))\b[^.!?]{0,60}\b(?:uptime|monitoring|monitor|alerts?)\b/i.test(
          content,
        ));
    if (
      !domainFit ||
      incompatiblePhoto ||
      incompatibleSlack ||
      incompatibleWebsite
    )
      continue;
    if (
      !business.featureTerms.length &&
      business.category === "Your described business" &&
      terms.length < 2
    )
      continue;
    const fit = business.featureTerms.length
      ? 0.65 + Math.min(0.35, features.length * 0.1)
      : Math.min(1, terms.length / 2);
    const ageDays = item.publishedAt
      ? Math.max(0, (now - Date.parse(item.publishedAt)) / 86400_000)
      : null;
    const freshness = ageDays === null ? 0 : Math.max(0, 1 - ageDays / 30);
    const specificity = Math.min(1, (terms.length + features.length) / 4);
    results.push({
      ...item,
      evidence: evidence.trim().slice(0, 700),
      reason: `This discussion mentions ${[...terms, ...features].slice(0, 3).join(", ")}—details that overlap with your description. ${/calorie/i.test(business.summary) && /estimat/i.test(business.summary) && business.featureTerms.includes("photo") ? "Your stated photo-based calorie estimation could help with food estimation or logging. " : ""}${item.synthetic ? "This fictional request illustrates the matching rule." : "Review the original context to confirm the fit."}`,
      need:
        (photoEstimationProblem ||
          trackingProblem ||
          trackingQuestion ||
          uptimeProblem) &&
        !toolRequest &&
        !categoryAlternative
          ? "Problem context"
          : /alternative|instead of|switch from|moving on from/i.test(content)
            ? "Alternative request"
            : /struggling with|tired of|takes too long|hard to|difficult to|trouble with|hate (?:tracking|logging)|forget to/i.test(
                  evidence,
                ) &&
                !/looking for|recommend|is there|what (?:app|tool)/i.test(
                  evidence,
                )
              ? "Problem context"
              : "Solution request",
      score: Math.round(
        100 * (0.4 * fit + 0.35 + 0.15 * freshness + 0.1 * specificity),
      ),
      reviewMethod: "Keyword rules",
      saved: false,
      irrelevant: false,
    });
  }
  const threads = new Set<string>();
  return results
    .sort((a, b) => b.score - a.score)
    .filter((item) => {
      const thread =
        item.source !== "x" && item.url?.match(/\/comments\/([a-z0-9]+)/i)?.[1];
      if (!thread) return true;
      if (threads.has(thread)) return false;
      threads.add(thread);
      return true;
    })
    .slice(0, 10);
}
