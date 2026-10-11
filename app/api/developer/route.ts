import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/config";
import { attachDeveloper, validDeveloperKey } from "@/lib/developer";
import {
  attachSession,
  body,
  clientFingerprint,
  failure,
  json,
  newSession,
  sameOrigin,
  session,
} from "@/lib/http";
import { store } from "@/lib/store";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    await (
      await store()
    ).throttle(`developer-login:${clientFingerprint(request)}`, 10);
    const input = z
      .object({ key: z.string().min(32).max(256) })
      .strict()
      .safeParse(await body(request));
    if (!input.success || !validDeveloperKey(input.data.key))
      throw new AppError(
        "Developer access key is incorrect or access is disabled.",
        401,
      );
    const owner = session(request) || newSession();
    return attachDeveloper(
      attachSession(json({ developer: true }), owner, request),
      request,
      owner,
      true,
    );
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    sameOrigin(request);
    return attachDeveloper(
      json({ developer: false }),
      request,
      session(request) || "",
      false,
    );
  } catch (error) {
    return failure(error);
  }
}
