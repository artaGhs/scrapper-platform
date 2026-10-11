import { NextRequest } from "next/server";
import { AppError } from "@/lib/config";
import {
  clientFingerprint,
  failure,
  json,
  sameOrigin,
  requestOwner,
} from "@/lib/http";
import { store } from "@/lib/store";
import { advance } from "@/lib/service";
import { publicScan } from "@/lib/types";
import { developerSession } from "@/lib/developer";
import { recordScanUsage } from "@/lib/billing";
import { customerSession } from "@/lib/customer-auth";
export const runtime = "nodejs";
export const maxDuration = 180;
// POST advances state; polling GET must not cause side effects or provider spending.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    const owner = await requestOwner(request);
    if (!owner) throw new AppError("Search not found or expired.", 404);
    const repository = await store();
    const developer = developerSession(request);
    const existing = await repository.get((await params).id, owner);
    if (existing?.fullResults && (await customerSession(request))?.owner !== owner)
      throw new AppError("Sign in to access this search.", 401);
    if (existing?.trialExpiresAt && existing.trialExpiresAt <= Date.now() && !existing.startAttempted)
      throw new AppError("Your trial has expired. Choose a plan in Billing before starting another search.", 403);
    if ((existing?.developer || existing?.mode === "sample") && !developer)
      throw new AppError("Enable developer mode to continue this search.", 403);
    if (!developer)
      await repository.throttle(`advance:${clientFingerprint(request)}`, 90);
    const scan = await advance((await params).id, owner, repository);
    await recordScanUsage(scan);
    return json(publicScan(scan));
  } catch (error) {
    return failure(error);
  }
}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const owner = await requestOwner(request);
    if (!owner) throw new AppError("Search not found or expired.", 404);
    const scan = await (await store()).get((await params).id, owner);
    if (!scan) throw new AppError("Search not found or expired.", 404);
    if (scan.fullResults && (await customerSession(request))?.owner !== owner)
      throw new AppError("Sign in to access this search.", 401);
    if (
      (scan.developer || scan.mode === "sample") &&
      !developerSession(request)
    )
      throw new AppError("Enable developer mode to view this search.", 403);
    return json(publicScan(scan));
  } catch (error) {
    return failure(error);
  }
}
