import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { customerFixture } from "./helpers/customer";
import { POST as create } from "../app/api/scans/route";
import { GET as read } from "../app/api/scans/[id]/route";
import { GET as bootstrap } from "../app/api/session/route";
import { store } from "../lib/store";
import type { Opportunity } from "../lib/types";

test("live billing retains anonymous preview, restoration and allowance without granting full results", async () => {
  const fixture = await customerFixture();
  const owner = "a".repeat(64);
  const req = (path: string, post = false) => new NextRequest(`https://localhost${path}`, {
    method: post ? "POST" : "GET",
    headers: { cookie: `threadfinder_session=${owner}`, origin: "https://localhost", "content-type": "application/json" },
    ...(post ? { body: JSON.stringify({ description: "A food photo calorie estimation app " + randomUUID(), mode: "live", key: randomUUID(), sources: ["reddit"] }) } : {}),
  });
  try {
    Object.assign(process.env, {
      MONETIZATION_ENABLED: "true", MONETIZATION_MODE: "live", MONETIZATION_LIVE_APPROVED: "true",
      MONETIZATION_APP_ID: "arn:aws:appmonetization:us-west-2:123456789012:apps/example",
      MONETIZATION_REGION: "us-west-2", MONETIZATION_ENDPOINT: "https://us-west-2.alpha.monetization.aws.dev",
      MONETIZATION_EVENT_TYPE: "search_completed", VERCEL: "", VERCEL_ENV: "", DATABASE_URL: "",
      SCAN_DB_PATH: join(mkdtempSync(join(tmpdir(), "threadfinder-anonymous-")), "test.sqlite"),
      OPENAI_API_KEY: "test-only-never-called", LIVE_SCAN_BUDGET_USD: "0.12", LIVE_HOURLY_BUDGET_USD: "1", LIVE_DAILY_BUDGET_USD: "5",
    });
    globalThis.fetch = async () => { throw new Error("Anonymous admission must not call billing or providers"); };
    const initial = await (await bootstrap(req("/api/session"))).json();
    assert.equal(initial.billingEnabled, true);
    assert.equal(initial.signedIn, false);
    assert.equal(initial.freeSearchUsed, false);
    const created = await create(req("/api/scans", true));
    assert.equal(created.status, 201);
    const data = await created.json();
    const repository = await store();
    const scan = (await repository.get(data.id, owner))!;
    assert.equal(scan.free, true);
    assert.ok(!scan.fullResults && !scan.billingEventType && !scan.trialExpiresAt);
    await repository.consumeFree(scan);
    scan.startAttempted = true;
    scan.stage = "complete";
    scan.results = Array.from({ length: 10 }, (_, i) => ({ id: String(i) }) as Opportunity);
    await repository.save(scan);
    const params = { params: Promise.resolve({ id: scan.id }) };
    const restored = await read(req(`/api/scans/${scan.id}`), params);
    assert.equal(restored.status, 200);
    assert.equal((await restored.json()).results.length, 3);
    const used = await (await bootstrap(req("/api/session"))).json();
    assert.equal(used.freeSearchUsed, true);
    assert.equal(used.freeScanId, scan.id);
    assert.notEqual((await create(req("/api/scans", true))).status, 201);
    scan.fullResults = true;
    await repository.save(scan);
    assert.equal((await read(req(`/api/scans/${scan.id}`), params)).status, 401);
  } finally { fixture.restore(); }
});
