import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScanStore } from "../lib/sqlite-store";
import { advance } from "../lib/service";
import { AppError } from "../lib/config";
import { publicScan, terminalStages } from "../lib/types";
const description =
  "Our app estimates calories from food photos instead of manual meal logging.";
const admission = { ipHash: "connection", dailyBudget: 5, free: true };
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
  items: async () =>
    Array.from({ length: 6 }, (_, i) => ({
      id: "thread" + i,
      title: "Calorie photo app " + i,
      body:
        "Which app can estimate calories from a food photo? I need easier meal logging. " +
        i,
      url: `https://www.reddit.com/r/caloriecount/comments/thread${i}/request/`,
      createdAt: new Date().toISOString(),
    })),
  abort: async () => {},
};
test("one started free search persists beyond result expiry and retains only three results", async () => {
  const dir = mkdtempSync(join(tmpdir(), "free-usage-"));
  const path = join(dir, "scans.sqlite");
  let db = new ScanStore(path);
  const now = Date.now;
  try {
    let scan = db.create(
      "owner",
      randomUUID(),
      description,
      "live",
      0.08,
      1,
      ["reddit"],
      admission,
    );
    const id = scan.id;
    assert.equal(db.allowance("owner").used, false);
    while (!terminalStages.includes(scan.stage))
      scan = await advance(id, "owner", db, provider);
    assert.equal(scan.results.length, 3);
    assert.equal(publicScan(scan).lockedCount, 0);
    assert.equal(publicScan(scan).matchCount, 3);
    assert.equal(db.allowance("owner").used, true);
    assert.equal(
      db.create(
        "owner",
        scan.key,
        description,
        "live",
        0.08,
        1,
        ["reddit"],
        admission,
      ).id,
      id,
    );
    db.close();
    db = new ScanStore(path);
    assert.equal(db.allowance("owner").scanId, id);
    Date.now = () => now() + 48 * 3600_000;
    assert.throws(
      () =>
        db.create(
          "owner",
          randomUUID(),
          description + " New",
          "live",
          0.08,
          1,
          ["reddit"],
          admission,
        ),
      /free search has already been used/,
    );
    assert.equal(db.allowance("owner").used, true);
    assert(db.create("owner", randomUUID(), description, "sample", 0));
  } finally {
    Date.now = now;
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("definitively rejected source start releases the free allowance and unused reservation", async () => {
  const db = new ScanStore(":memory:");
  let attempts = 0;
  const rejected = {
    ...provider,
    start: async () => {
      attempts++;
      throw new AppError("Source rejected before starting", 502, true);
    },
  };
  try {
    let scan = db.create(
      "owner",
      randomUUID(),
      description,
      "live",
      0.08,
      0.08,
      ["reddit"],
      { ...admission, dailyBudget: 0.08 },
    );
    while (!terminalStages.includes(scan.stage))
      scan = await advance(scan.id, "owner", db, rejected);
    assert.equal(scan.stage, "failed");
    assert.equal(scan.reservedUsd, 0);
    assert.equal(db.allowance("owner").used, false);
    await advance(scan.id, "owner", db, rejected);
    assert.equal(attempts, 1);
    const retry = db.create(
      "owner",
      randomUUID(),
      description,
      "live",
      0.08,
      0.08,
      ["reddit"],
      { ...admission, dailyBudget: 0.08 },
    );
    assert.notEqual(retry.id, scan.id);
  } finally {
    db.close();
  }
});
test("uncertain source start consumes the allowance and cannot create another paid job", async () => {
  const db = new ScanStore(":memory:");
  let attempts = 0;
  const uncertain = {
    ...provider,
    start: async () => {
      attempts++;
      throw Error("Connection lost after send");
    },
  };
  try {
    let scan = db.create(
      "owner",
      randomUUID(),
      description,
      "live",
      0.08,
      1,
      ["reddit"],
      admission,
    );
    while (!terminalStages.includes(scan.stage))
      scan = await advance(scan.id, "owner", db, uncertain);
    assert.equal(db.allowance("owner").used, true);
    assert.equal(scan.reservedUsd, 0.08);
    assert.throws(
      () =>
        db.create(
          "owner",
          randomUUID(),
          description + " Different",
          "live",
          0.08,
          1,
          ["reddit"],
          admission,
        ),
      /free search has already been used/,
    );
    await advance(scan.id, "owner", db, uncertain);
    assert.equal(attempts, 1);
  } finally {
    db.close();
  }
});
test("free production adapter uses ten candidates and one source job", async () => {
  const db = new ScanStore(":memory:");
  const prior = { ...process.env };
  const oldFetch = globalThis.fetch;
  let starts = 0;
  Object.assign(process.env, {
    APIFY_TOKEN: "test-token",
    LIVE_SCAN_BUDGET_USD: "0.08",
    LIVE_HOURLY_BUDGET_USD: "1",
    LIVE_DAILY_BUDGET_USD: "5",
  });
  delete process.env.GEMINI_API_KEY;
  globalThis.fetch = async (url, init) => {
    const path = String(url);
    if (path.includes("/acts/")) {
      starts++;
      assert.match(path, /maxItems=10/);
      assert.match(path, /maxTotalChargeUsd=0.08/);
      const input = JSON.parse(init!.body as string);
      assert.equal(input.maxItems, 10);
      return Response.json({
        data: { id: "run", defaultDatasetId: "data", status: "RUNNING" },
      });
    }
    if (path.includes("/actor-runs/"))
      return Response.json({
        data: { id: "run", defaultDatasetId: "data", status: "SUCCEEDED" },
      });
    assert.match(path, /limit=10/);
    return Response.json(await provider.items());
  };
  try {
    let scan = db.create(
      "owner",
      randomUUID(),
      description,
      "live",
      0.08,
      1,
      ["reddit"],
      admission,
    );
    while (!terminalStages.includes(scan.stage))
      scan = await advance(scan.id, "owner", db);
    assert.equal(starts, 1);
    assert.equal(scan.results.length, 3);
  } finally {
    globalThis.fetch = oldFetch;
    process.env = prior;
    db.close();
  }
});
