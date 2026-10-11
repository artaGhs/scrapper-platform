import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { ScanStore } from "../lib/sqlite-store";
import { advance } from "../lib/service";
import { terminalStages, publicScan } from "../lib/types";
import { RedditProvider } from "../lib/provider";
const description =
  "We estimate calories from a food photo instead of manual ingredient logging.";

test("sample scan completes once, rejects other sessions and persists feedback across reopen", async () => {
  const dir = mkdtempSync(join(tmpdir(), "scrapper-test-"));
  const path = join(dir, "scans.sqlite");
  let db = new ScanStore(path);
  try {
    const key = randomUUID();
    let scan = db.create("owner", key, description, "sample", 0);
    assert.equal(db.create("owner", key, description, "sample", 0).id, scan.id);
    assert.equal(
      db.create("owner", randomUUID(), description, "sample", 0).id,
      scan.id,
    );
    await assert.rejects(advance(scan.id, "other", db), /not found/);
    for (let i = 0; i < 8 && !terminalStages.includes(scan.stage); i++)
      scan = await advance(scan.id, "owner", db);
    assert.equal(scan.stage, "complete");
    assert.equal(scan.results.length, 3);
    const completed = JSON.stringify(scan.results);
    assert.equal(
      JSON.stringify((await advance(scan.id, "owner", db)).results),
      completed,
    );
    db.feedback(scan.id, "owner", scan.results[0].id, "save", true);
    db.close();
    db = new ScanStore(path);
    assert.equal(db.get(scan.id, "owner")?.results[0].saved, true);
    assert.equal(db.get(scan.id, "other"), null);
    assert.ok(!("owner" in publicScan(scan)) && !("key" in publicScan(scan)));
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("simultaneous advancing calls cannot create duplicate paid jobs", async () => {
  const db = new ScanStore(":memory:");
  let starts = 0;
  const provider = {
    async start() {
      starts++;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return { id: "run", defaultDatasetId: "data", status: "RUNNING" };
    },
    async poll() {
      return { id: "run", defaultDatasetId: "data", status: "SUCCEEDED" };
    },
    async items() {
      return [
        {
          id: "abc",
          title: "Is there a calorie photo app?",
          body: "Looking for a food photo calorie tracker.",
          url: "https://www.reddit.com/r/test/comments/abc/request/",
          createdAt: new Date().toISOString(),
        },
      ];
    },
    async abort() {},
  };
  try {
    let scan = db.create("owner", randomUUID(), description, "live", 0.5, 2);
    scan = await advance(scan.id, "owner", db, provider);
    await Promise.all(
      Array.from({ length: 10 }, () => advance(scan.id, "owner", db, provider)),
    );
    assert.equal(starts, 1);
    for (let i = 0; i < 6; i++)
      scan = await advance(scan.id, "owner", db, provider);
    assert.equal(scan.stage, "complete");
    assert.equal(scan.results.length, 1);
  } finally {
    db.close();
  }
});

test("uncertain provider start fails without automatic creation retries", async () => {
  const db = new ScanStore(":memory:");
  let starts = 0;
  const provider = {
    async start() {
      starts++;
      throw new Error("network with sensitive detail");
    },
    async poll() {
      throw new Error();
    },
    async items() {
      return [];
    },
    async abort() {},
  };
  try {
    let scan = db.create("owner", randomUUID(), description, "live", 0.5, 2);
    scan = await advance(scan.id, "owner", db, provider);
    scan = await advance(scan.id, "owner", db, provider);
    assert.equal(scan.stage, "failed");
    assert.ok(!scan.error?.includes("sensitive"));
    for (let i = 0; i < 3; i++) await advance(scan.id, "owner", db, provider);
    assert.equal(starts, 1);
  } finally {
    db.close();
  }
});

test("global live reservation budget cannot be bypassed with a new session", () => {
  const db = new ScanStore(":memory:");
  try {
    db.create("first", randomUUID(), description, "live", 0.75, 1);
    assert.throws(
      () => db.create("second", randomUUID(), description, "live", 0.75, 1),
      /hourly live-search budget/,
    );
  } finally {
    db.close();
  }
});

test("failed provider without usable discussions is a failure, not an empty search", async () => {
  const db = new ScanStore(":memory:");
  const provider = {
    async start() {
      return { id: "run", defaultDatasetId: "data", status: "RUNNING" };
    },
    async poll() {
      return { id: "run", defaultDatasetId: "data", status: "FAILED" };
    },
    async items() {
      return [];
    },
    async abort() {},
  };
  try {
    let scan = db.create("owner", randomUUID(), description, "live", 0.5, 2);
    for (let i = 0; i < 7; i++)
      scan = await advance(scan.id, "owner", db, provider);
    assert.equal(scan.stage, "failed");
    assert.match(scan.error!, /not a confirmed empty search/);
    assert.equal(scan.retrieved, 0);
    assert.equal(scan.results.length, 0);
  } finally {
    db.close();
  }
});

test("stopped source jobs preserve qualified discussions actually returned", async () => {
  const db = new ScanStore(":memory:");
  const provider = {
    start: async () => ({
      id: "run",
      defaultDatasetId: "data",
      status: "RUNNING",
    }),
    poll: async () => ({
      id: "run",
      defaultDatasetId: "data",
      status: "TIMED-OUT",
    }),
    items: async () => [
      {
        dataType: "post",
        title: "Is there a calorie photo app?",
        body: "Looking for a food photo calorie tracker.",
        url: "https://www.reddit.com/r/test/comments/abc/request/",
        createdAt: new Date().toISOString(),
      },
    ],
    abort: async () => {},
  };
  try {
    let scan = db.create("owner", randomUUID(), description, "live", 0.05, 1);
    while (!terminalStages.includes(scan.stage))
      scan = await advance(scan.id, "owner", db, provider);
    assert.equal(scan.stage, "partial");
    assert.equal(scan.results.length, 1);
    assert.match(scan.notice!, /only the records actually returned/);
    assert.equal(scan.error, undefined);
  } finally {
    db.close();
  }
});

test("adapter sends bounded documented inputs and withholds credentials from user errors", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const fakeFetch: typeof fetch = async (url, init) => {
    requests.push({ url: String(url), init });
    return Response.json({
      data: { id: "run", defaultDatasetId: "data", status: "RUNNING" },
    });
  };
  const { interpret } = await import("../lib/discovery");
  await new RedditProvider("test-token", 0.5, fakeFetch).start(
    interpret(description),
  );
  assert.ok(requests[0].url.includes("maxTotalChargeUsd=0.5"));
  assert.ok(requests[0].url.includes("maxItems=50"));
  assert.ok(!requests[0].url.includes("test-token"));
  const input = JSON.parse(requests[0].init?.body as string);
  assert.equal(input.maxItems, 50);
  assert.equal(input.searchComments, false);
  assert.equal(input.skipCommunity, true);
  assert.equal(input.ignoreStartUrls, true);
  assert.equal(input.includeMediaLinks, false);
  assert.equal(input.navigationTimeout, 20);
  assert.equal(input.scrollTimeout, 10);
  assert.ok(requests[0].url.includes("memory=2048"));
  const denied: typeof fetch = async () =>
    Response.json({ error: "test-token" }, { status: 401 });
  await assert.rejects(
    new RedditProvider("test-token", 0.5, denied).start(interpret(description)),
    (error) => error instanceof Error && !error.message.includes("test-token"),
  );
});

test("completed retrieval with valid discussions but no fit is a genuine empty search; wrong record types are a failure", async () => {
  for (const [records, expected] of [
    [
      [
        {
          dataType: "post",
          id: "real-shape",
          url: "https://www.reddit.com/r/test/comments/post1/question/",
          title: "Looking for an uptime monitor",
          body: "Need a tool to check website availability.",
          createdAt: new Date().toISOString(),
        },
      ],
      "empty",
    ],
    [
      [
        {
          dataType: "community",
          url: "https://www.reddit.com/r/test/",
          title: "A community",
        },
      ],
      "failed",
    ],
    [[], "empty"],
  ] as const) {
    const db = new ScanStore(":memory:");
    const provider = {
      start: async () => ({
        id: "run",
        defaultDatasetId: "data",
        status: "RUNNING",
      }),
      poll: async () => ({
        id: "run",
        defaultDatasetId: "data",
        status: "SUCCEEDED",
      }),
      items: async () => [...records],
      abort: async () => {},
    };
    try {
      let scan = db.create("owner", randomUUID(), description, "live", 0.05, 1);
      while (!terminalStages.includes(scan.stage))
        scan = await advance(scan.id, "owner", db, provider);
      assert.equal(scan.stage, expected);
      assert.equal(scan.results.length, 0);
      if (expected === "failed") assert.match(scan.error!, /source failure/);
    } finally {
      db.close();
    }
  }
});

test("live application stage passes grounded model queries to the provider and falls back on model failure", async () => {
  const prior = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
  try {
    for (const fails of [false, true]) {
      const db = new ScanStore(":memory:");
      let observed: string[] = [];
      const provider = {
        start: async (business: import("../lib/types").Business) => {
          observed = business.queries;
          return { id: "run", defaultDatasetId: "data", status: "RUNNING" };
        },
        poll: async () => ({
          id: "run",
          defaultDatasetId: "data",
          status: "SUCCEEDED",
        }),
        items: async () => [],
        abort: async () => {},
      };
      const model: typeof import("../lib/model").draftQueries = async (
        business,
      ) => {
        if (fails) throw Error("unavailable");
        return {
          ...business,
          queries: ["food calorie photo app"],
          queryMethod: "Gemini draft",
        };
      };
      try {
        let scan = db.create(
          "owner",
          randomUUID(),
          description,
          "live",
          0.05,
          1,
        );
        scan = await advance(scan.id, "owner", db, provider, model);
        await advance(scan.id, "owner", db, provider, model);
        if (fails) {
          assert.match(scan.notice!, /keyword strategy/);
          assert.notEqual(scan.business!.queryMethod, "Gemini draft");
        } else {
          assert.deepEqual(observed, ["food calorie photo app"]);
          assert.equal(scan.business!.queryMethod, "Gemini draft");
        }
      } finally {
        db.close();
      }
    }
  } finally {
    if (prior === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prior;
  }
});

test("provider rejects undocumented actor minimums locally before starting a charged job", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    throw Error("must not call");
  };
  const { interpret } = await import("../lib/discovery");
  await assert.rejects(
    new RedditProvider("test-token", 0.05, fetcher, 5).start(
      interpret(description),
    ),
    /at least 10/,
  );
  await assert.rejects(
    new RedditProvider("test-token", 0.01, fetcher, 10).start(
      interpret(description),
    ),
    /at least \$0.04/,
  );
  assert.equal(calls, 0);
});
