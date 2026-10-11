import { NextRequest } from "next/server";
import { attachSession, json, newSession, session } from "@/lib/http";
import { store } from "@/lib/store";
import { failure } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const owner = session(request) || newSession();
    const allowance = await (await store()).allowance(owner);
    return attachSession(
      json({
        ready: true,
        freeSearchUsed: allowance.used,
        freeScanId: allowance.scanId,
      }),
      owner,
      request,
    );
  } catch (error) {
    return failure(error);
  }
}
