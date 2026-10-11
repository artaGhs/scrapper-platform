import type { NextRequest, NextResponse } from "next/server";
import type { MonetizationAI } from "@aws-app-monetization/sdk";
import { getMonetize } from "./monetize";
import { AppError } from "./config";

type SessionClient = Pick<
  MonetizationAI,
  "createPricingSession" | "createBillingPortalSession"
>;
export type BillingDestination = "pricing" | "portal";
const cookieNames = ["mai_pricing_url", "mai_billing_portal_url"] as const;

export function billingReturnOrigin(request: NextRequest): string {
  try {
    const url = new URL(
      process.env.MONETIZATION_RETURN_ORIGIN ||
        `${request.nextUrl.protocol}//${request.headers.get("host") || request.nextUrl.host}`,
    );
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (
      (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error("Invalid origin");
    return url.origin;
  } catch {
    throw new AppError("The billing return address is invalid.", 503);
  }
}

// Mint a fresh session after a billing button click. The browser cannot supply
// an owner, plan, return URL, or reuse an old hosted-session cookie.
export async function createBillingSession(
  owner: string,
  destination: BillingDestination,
  request: NextRequest,
  client?: SessionClient,
): Promise<string> {
  if (!owner) throw new AppError("A browser session is required.", 401);
  const origin = billingReturnOrigin(request);
  // The beta service's request filter rejects numeric loopback return URLs.
  if (new URL(origin).hostname === "127.0.0.1")
    throw new AppError(
      "Open this app using localhost to use AWS sandbox billing.",
      503,
    );
  const options = {
    returnUrl: `${origin}/billing`,
    refreshUrl: `${origin}/billing?expired=1`,
    sessionDurationSeconds: 60 * 60,
  };
  const billing = client ?? getMonetize();
  const value =
    destination === "pricing"
      ? (await billing.createPricingSession(owner, options)).pricingUrl
      : (await billing.createBillingPortalSession(owner, options))
          .billingPortalUrl;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("Invalid hosted URL");
    return url.href;
  } catch {
    throw new AppError("Billing session could not be opened.", 503);
  }
}

export function clearBillingSession(response: NextResponse) {
  for (const name of cookieNames) response.cookies.delete(name);
  return response;
}
