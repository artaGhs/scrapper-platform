import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/config";
import {
  body,
  clientFingerprint,
  failure,
  json,
  sameOrigin,
  requestOwner,
} from "@/lib/http";
import {
  createBillingSession,
  clearBillingSession,
} from "@/lib/monetization-session";
import { store } from "@/lib/store";

export const runtime = "nodejs";
const schema = z
  .object({ destination: z.enum(["pricing", "portal"]) })
  .strict();

export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const owner = await requestOwner(request);
    if (!owner) throw new AppError("Sign in to choose or manage your plan.", 401);
    const input = schema.safeParse(await body(request));
    if (!input.success)
      throw new AppError("Choose plans or subscription management.");
    await (await store()).throttle(`billing:${clientFingerprint(request)}`, 10);
    const url = await createBillingSession(
      owner,
      input.data.destination,
      request,
    );
    return clearBillingSession(json({ url }));
  } catch (error) {
    return failure(error);
  }
}
