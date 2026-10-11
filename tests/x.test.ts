import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { normalize, originalUrl, interpret } from "../lib/discovery";
import { XProvider, xSearchQuery } from "../lib/x-provider";
import { ScanStore } from "../lib/sqlite-store";
import { advance, type Provider } from "../lib/service";
import { publicScan, terminalStages, type Source } from "../lib/types";
const description =
  "Our website uptime monitor alerts teams when a site goes down.";
const xRecord = {
  type: "tweet",
  id: "123",
  text: "Looking for an uptime monitor with website downtime alerts. Any tool recommendations?",
  url: "https://twitter.com/example/status/123?s=20",
  createdAt: new Date().toISOString(),
};
function fake(source: Source): Provider {
  return {
    start: async () => ({
      id: `${source}-run`,
      defaultDatasetId: `${source}-data`,
      status: "RUNNING",
    }),
    poll: async () => ({
      id: `${source}-run`,
      defaultDatasetId: `${source}-data`,
      status: "SUCCEEDED",
      usageTotalUsd: 0.016,
    }),
    items: async () =>
      source === "x"
        ? [xRecord]
        : [
            {
              dataType: "post",
              id: "123",
              title: "Looking for an uptime monitor",
              body: "Need website downtime alerts. Anyone recommend a tool?",
              url: "https://www.reddit.com/r/test/comments/123/request/",
              createdAt: new Date().toISOString(),
            },
          ],
    abort: async () => {},
  };
}
test("X provenance requires actual post paths; aliases canonicalize and sources cannot impersonate each other", () => {
  assert.equal(
    originalUrl(xRecord.url, "x"),
    "https://x.com/example/status/123",
  );
  for (const url of [
    "https://x.com/example",
    "https://x.com.evil.test/example/status/123",
    "https://example:x@x.com/example/status/123",
    "http://x.com/example/status/123",
    "https://www.reddit.com/r/test/comments/123/request/",
  ])
    assert.equal(originalUrl(url, "x"), null);
  assert.equal(originalUrl(xRecord.url, "reddit"), null);
  const items = normalize(
    [
      xRecord,
      { ...xRecord, url: "https://x.com/example/status/123" },
      { ...xRecord, url: "https://x.com/example/status/124", isRetweet: true },
    ],
    Date.now(),
    "x",
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].source, "x");
  assert.equal(items[0].publishedAt, xRecord.createdAt);
  assert.equal(items[0].text, xRecord.text);
  assert.equal(items[0].id, "x:123");
});
test("X adapter sends one constrained need query, ten-result limit and explicit charge/time caps", async () => {
  let request: { url: string; input: Record<string, unknown> } | undefined;
  const fetcher: typeof fetch = async (url, init) => {
    request = { url: String(url), input: JSON.parse(init!.body as string) };
    return Response.json({
      data: { id: "run", defaultDatasetId: "data", status: "RUNNING" },
    });
  };
  const business = interpret(description);
  await new XProvider("private-test-token", 0.04, fetcher).start(business);
  assert.ok(request!.url.includes("maxTotalChargeUsd=0.04"));
  assert.ok(request!.url.includes("maxItems=10"));
  assert.ok(request!.url.includes("timeout=180"));
  assert.ok(!request!.url.includes("private-test-token"));
  assert.equal(request!.input.maxItems, 10);
  assert.equal(request!.input.sort, "Latest");
  assert.deepEqual(request!.input.searchTerms, [xSearchQuery(business)]);
  assert.match(xSearchQuery(business), /^"uptime monitor" "looking for"/);
  assert.ok(!("startUrls" in request!.input));
  let calls = 0;
  const denied: typeof fetch = async () => {
    calls++;
    throw Error("Unexpected request");
  };
  await assert.rejects(new XProvider("test", 0.01, denied).start(business));
  await assert.rejects(new XProvider("test", 0.08, denied, 11).start(business));
  assert.equal(calls, 0);
});
test("source choice participates in durable idempotency and result IDs isolate feedback", async () => {
  const db = new ScanStore(":memory:");
  try {
    const key = randomUUID();
    let scan = db.create("owner", key, description, "sample", 0, 0, [
      "reddit",
      "x",
    ]);
    assert.throws(
      () => db.create("owner", key, description, "sample", 0, 0, ["x"]),
      { status: 409 },
    );
    while (!terminalStages.includes(scan.stage))
      scan = await advance(scan.id, "owner", db);
    assert.equal(scan.results.length, 6);
    assert.equal(new Set(scan.results.map((item) => item.id)).size, 6);
    const x = scan.results.find((item) => item.source === "x")!;
    db.feedback(scan.id, "owner", x.id, "save", true);
    assert.equal(
      db.get(scan.id, "owner")!.results.filter((item) => item.saved).length,
      1,
    );
    const next = db.create("owner", randomUUID(), description, "sample", 0, 0, [
      "x",
    ]);
    assert.notEqual(next.id, scan.id);
    assert.deepEqual(publicScan(next).sources, ["x"]);
  } finally {
    db.close();
  }
});
test("both-source failures preserve the other source's real matches and neither job restarts", async () => {
  for (const failing of ["reddit", "x"] as const) {
    const db = new ScanStore(":memory:");
    const counts = { reddit: 0, x: 0 };
    const providers = { reddit: fake("reddit"), x: fake("x") };
    for (const source of ["reddit", "x"] as const) {
      const start = providers[source].start;
      providers[source].start = async (b) => {
        counts[source]++;
        if (source === failing) throw Error("private credential details");
        return start(b);
      };
    }
    try {
      let scan = db.create(
        "owner",
        randomUUID(),
        description,
        "live",
        0.08,
        1,
        ["reddit", "x"],
      );
      await advance(scan.id, "owner", db, providers);
      await Promise.all(
        Array.from({ length: 10 }, () =>
          advance(scan.id, "owner", db, providers),
        ),
      );
      while (!terminalStages.includes(scan.stage))
        scan = await advance(scan.id, "owner", db, providers);
      assert.equal(scan.stage, "partial");
      assert.equal(scan.results.length, 1);
      assert.notEqual(scan.results[0].source, failing);
      assert.equal(
        scan.sourceRuns!.find((run) => run.source === failing)!.status,
        "failed",
      );
      assert.equal(
        scan.sourceRuns!.find((run) => run.source !== failing)!.status,
        "complete",
      );
      const visible = JSON.stringify(publicScan(scan));
      assert.ok(!visible.includes("private credential"));
      assert.ok(!visible.includes("runId"));
      assert.ok(!visible.includes("datasetId"));
      await advance(scan.id, "owner", db, providers);
      assert.deepEqual(counts, { reddit: 1, x: 1 });
    } finally {
      db.close();
    }
  }
});
test("global X concurrency restriction cannot be bypassed with a new session", () => {
  const db = new ScanStore(":memory:");
  try {
    db.create("one", randomUUID(), description, "live", 0.08, 1, ["x"]);
    assert.throws(
      () =>
        db.create("two", randomUUID(), description, "live", 0.08, 1, [
          "reddit",
          "x",
        ]),
      { status: 429 },
    );
  } finally {
    db.close();
  }
});

test("X monthly allowance survives scan retention and idempotent submissions do not consume it twice", async () => {
  const directory = mkdtempSync(join(tmpdir(), "x-allowance-"));
  const path = join(directory, "scans.sqlite");
  let db = new ScanStore(path);
  const prior = process.env.X_MONTHLY_RUN_LIMIT;
  process.env.X_MONTHLY_RUN_LIMIT = "1";
  try {
    let scan = db.create("owner", randomUUID(), description, "live", 0.08, 1, [
      "x",
    ]);
    assert.equal(
      db.create("owner", scan.key, description, "live", 0.08, 1, ["x"]).id,
      scan.id,
    );
    while (!terminalStages.includes(scan.stage))
      scan = await advance(scan.id, "owner", db, { x: fake("x") });
    db.close();
    const maintenance = new DatabaseSync(path);
    maintenance.exec("DELETE FROM scans");
    maintenance.close();
    db = new ScanStore(path);
    assert.throws(
      () =>
        db.create("new-owner", randomUUID(), description, "live", 0.08, 1, [
          "x",
        ]),
      /monthly run allowance/,
    );
    assert.equal(
      db.create("new-owner", randomUUID(), description, "sample", 0, 0, ["x"])
        .mode,
      "sample",
    );
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
    if (prior === undefined) delete process.env.X_MONTHLY_RUN_LIMIT;
    else process.env.X_MONTHLY_RUN_LIMIT = prior;
  }
});

test("X-only scans use structured product terms without paying for unused Gemini drafts", async () => {
  const db = new ScanStore(":memory:");
  const prior = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  let drafts = 0;
  try {
    let scan = db.create("owner", randomUUID(), description, "live", 0.08, 1, [
      "x",
    ]);
    scan = await advance(
      scan.id,
      "owner",
      db,
      { x: fake("x") },
      async (business) => {
        drafts++;
        return {
          ...business,
          queryMethod: "Gemini draft",
          queries: ["unused"],
        };
      },
    );
    assert.equal(drafts, 0);
    assert.equal(scan.business!.queryMethod, undefined);
    assert.match(scan.sourceRuns![0].queries![0], /^"uptime monitor"/);
  } finally {
    db.close();
    if (prior === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prior;
  }
});

test("timeouts and lost advancement leases retain already completed source results without another job", async () => {
  for (const interruption of ["timeout", "lease"] as const) {
    const db = new ScanStore(":memory:");
    const realNow = Date.now;
    let starts = 0;
    const providers = { reddit: fake("reddit"), x: fake("x") };
    for (const source of ["reddit", "x"] as const) {
      const start = providers[source].start;
      providers[source].start = async (business) => {
        starts++;
        return start(business);
      };
    }
    try {
      let scan = db.create(
        "owner",
        randomUUID(),
        description,
        "live",
        0.08,
        1,
        ["reddit", "x"],
      );
      for (let i = 0; i < 4; i++)
        scan = await advance(scan.id, "owner", db, providers);
      assert.equal(scan.sourceRuns![0].status, "complete");
      assert.equal(scan.sourceRuns![1].status, "searching");
      if (interruption === "lease")
        assert.equal(db.claim(scan.id, "owner"), true);
      const after = realNow() + (interruption === "timeout" ? 210001 : 60001);
      Date.now = () => after;
      scan = await advance(scan.id, "owner", db, providers);
      for (let i = 0; i < 4 && !terminalStages.includes(scan.stage); i++)
        scan = await advance(scan.id, "owner", db, providers);
      assert.equal(scan.stage, "partial");
      assert.equal(scan.results.length, 1);
      assert.equal(scan.results[0].source, "reddit");
      assert.equal(starts, 2);
      assert.equal(scan.sourceRuns![1].status, "failed");
    } finally {
      Date.now = realNow;
      db.close();
    }
  }
});

test("both live adapters share one reservation without multiplying the charge cap", async () => {
  const realFetch = globalThis.fetch;
  const envNames = [
    "APIFY_TOKEN",
    "GEMINI_API_KEY",
    "LIVE_SCAN_BUDGET_USD",
    "LIVE_HOURLY_BUDGET_USD",
  ] as const;
  const prior = Object.fromEntries(
    envNames.map((name) => [name, process.env[name]]),
  );
  process.env.APIFY_TOKEN = "test-token";
  delete process.env.GEMINI_API_KEY;
  process.env.LIVE_HOURLY_BUDGET_USD = "1";
  try {
    for (const total of [0.06, 0.08]) {
      process.env.LIVE_SCAN_BUDGET_USD = String(total);
      const calls: { source: string; cap: number; limit: number }[] = [];
      globalThis.fetch = async (url) => {
        const parsed = new URL(String(url));
        const source = parsed.pathname.includes("twitter") ? "x" : "reddit";
        calls.push({
          source,
          cap: Number(parsed.searchParams.get("maxTotalChargeUsd")),
          limit: Number(parsed.searchParams.get("maxItems")),
        });
        return Response.json({
          data: {
            id: `${source}-run`,
            defaultDatasetId: `${source}-data`,
            status: "RUNNING",
          },
        });
      };
      const db = new ScanStore(":memory:");
      try {
        let scan = db.create(
          "owner",
          randomUUID(),
          description,
          "live",
          total,
          1,
          ["reddit", "x"],
        );
        for (let i = 0; i < 3; i++) scan = await advance(scan.id, "owner", db);
        assert.equal(scan.stage, "searching");
        assert.equal(calls.length, 2);
        assert.ok(
          Math.abs(calls.reduce((sum, call) => sum + call.cap, 0) - total) <
            1e-9,
        );
        assert.equal(calls.find((call) => call.source === "x")!.cap, 0.02);
        assert.equal(calls.find((call) => call.source === "x")!.limit, 10);
        assert.equal(calls.find((call) => call.source === "reddit")!.limit, 40);
      } finally {
        db.close();
      }
    }
  } finally {
    globalThis.fetch = realFetch;
    for (const name of envNames) {
      if (prior[name] === undefined) delete process.env[name];
      else process.env[name] = prior[name];
    }
  }
});
