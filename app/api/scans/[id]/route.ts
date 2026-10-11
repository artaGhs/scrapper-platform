import { NextRequest } from "next/server";
import { AppError } from "@/lib/config";
import {
  clientFingerprint,
  failure,
  json,
  sameOrigin,
  session,
} from "@/lib/http";
import { store } from "@/lib/store";
import { advance } from "@/lib/service";
import { publicScan } from "@/lib/types";
import { developerSession } from "@/lib/developer";
export const runtime = "nodejs";
export const maxDuration = 30;
// POST advances state; polling GET must not cause side effects or provider spending.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    const owner = session(request);
    if (!owner) throw new AppError("Search not found or expired.", 404);
    const repository = await store();
    const developer = developerSession(request);
    const existing = await repository.get((await params).id, owner);
    if (existing?.developer && !developer)
      throw new AppError("Enable developer mode to continue this search.", 403);
    if (!developer)
      await repository.throttle(`advance:${clientFingerprint(request)}`, 90);
    return json(
      publicScan(await advance((await params).id, owner, repository)),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const owner = session(request);
    if (!owner) throw new AppError("Search not found or expired.", 404);
    const scan = await (await store()).get((await params).id, owner);
    if (!scan) throw new AppError("Search not found or expired.", 404);
    return json(publicScan(scan));
  } catch (error) {
    return failure(error);
  }
}
