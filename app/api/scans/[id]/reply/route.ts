import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/config";
import { developerSession } from "@/lib/developer";
import {
  body,
  clientFingerprint,
  failure,
  json,
  sameOrigin,
  session,
} from "@/lib/http";
import { suggestedReply } from "@/lib/reply";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 45;
const schema = z.object({ resultId: z.string().min(1).max(200) }).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    const owner = session(request);
    if (!owner) throw new AppError("Search not found or expired.", 404);
    const input = schema.safeParse(await body(request));
    if (!input.success) throw new AppError("Choose a valid Reddit result.");
    const repository = await store();
    const { id } = await params;
    const scan = await repository.get(id, owner);
    if (!scan) throw new AppError("Search not found or expired.", 404);
    if (
      (scan.developer || scan.mode === "sample") &&
      !developerSession(request)
    )
      throw new AppError(
        "Enable developer mode to draft for this search.",
        403,
      );
    await repository.throttle(`reply:${clientFingerprint(request)}`, 12);
    return json({
      reply: await suggestedReply(id, owner, input.data.resultId, repository),
    });
  } catch (error) {
    return failure(error);
  }
}
