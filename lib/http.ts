import { randomBytes, createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { AppError } from "./config";
const cookieName = "scrapper_session";
export function session(request: NextRequest): string | null {
  const value = request.cookies.get(cookieName)?.value;
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export function newSession(): string {
  return randomBytes(32).toString("hex");
}
export function attachSession(
  response: NextResponse,
  owner: string,
  request: NextRequest,
): NextResponse {
  response.cookies.set(cookieName, owner, {
    httpOnly: true,
    sameSite: "strict",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 30 * 86400,
  });
  return response;
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function failure(error: unknown) {
  const response = json(
    {
      error:
        error instanceof AppError
          ? error.message
          : "The request could not be completed. Try again.",
    },
    error instanceof AppError ? error.status : 500,
  );
  if (error instanceof AppError && error.status === 429)
    response.headers.set("Retry-After", "60");
  return response;
}
export function sameOrigin(request: NextRequest) {
  const expectedOrigin = `${request.nextUrl.protocol}//${request.headers.get("host") || request.nextUrl.host}`;
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== expectedOrigin
  )
    throw new AppError("Cross-origin requests are not supported.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new AppError("Cross-origin requests are not supported.", 403);
}
export async function body(request: NextRequest): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError("Send a JSON request.", 415);
  // Bound streamed bodies too; Content-Length alone is not trustworthy.
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("The request body is empty.");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 8192) {
      await reader.cancel();
      throw new AppError("The request is too large.", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("The request contains invalid JSON.");
  }
}
export function clientFingerprint(request: NextRequest): string {
  // Vercel overwrites this header with the connecting client IP. Locally all
  // requests share one bucket; never accept arbitrary client identity headers.
  const ip = process.env.VERCEL
    ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
    : "local";
  return createHmac("sha256", process.env.APIFY_TOKEN || "local-only")
    .update(ip)
    .digest("hex");
}
