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

test("failed provider job exposes only actual partial records", async () => {
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
    assert.equal(scan.stage, "partial");
    assert.equal(scan.retrieved, 0);
    assert.equal(scan.results.length, 0);
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
  const denied: typeof fetch = async () =>
    Response.json({ error: "test-token" }, { status: 401 });
  await assert.rejects(
    new RedditProvider("test-token", 0.5, denied).start(interpret(description)),
    (error) => error instanceof Error && !error.message.includes("test-token"),
  );
});
