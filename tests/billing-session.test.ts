import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { MonetizationAI } from "@aws-app-monetization/sdk";
import {
  billingReturnOrigin,
  createBillingSession,
} from "../lib/monetization-session";
import { POST } from "../app/api/billing/session/route";
import { GET } from "../app/api/session/route";
import { customerFixture } from "./helpers/customer";
let activeCustomerToken = "";

const owner = "a".repeat(64);
function request(
  payload: unknown,
  cookie = `threadfinder_session=${owner}`,
  origin = "https://localhost",
) {
  return new NextRequest("https://localhost/api/billing/session", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookie + (activeCustomerToken ? `; threadfinder_customer=${activeCustomerToken}` : ""), origin },
    body: JSON.stringify(payload),
  });
}

test("hosted sessions use the server identity, renew on each click and ignore old cookies", async () => {
  const prior = { ...process.env };
  delete process.env.MONETIZATION_RETURN_ORIGIN;
  const calls: { user: string; options: unknown; destination: string }[] = [];
  const client = {
    createPricingSession: async (user: string, options: unknown) => {
      calls.push({ user, options, destination: "pricing" });
      return {
        pricingUrl: `https://billing.example/pricing#token-${calls.length}`,
      };
    },
    createBillingPortalSession: async (user: string, options: unknown) => {
      calls.push({ user, options, destination: "portal" });
      return {
        billingPortalUrl: "https://billing.example/portal#test-token",
        expiresAt: new Date(Date.now() + 3600_000),
      };
    },
  } as NonNullable<Parameters<typeof createBillingSession>[3]>;
  try {
    const req = request(
      {},
      `threadfinder_session=${owner}; mai_pricing_url=https://old.example`,
    );
    const first = await createBillingSession(owner, "pricing", req, client);
    const second = await createBillingSession(owner, "pricing", req, client);
    assert.notEqual(first, second);
    await createBillingSession(owner, "portal", req, client);
    assert.deepEqual(
      calls.map((call) => call.destination),
      ["pricing", "pricing", "portal"],
    );
    for (const call of calls) {
      assert.equal(call.user, owner);
      assert.deepEqual(call.options, {
        returnUrl: "https://localhost/billing",
        refreshUrl: "https://localhost/billing?expired=1",
        sessionDurationSeconds: 3600,
      });
    }
    await assert.rejects(
      createBillingSession("", "pricing", req, client),
      /session/,
    );
  } finally {
    process.env = prior;
  }
});

test("billing rejects unsafe hosted and return URLs and fails closed on service errors", async () => {
  const prior = { ...process.env };
  delete process.env.MONETIZATION_RETURN_ORIGIN;
  try {
    const req = request({});
    for (const pricingUrl of [
      "",
      "javascript:alert(1)",
      "http://billing.example",
      "https://user:secret@billing.example",
    ]) {
      const client = {
        createPricingSession: async () => ({ pricingUrl }),
        createBillingPortalSession: async () => {
          throw new Error("unused");
        },
      };
      await assert.rejects(
        createBillingSession(owner, "pricing", req, client),
        /could not be opened/,
      );
    }
    for (const origin of [
      "javascript:alert(1)",
      "http://public.example",
      "https://user:secret@app.example",
      "https://app.example/path",
      "https://app.example?redirect=evil",
      "invalid",
    ]) {
      process.env.MONETIZATION_RETURN_ORIGIN = origin;
      assert.throws(() => billingReturnOrigin(req), /return address/);
    }
    process.env.MONETIZATION_RETURN_ORIGIN = "https://app.example/";
    assert.equal(billingReturnOrigin(req), "https://app.example");
    delete process.env.MONETIZATION_RETURN_ORIGIN;
    assert.equal(
      billingReturnOrigin(new NextRequest("http://localhost:3000/billing")),
      "http://localhost:3000",
    );
    assert.equal(
      billingReturnOrigin(new NextRequest("http://localhost:3276/api/billing/session", {
        headers: { host: "127.0.0.1:3276", origin: "http://127.0.0.1:3276" },
      })),
      "http://127.0.0.1:3276",
    );
    const client = {
      createPricingSession: async () => {
        throw new Error("AWS unavailable");
      },
      createBillingPortalSession: async () => {
        throw new Error("unused");
      },
    };
    await assert.rejects(
      createBillingSession(owner, "pricing", req, client),
      /AWS unavailable/,
    );
    await assert.rejects(
      createBillingSession(owner, "portal", new NextRequest("http://127.0.0.1:3276/api/billing/session", {
        headers: { host: "127.0.0.1:3276" },
      }), client),
      /using localhost/,
    );
  } finally {
    process.env = prior;
  }
});

test("billing endpoint rejects cross-origin, missing identities and client-controlled billing fields", async () => {
  assert.equal(
    (
      await POST(
        request({ destination: "pricing" }, "", "https://evil.example"),
      )
    ).status,
    403,
  );
  assert.equal(
    (await POST(request({ destination: "pricing" }, ""))).status,
    401,
  );
  for (const payload of [
    { destination: "pricing", owner: "other" },
    { destination: "pricing", plan: "starter" },
    { destination: "pricing", returnUrl: "https://evil.example" },
    { destination: "unknown" },
  ])
    assert.equal((await POST(request(payload))).status, 400);
});

test("session bootstrap mints no hosted sessions; only billing clicks do, with private no-store responses", async () => {
  const prior = { ...process.env };
  const fixture = await customerFixture();
  activeCustomerToken = fixture.token;
  const originalPricing = MonetizationAI.prototype.createPricingSession;
  const originalPortal = MonetizationAI.prototype.createBillingPortalSession;
  let pricingCalls = 0;
  let portalCalls = 0;
  Object.assign(process.env, {
    MONETIZATION_ENABLED: "true",
    MONETIZATION_APP_ID:
      "arn:aws:appmonetization:us-west-2:123456789012:apps/example/sandbox",
    MONETIZATION_EVENT_TYPE: "search_completed",
    // Validation fixture only; SDK methods below never make network calls.
    MONETIZATION_ENDPOINT: "https://us-west-2.alpha.monetization.aws.dev",
    MONETIZATION_REGION: "us-west-2",
    SCAN_DB_PATH: ":memory:",
  });
  for (const key of [
    "DATABASE_URL",
    "VERCEL",
    "VERCEL_ENV",
    "MONETIZATION_RETURN_ORIGIN",
  ])
    delete process.env[key];
  MonetizationAI.prototype.createPricingSession = async (user) => {
    assert.equal(user, fixture.customer.owner);
    pricingCalls++;
    return { pricingUrl: "https://billing.example/pricing#test-token" };
  };
  MonetizationAI.prototype.createBillingPortalSession = async (user) => {
    assert.equal(user, fixture.customer.owner);
    portalCalls++;
    return {
      billingPortalUrl: "https://billing.example/portal#test-token",
      expiresAt: new Date(Date.now() + 3600_000),
    };
  };
  try {
    const overview = await GET(
      new NextRequest("https://localhost/api/session", {
        headers: { cookie: `threadfinder_session=${owner}; threadfinder_customer=${fixture.token}` },
      }),
    );
    assert.equal(overview.status, 200);
    assert.equal(overview.cookies.get("threadfinder_session")?.sameSite, "lax");
    assert.equal((await overview.json()).billingEnabled, true);
    assert.equal(pricingCalls + portalCalls, 0);
    for (const destination of ["pricing", "portal"]) {
      const response = await POST(request({ destination }));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.match(
        (await response.json()).url,
        /^https:\/\/billing\.example\//,
      );
      assert.equal(response.cookies.get("mai_pricing_url")?.value, "");
      assert.equal(response.cookies.get("mai_billing_portal_url")?.value, "");
    }
    assert.equal(pricingCalls, 1);
    assert.equal(portalCalls, 1);
    process.env.MONETIZATION_ENABLED = "false";
    assert.equal((await POST(request({ destination: "pricing" }))).status, 503);
    assert.equal(pricingCalls, 1);
  } finally {
    activeCustomerToken = "";
    fixture.restore();
    MonetizationAI.prototype.createPricingSession = originalPricing;
    MonetizationAI.prototype.createBillingPortalSession = originalPortal;
    process.env = prior;
  }
});
