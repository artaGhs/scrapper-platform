import { AppError } from "./config";
import { getMonetize } from "./monetize";
import type { Scan } from "./types";
import type { MonetizationAI } from "@aws-app-monetization/sdk";
import type { TrialAllowance } from "./store";

type BillingClient = Pick<MonetizationAI, "checkEntitlement" | "putEvent" | "flush">;

export async function searchAccess(owner: string, trial: TrialAllowance,
  client?: Pick<MonetizationAI, "getSubscription" | "checkEntitlement">) {
  const billing = client ?? getMonetize();
  let planId: string | undefined;
  try { planId = (await billing.getSubscription(owner)).subscription?.planId; }
  catch(error) {
    // An absent subscription is normal for a new trial; transport/permission failures are not.
    if (!(error instanceof Error) || error.name !== "ResourceNotFoundException") throw error;
  }
  const paid = [process.env.MONETIZATION_STARTER_PLAN_ID, process.env.MONETIZATION_PRO_PLAN_ID].filter(Boolean);
  if (planId && paid.includes(planId)) {
    const eventType = process.env.MONETIZATION_EVENT_TYPE!;
    const decision = await billing.checkEntitlement(owner, { eventType });
    if (decision.decision !== "ALLOW") throw new AppError("Your plan's search allowance has been used. Manage your plan in Billing.", 403);
    return { free: false, fullResults: true, billingEventType: eventType };
  }
  if (trial.expiresAt <= Date.now() || trial.used)
    throw new AppError("Your trial is complete. Choose Starter or Pro in Billing to continue.", 403);
  return { free: true, fullResults: true, trialExpiresAt: trial.expiresAt, billingEventType: undefined };
}

export async function requireSearchEntitlement(owner: string, client?: BillingClient) {
  if (!owner) throw new AppError("A browser session is required.", 401);
  const eventType = process.env.MONETIZATION_EVENT_TYPE!;
  const result = await (client ?? getMonetize()).checkEntitlement(owner, { eventType });
  if (result.decision !== "ALLOW")
    throw new AppError("Choose a plan in Billing, or wait for your search allowance to renew.", 403);
  return eventType;
}

export async function recordScanUsage(scan: Scan, client?: BillingClient) {
  if (!scan.billingEventType || scan.mode !== "live" ||
      !["complete", "empty", "partial"].includes(scan.stage)) return;
  const billing = client ?? getMonetize();
  await billing.putEvent(scan.owner, {
    eventType: scan.billingEventType,
    quantity: "1",
    clientToken: scan.id,
    timestamp: new Date(scan.createdAt).toISOString(),
  });
  await billing.flush();
}
