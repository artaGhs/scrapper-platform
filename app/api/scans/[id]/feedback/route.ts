import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/config";
import { body, failure, json, sameOrigin, session } from "@/lib/http";
import { store } from "@/lib/store";
import { publicScan } from "@/lib/types";
import { developerSession } from "@/lib/developer";
export const runtime = "nodejs";
const schema = z.object({
  resultId: z.string().min(1).max(100),
  action: z.enum(["save", "irrelevant"]),
  value: z.boolean(),
});
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    sameOrigin(request);
    const owner = session(request);
    if (!owner) throw new AppError("Search not found or expired.", 404);
    const input = schema.safeParse(await body(request));
    if (!input.success)
      throw new AppError("Choose a valid result and feedback action.");
    const repository = await store();
    const scan = await repository.get((await params).id, owner);
    if (!scan) throw new AppError("Search not found or expired.", 404);
    if (
      (scan.developer || scan.mode === "sample") &&
      !developerSession(request)
    )
      throw new AppError("Enable developer mode to update this search.", 403);
    return json(
      publicScan(
        await repository.feedback(
          (await params).id,
          owner,
          input.data.resultId,
          input.data.action,
          input.data.value,
        ),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
