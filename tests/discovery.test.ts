import test from "node:test";
import assert from "node:assert/strict";
import { interpret, normalize, originalUrl, rank } from "../lib/discovery";
import { sampleItems } from "../lib/samples";

test("specific request-and-fit matching excludes topic chatter and unrelated examples", () => {
  const food = interpret(
    "Our app estimates calories from a food photo instead of manual ingredient logging.",
  );
  const results = rank(sampleItems(), food);
  assert.equal(results.length, 3);
  assert.ok(
    results.every(
      (result) =>
        result.id.startsWith("food-") &&
        result.url === null &&
        result.publishedAt === null,
    ),
  );
  const shop = rank(
    sampleItems(),
    interpret(
      "Our Shopify app sends automatic unique discount codes in welcome emails.",
    ),
  );
  assert.equal(shop.length, 3);
  assert.ok(shop.every((result) => result.id.startsWith("shop-")));
  const uptime = rank(
    sampleItems(),
    interpret(
      "Our website uptime monitor sends Slack alerts when a site is down.",
    ),
  );
  assert.equal(uptime.length, 3);
  assert.equal(
    rank(
      sampleItems(),
      interpret("We manufacture custom ceramic kitchen tiles for architects."),
    ).length,
    0,
  );
});

test("queries and fit features reflect stated capabilities", () => {
  const business = interpret("We offer calorie tracking.");
  assert.deepEqual(business.featureTerms, []);
  assert.ok(business.queries.every((query) => !query.includes("photo")));
});

test("original URLs require HTTPS and real Reddit discussion-shaped paths", () => {
  assert.equal(originalUrl("javascript:alert(1)"), null);
  assert.equal(
    originalUrl("https://reddit.com.evil.test/r/test/comments/abc/a"),
    null,
  );
  assert.equal(
    originalUrl("https://user:secret@reddit.com/r/test/comments/abc/a"),
    null,
  );
  assert.equal(originalUrl("https://www.reddit.com/"), null);
  assert.equal(
    originalUrl(
      "https://www.reddit.com/r/test/comments/abc/a/?utm_source=foo#test",
    ),
    "https://www.reddit.com/r/test/comments/abc/a/",
  );
});

test("normalization rejects missing sources, stale items and duplicates, preserving unknown dates", () => {
  const now = Date.now();
  const normalized = normalize(
    [
      {
        id: "1",
        title: "Is there an app?",
        body: "Looking for help",
        url: "https://www.reddit.com/r/test/comments/abc/question/",
        createdAt: "not a date",
      },
      {
        id: "2",
        body: "Another comment in the same thread",
        url: "https://www.reddit.com/r/test/comments/abc/question/comment/",
      },
      {
        id: "3",
        body: "Looking for help",
        title: "Is there an app?",
        url: "https://www.reddit.com/r/test/comments/def/question/",
      },
      {
        id: "4",
        body: "Old question",
        url: "https://www.reddit.com/r/test/comments/old/question/",
        createdAt: new Date(now - 40 * 86400_000).toISOString(),
      },
      { id: "5", body: "No original URL" },
      {
        id: "6",
        body: "[deleted]",
        url: "https://www.reddit.com/r/test/comments/deleted/question/",
      },
    ],
    now,
  );
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].publishedAt, null);
});

test("known freshness affects relevance but never manufactures a missing date", () => {
  const item = sampleItems()[0];
  const business = interpret(
    "Calorie tracking from food photos without manual ingredient logging.",
  );
  const dated = {
    ...item,
    synthetic: false,
    publishedAt: new Date().toISOString(),
  };
  assert.ok(rank([dated], business)[0].score > rank([item], business)[0].score);
  assert.equal(rank([item], business)[0].publishedAt, null);
});

test("promotional content is filtered and source instructions are never executed", () => {
  const item = {
    ...sampleItems()[0],
    text: "I built a calorie photo app! Try my tool. Is there an app you like?",
  };
  assert.equal(
    rank([item], interpret("Calorie photo app without manual logging.")).length,
    0,
  );
});
