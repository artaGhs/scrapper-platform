import { NextRequest } from "next/server";
import { attachSession, json, newSession, session } from "@/lib/http";
import { store } from "@/lib/store";
import { failure } from "@/lib/http";
import { attachDeveloper, developerSession } from "@/lib/developer";
import { billingEnabled } from "@/lib/monetize";
import { clearBillingSession } from "@/lib/monetization-session";
import { customerSession } from "@/lib/customer-auth";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const billing = billingEnabled();
    const customer = billing ? await customerSession(request) : null;
    const owner = customer?.owner || session(request) || newSession();
    const developer = developerSession(request);
    const repository = await store();
    const allowance = await repository.allowance(owner);
    const trial = billing && customer ? await repository.trial(owner) : null;
    const response = attachSession(
      json({
        ready: true,
        developer,
        billingEnabled: billing,
        billingMode: process.env.MONETIZATION_MODE === "live" ? "live" : "sandbox",
        signedIn: !!customer,
        trial: trial ? { expiresAt: trial.expiresAt, used: trial.used, available: !trial.used && trial.expiresAt > Date.now() } : null,
        freeSearchUsed: developer || customer ? false : allowance.used,
        freeScanId: developer ? null : allowance.scanId,
      }),
      owner,
      request,
    );
    if (developer) attachDeveloper(response, request, owner, true);
    return clearBillingSession(response);
  } catch (error) {
    return failure(error);
  }
}
