import { NextRequest } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/config";
import { body, failure, json, sameOrigin, session } from "@/lib/http";
import { store } from "@/lib/store";
import { publicScan } from "@/lib/types";
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
    return json(
      publicScan(
        await (
          await store()
        ).feedback(
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
