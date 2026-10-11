import { NextRequest } from "next/server";
import { attachSession, json, newSession, session } from "@/lib/http";
import { store } from "@/lib/store";
import { failure } from "@/lib/http";
import { developerSession } from "@/lib/developer";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const owner = session(request) || newSession();
    const developer = developerSession(request);
    const allowance = await (await store()).allowance(owner);
    return attachSession(
      json({
        ready: true,
        developer,
        freeSearchUsed: developer ? false : allowance.used,
        freeScanId: developer ? null : allowance.scanId,
      }),
      owner,
      request,
    );
  } catch (error) {
    return failure(error);
  }
}
