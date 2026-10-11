import test from "node:test";
import assert from "node:assert/strict";
import { billingEnabled } from "../lib/monetize";
import { requireSearchEntitlement, recordScanUsage } from "../lib/billing";
import type { Scan } from "../lib/types";
import { customerFixture } from "./helpers/customer";

test("production live billing requires launch approval and a dedicated execution identity", async () => {
  const fixture = await customerFixture();
  try {
    Object.assign(process.env, {
      VERCEL_ENV: "production", MONETIZATION_ENABLED: "true", MONETIZATION_MODE: "live",
      MONETIZATION_APP_ID: "arn:aws:appmonetization:us-west-2:123456789012:apps/example",
      MONETIZATION_REGION: "us-west-2", MONETIZATION_ENDPOINT: "https://us-west-2.alpha.monetization.aws.dev",
      MONETIZATION_EVENT_TYPE: "search_completed", MONETIZATION_LIVE_APPROVED: "false",
    });
    delete process.env.MONETIZATION_EXECUTION_ROLE_ARN;
    assert.throws(billingEnabled, /activated/);
    process.env.MONETIZATION_LIVE_APPROVED = "true";
    assert.throws(billingEnabled, /execution identity/);
    process.env.MONETIZATION_EXECUTION_ROLE_ARN = "arn:aws:iam::123456789012:role/TestBilling";
    assert.equal(billingEnabled(), true);
    process.env.MONETIZATION_APP_ID += "/sandbox";
    assert.throws(billingEnabled);
  } finally { fixture.restore(); }
});

test("billing requires an explicit sandbox and refuses production deployment", () => {
  const prior = { ...process.env };
  try {
    process.env.MONETIZATION_ENABLED = "false";
    assert.equal(billingEnabled(), false);
    process.env.MONETIZATION_ENABLED = "true";
    process.env.MONETIZATION_APP_ID = "live-app";
    assert.throws(billingEnabled, /sandbox/);
    process.env.MONETIZATION_APP_ID =
      "arn:aws:appmonetization:us-west-2:123456789012:apps/example/sandbox";
    process.env.MONETIZATION_EVENT_TYPE = "search_completed";
    process.env.MONETIZATION_ENDPOINT =
      "https://us-west-2.alpha.monetization.aws.dev";
    process.env.MONETIZATION_REGION = "us-west-2";
    delete process.env.VERCEL_ENV;
    assert.equal(billingEnabled(), true);
    process.env.VERCEL_ENV = "production";
    assert.throws(billingEnabled, /evaluation/);
  } finally {
    for (const name of [
      "MONETIZATION_ENABLED",
      "MONETIZATION_APP_ID",
      "MONETIZATION_EVENT_TYPE",
      "MONETIZATION_ENDPOINT",
      "MONETIZATION_REGION",
      "VERCEL_ENV",
    ])
      if (prior[name] === undefined) delete process.env[name];
      else process.env[name] = prior[name];
  }
});

test("billing rejects mismatched endpoint, signing Region and app ARN before any AWS call", () => {
  const prior = { ...process.env };
  try {
    Object.assign(process.env, {
      MONETIZATION_ENABLED: "true",
      MONETIZATION_APP_ID:
        "arn:aws:appmonetization:us-west-2:123456789012:apps/example/sandbox",
      MONETIZATION_EVENT_TYPE: "search_completed",
      // This is a validation fixture, not a discovered or provisioned endpoint.
      MONETIZATION_ENDPOINT: "https://us-west-2.alpha.monetization.aws.dev",
      MONETIZATION_REGION: "us-west-2",
    });
    delete process.env.VERCEL_ENV;
    for (const endpoint of [
      "",
      "invalid",
      "http://us-west-2.alpha.monetization.aws.dev",
      "https://us-east-2.alpha.monetization.aws.dev",
      "https://secret@us-west-2.alpha.monetization.aws.dev",
      "https://us-west-2.alpha.monetization.aws.dev?region=us-east-2",
    ]) {
      process.env.MONETIZATION_ENDPOINT = endpoint;
      assert.throws(billingEnabled);
    }
    process.env.MONETIZATION_ENDPOINT =
      "https://us-west-2.alpha.monetization.aws.dev";
    process.env.MONETIZATION_REGION = "us-east-2";
    assert.throws(billingEnabled, /signing Region/);
    process.env.MONETIZATION_REGION = "us-west-2";
    for (const app of [
      "arn:aws:appmonetization:us-east-2:123456789012:apps/example/sandbox",
      "arn:aws:appmonetization:us-west-2:123456789012:apps/example",
      "arn:aws:appmonetization:us-west-2:123456789012:apps/*/sandbox",
      "arn:aws:s3:us-west-2:123456789012:apps/example/sandbox",
    ]) {
      process.env.MONETIZATION_APP_ID = app;
      assert.throws(billingEnabled, /sandbox/);
    }
    process.env.MONETIZATION_ENABLED = "false";
    assert.equal(billingEnabled(), false);
  } finally {
    process.env = prior;
  }
});

test("billing denial and service errors never allow a new search", async () => {
  const client = {
    checkEntitlement: async () => ({
      decision: "DENY" as const,
      reason: { category: "NO_SUBSCRIPTION", code: "NO_SUBSCRIPTION" },
    }),
    putEvent: async () => ({}),
    flush: async () => {},
  };
  // Only the decision is consumed; keep the test independent of SDK reason enums.
  const denied = client as unknown as NonNullable<
    Parameters<typeof requireSearchEntitlement>[1]
  >;
  await assert.rejects(
    requireSearchEntitlement("owner", denied),
    /Choose a plan/,
  );
  await assert.rejects(requireSearchEntitlement("", denied), /session/);
  await assert.rejects(
    requireSearchEntitlement("owner", {
      ...denied,
      checkEntitlement: async () => {
        throw new Error("AWS unavailable");
      },
    }),
    /AWS unavailable/,
  );
});

test("completed scan retries reuse the usage token; failed, free and sample scans emit nothing", async () => {
  const events: unknown[] = [];
  const client = {
    checkEntitlement: async () => {
      throw new Error("unused");
    },
    putEvent: async (owner: string, event: unknown) => {
      events.push({ owner, event });
      return {};
    },
    flush: async () => {},
  } as unknown as NonNullable<Parameters<typeof recordScanUsage>[1]>;
  const scan = {
    id: "scan-id",
    owner: "owner",
    mode: "live",
    stage: "complete",
    billingEventType: "search_completed",
    createdAt: 1791748800000,
  } as Scan;
  await recordScanUsage(scan, client);
  await recordScanUsage(scan, client);
  assert.equal(events.length, 2);
  assert.deepEqual(events[0], events[1]);
  assert.deepEqual(events[0], {
    owner: "owner",
    event: {
      eventType: "search_completed",
      quantity: "1",
      clientToken: "scan-id",
      timestamp: new Date(scan.createdAt).toISOString(),
    },
  });
  await recordScanUsage({ ...scan, stage: "failed" }, client);
  await recordScanUsage({ ...scan, mode: "sample" }, client);
  await recordScanUsage({ ...scan, billingEventType: undefined }, client);
  assert.equal(events.length, 2);
});
