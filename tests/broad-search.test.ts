import test from "node:test";
import assert from "node:assert/strict";
import { normalize, interpret, rank } from "../lib/discovery";
import { ScanStore } from "../lib/sqlite-store";
import { advance } from "../lib/service";
import { terminalStages, publicScan } from "../lib/types";
import { randomUUID } from "node:crypto";
const description =
  "Our website uptime monitor sends a Slack alert when a site goes down, so small teams notice downtime quickly.";
function record(
  id: string,
  body: string,
  kind: "post" | "comment" = "post",
  thread = id,
) {
  return {
    dataType: kind,
    id: (kind === "comment" ? "t1_" : "t3_") + id,
    title: kind === "comment" ? "I built a tool (parent post title)" : "",
    body,
    communityName: "r/smallbusiness",
    url: `https://www.reddit.com/r/smallbusiness/comments/${thread}/discussion/${kind === "comment" ? id + "/" : ""}`,
    createdAt: new Date().toISOString(),
  };
}
test("known categories include broad problem and product searches alongside a focused community query", () => {
  for (const text of [
    description,
    "Our app estimates calories from a food photo instead of manual logging.",
    "We help Shopify stores create unique discount codes for welcome emails.",
  ]) {
    const business = interpret(text);
    assert.equal(business.searchScope, "reddit-wide");
    assert.equal(business.queries.length, 3);
    assert.equal(
      business.queries.filter((query) => !query.includes("subreddit:")).length,
      2,
    );
    assert(business.queries.some((query) => query.includes("subreddit:")));
  }
  const uptime = interpret(description);
  assert(
    uptime.queries.some(
      (query) => query.includes("down") && !query.includes("uptime"),
    ),
  );
  const generic = interpret(
    "Our appointment reminder app helps dentists reduce missed appointments.",
  );
  assert(generic.queries.every((query) => !query.includes("subreddit:")));
  assert(generic.queries.some((query) => query.includes("appointment")));
  assert(
    generic.queries.every(
      (query) => !query.includes('"appointment reminder dentists"'),
    ),
  );
});
test("website-down problems qualify outside preferred communities without the word uptime or a software request", () => {
  const business = interpret(description);
  for (const body of [
    "Our website went offline again. I only noticed after a customer called us.",
    "My site was down for hours and I missed it. Customers told me before I found out.",
    "How do you know when your website is down? I need alerts before customers complain.",
  ]) {
    const item = normalize([record(randomUUID().replaceAll("-", ""), body)])[0];
    const matches = rank([item], business);
    assert.equal(matches.length, 1, body);
    assert.equal(matches[0].need, "Problem context");
    assert(item.text.includes(matches[0].evidence));
  }
  for (const body of [
    "I built a website uptime monitor that sends notifications. Try my app.",
    "Our website is offline for planned maintenance and everything is fine.",
    "Looking for a monitor for my gaming computer.",
    "My site goes down but I do not need monitoring or alerts.",
    "Looking for website uptime monitoring, Teams only, not Slack.",
  ])
    assert.equal(
      rank(
        normalize([record(randomUUID().replaceAll("-", ""), body)]),
        business,
      ).length,
      0,
      body,
    );
});
test("relevant comments survive an unrelated parent, retain their exact permalink and date, and do not flood a thread", () => {
  const records = [
    record("parent", "Our new website design uses blue icons."),
    record(
      "reply1",
      "My website goes offline again. I only notice when customers call.",
      "comment",
      "parent",
    ),
    record(
      "reply2",
      "Our site was down and I missed it. I need alerts.",
      "comment",
      "parent",
    ),
  ];
  const items = normalize(records);
  assert.equal(items.length, 3);
  assert.equal(items[1].kind, "comment");
  assert.equal(items[1].title, "");
  assert.equal(items[1].id, "reddit:parent:comment:reply1");
  assert.equal(items[1].url, records[1].url);
  assert.equal(items[1].publishedAt, records[1].createdAt);
  const results = rank(items, interpret(description));
  assert.equal(results.length, 1);
  assert.equal(results[0].kind, "comment");
  assert.equal(normalize([records[1], records[1]]).length, 1);
});
test("mixed post/comment service retains genuine comment matches in one started free run", async () => {
  const db = new ScanStore(":memory:");
  let starts = 0;
  const provider = {
    start: async (business: ReturnType<typeof interpret>) => {
      starts++;
      assert.equal(business.searchScope, "reddit-wide");
      assert(business.queries.some((q) => !q.includes("subreddit:")));
      return { id: "run", defaultDatasetId: "data", status: "RUNNING" };
    },
    poll: async () => ({
      id: "run",
      defaultDatasetId: "data",
      status: "SUCCEEDED",
    }),
    items: async () => [
      record("irrelevant", "We launched a new product. Sign up now!"),
      record(
        "comment1",
        "My website goes down again and I only notice after customers complain.",
        "comment",
        "irrelevant",
      ),
    ],
    abort: async () => {},
  };
  try {
    let scan = db.create(
      "owner",
      randomUUID(),
      description,
      "live",
      0.12,
      1,
      ["reddit"],
      { free: true, ipHash: "ip", dailyBudget: 5 },
    );
    while (!terminalStages.includes(scan.stage))
      scan = await advance(scan.id, "owner", db, provider);
    assert.equal(starts, 1);
    assert.equal(scan.stage, "complete");
    assert.equal(scan.results.length, 1);
    assert.equal(scan.results[0].kind, "comment");
    assert.deepEqual(scan.sourceRuns![0].searchKinds, ["post", "comment"]);
    assert.equal(publicScan(scan).sourceRuns[0].searchKinds?.length, 2);
    assert(db.allowance("owner").used);
    assert.equal(scan.reservedUsd, 0.12);
  } finally {
    db.close();
  }
});
