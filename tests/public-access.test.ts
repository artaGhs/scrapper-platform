import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { ScanStore } from "../lib/sqlite-store";
import { clientFingerprint, failure } from "../lib/http";
import { AppError } from "../lib/config";
import { POST } from "../app/api/scans/route";
import { publicScan } from "../lib/types";
const description =
  "Our app estimates calories from food photos to simplify meal logging.";

test("anonymous live admission needs no pilot code and starts no provider job", async () => {
  const dir = mkdtempSync(join(tmpdir(), "public-admission-"));
  const prior = { ...process.env };
  delete process.env.VERCEL;
  delete process.env.DATABASE_URL;
  Object.assign(process.env, {
    SCAN_DB_PATH: join(dir, "scans.sqlite"),
    APIFY_TOKEN: "private-test-token",
    LIVE_ACCESS_CODE: "obsolete-code",
    LIVE_SCAN_BUDGET_USD: "0.08",
    LIVE_HOURLY_BUDGET_USD: "0.24",
    LIVE_DAILY_BUDGET_USD: "0.24",
  });
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls++;
    throw Error("No provider call is authorized in this test");
  };
  try {
    const request = new NextRequest("http://localhost/api/scans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description, mode: "live", key: randomUUID() }),
    });
    const response = await POST(request);
    assert.equal(response.status, 201);
    const scan = await response.json();
    assert.equal(scan.stage, "interpreting");
    assert.equal(networkCalls, 0);
    assert.match(response.headers.get("set-cookie")!, /HttpOnly/i);
    assert.ok(!JSON.stringify(scan).includes("private-test-token"));
    assert.ok(!JSON.stringify(scan).includes("obsolete-code"));
    assert.ok(!("ipHash" in scan));
  } finally {
    globalThis.fetch = originalFetch;
    process.env = prior;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rolling daily budget survives the hourly reset and another session", () => {
  const db = new ScanStore(":memory:");
  const now = Date.now;
  try {
    db.create(
      "one",
      randomUUID(),
      description,
      "live",
      0.08,
      0.24,
      ["reddit"],
      { ipHash: "one", dailyBudget: 0.08 },
    );
    Date.now = () => now() + 2 * 3600_000;
    assert.throws(
      () =>
        db.create(
          "two",
          randomUUID(),
          description,
          "live",
          0.08,
          0.24,
          ["reddit"],
          { ipHash: "two", dailyBudget: 0.08 },
        ),
      /tomorrow/,
    );
  } finally {
    Date.now = now;
    db.close();
  }
});

test("live connection limit survives replacing the anonymous session, while retries deduplicate", () => {
  const db = new ScanStore(":memory:");
  try {
    const admission = { ipHash: "same-connection", dailyBudget: 1 };
    const key = randomUUID();
    const first = db.create(
      "one",
      key,
      description,
      "live",
      0.08,
      1,
      ["reddit"],
      admission,
    );
    assert.equal(
      db.create("one", key, description, "live", 0.08, 1, ["reddit"], admission)
        .id,
      first.id,
    );
    db.create(
      "two",
      randomUUID(),
      description,
      "live",
      0.08,
      1,
      ["reddit"],
      admission,
    );
    assert.throws(
      () =>
        db.create(
          "three",
          randomUUID(),
          description,
          "live",
          0.08,
          1,
          ["reddit"],
          admission,
        ),
      /two live searches per hour/,
    );
    assert.ok(!JSON.stringify(publicScan(first)).includes("same-connection"));
  } finally {
    db.close();
  }
});

test("request throttles reject the 31st request and recover in the next minute", () => {
  const db = new ScanStore(":memory:");
  const now = Date.now;
  try {
    for (let i = 0; i < 30; i++) db.throttle("connection");
    assert.throws(() => db.throttle("connection"), /Wait one minute/);
    db.throttle("another-connection");
    Date.now = () => now() + 60_000;
    db.throttle("connection");
    assert.equal(
      failure(new AppError("Capacity full", 429)).headers.get("retry-after"),
      "60",
    );
  } finally {
    Date.now = now;
    db.close();
  }
});

test("fingerprints use the deployment IP header, with no raw IP or local spoofing", () => {
  const prior = process.env.VERCEL;
  try {
    delete process.env.VERCEL;
    const request = (ip: string) =>
      new NextRequest("http://localhost", {
        headers: { "x-forwarded-for": ip },
      });
    assert.equal(
      clientFingerprint(request("1.2.3.4")),
      clientFingerprint(request("9.8.7.6")),
    );
    process.env.VERCEL = "1";
    assert.notEqual(
      clientFingerprint(request("1.2.3.4")),
      clientFingerprint(request("9.8.7.6")),
    );
    assert.match(clientFingerprint(request("1.2.3.4")), /^[a-f0-9]{64}$/);
  } finally {
    if (prior === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prior;
  }
});
