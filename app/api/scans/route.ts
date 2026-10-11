import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError, liveConfig } from "@/lib/config";
import {
  attachSession,
  body,
  failure,
  json,
  newSession,
  sameOrigin,
  session,
} from "@/lib/http";
import { store } from "@/lib/store";
import { publicScan } from "@/lib/types";
export const runtime = "nodejs";
const schema = z.object({
  description: z.string().trim().min(20).max(1500),
  mode: z.enum(["sample", "live"]),
  key: z.string().uuid(),
});
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const input = schema.safeParse(await body(request));
    if (!input.success)
      throw new AppError(
        "Describe your business in 20–1,500 characters and choose a search mode.",
      );
    const owner = session(request) || newSession();
    const config = input.data.mode === "live" ? liveConfig() : undefined;
    const scan = store().create(
      owner,
      input.data.key,
      input.data.description,
      input.data.mode,
      config?.budget || 0,
      config?.hourlyBudget,
    );
    return attachSession(json(publicScan(scan), 201), owner, request);
  } catch (error) {
    return failure(error);
  }
}
