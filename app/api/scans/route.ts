import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError, FREE_SOURCE_BUDGET_USD, liveConfig } from "@/lib/config";
import {
  attachSession,
  clientFingerprint,
  body,
  failure,
  json,
  newSession,
  sameOrigin,
  session,
} from "@/lib/http";
import { store } from "@/lib/store";
import { publicScan, selectedSources } from "@/lib/types";
import { developerSession } from "@/lib/developer";
export const runtime = "nodejs";
const schema = z
  .object({
    description: z.string().trim().min(20).max(1500),
    mode: z.enum(["sample", "live"]),
    key: z.string().uuid(),
    sources: z
      .array(z.enum(["reddit"]))
      .min(1)
      .max(1)
      .refine((values) => new Set(values).size === values.length)
      .optional(),
  })
  .strict();
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const input = schema.safeParse(await body(request));
    if (!input.success)
      throw new AppError(
        "Describe your business in 20–1,500 characters and choose a search mode.",
      );
    const owner = session(request) || newSession();
    const developer = developerSession(request);
    if (input.data.mode === "sample" && !developer)
      throw new AppError("Sample research requires developer access.", 403);
    const repository = await store();
    const ipHash = clientFingerprint(request);
    if (!developer) await repository.throttle(ipHash);
    const sources = selectedSources(input.data.sources);
    const config = input.data.mode === "live" ? liveConfig(sources) : undefined;
    const scan = await repository.create(
      owner,
      input.data.key,
      input.data.description,
      input.data.mode,
      config ? Math.min(config.budget, FREE_SOURCE_BUDGET_USD) : 0,
      config?.hourlyBudget,
      sources,
      config
        ? { ipHash, dailyBudget: config.dailyBudget, free: true, developer }
        : developer
          ? { ipHash, dailyBudget: 0, developer: true }
          : undefined,
    );
    if (scan.developer && !developer)
      throw new AppError("Enable developer mode to reuse this run key.", 403);
    return attachSession(json(publicScan(scan), 201), owner, request);
  } catch (error) {
    return failure(error);
  }
}
