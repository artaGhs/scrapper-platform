import { NextRequest } from "next/server";
import { attachSession, json, newSession, session } from "@/lib/http";
export const runtime = "nodejs";
export function GET(request: NextRequest) {
  return attachSession(
    json({ ready: true }),
    session(request) || newSession(),
    request,
  );
}
