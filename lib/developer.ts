import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { session } from "./http";

const cookieName = "scrapper_developer";
const lifetime = 7 * 86400;
function key() {
  const value = process.env.DEVELOPER_ACCESS_KEY?.trim();
  return value && value.length >= 32 ? value : null;
}
export function validDeveloperKey(value: string): boolean {
  const expected = key();
  return (
    !!expected &&
    timingSafeEqual(
      createHash("sha256").update(value).digest(),
      createHash("sha256").update(expected).digest(),
    )
  );
}
function signature(owner: string, expires: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`developer:${owner}:${expires}`)
    .digest("hex");
}
export function developerSession(request: NextRequest): boolean {
  const secret = key(),
    owner = session(request);
  const token = request.cookies.get(cookieName)?.value;
  if (!secret || !owner || !token) return false;
  const parts = /^(\d{13})\.([a-f0-9]{64})$/.exec(token);
  if (
    !parts ||
    Number(parts[1]) <= Date.now() ||
    Number(parts[1]) > Date.now() + lifetime * 1000
  )
    return false;
  return timingSafeEqual(
    Buffer.from(parts[2], "hex"),
    Buffer.from(signature(owner, parts[1], secret), "hex"),
  );
}
export function attachDeveloper(
  response: NextResponse,
  request: NextRequest,
  owner: string,
  enabled: boolean,
) {
  const expires = String(Date.now() + lifetime * 1000);
  const secret = key();
  response.cookies.set(
    cookieName,
    enabled && secret ? `${expires}.${signature(owner, expires, secret)}` : "",
    {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "strict",
      path: "/",
      maxAge: enabled ? lifetime : 0,
    },
  );
  return response;
}
