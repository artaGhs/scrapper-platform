import { NextRequest } from "next/server";
import { AppError } from "@/lib/config";
import { failure, json, sameOrigin, session } from "@/lib/http";
import { advance } from "@/lib/service";
import { publicScan } from "@/lib/types";
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
    return json(publicScan(await advance((await params).id, owner)));
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
    const { store } = await import("@/lib/store");
    const scan = await (await store()).get((await params).id, owner);
    if (!scan) throw new AppError("Search not found or expired.", 404);
    return json(publicScan(scan));
  } catch (error) {
    return failure(error);
  }
}
