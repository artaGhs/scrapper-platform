import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authConfig, newOAuthSession, oauthCookie, sealOAuth } from "@/lib/customer-auth";
import { failure } from "@/lib/http";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const config = authConfig();
    const saved = newOAuthSession(request.nextUrl.searchParams.get("next") || "/billing");
    const url = new URL(`${config.domain}/oauth2/authorize`);
    url.search = new URLSearchParams({ response_type: "code", client_id: config.clientId,
      redirect_uri: `${config.origin}/api/auth/callback`, scope: "openid email",
      state: saved.state, nonce: saved.nonce, code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(saved.verifier).digest("base64url") }).toString();
    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(oauthCookie, sealOAuth(saved, config.secret), { httpOnly: true,
      secure: config.origin.startsWith("https:"), sameSite: "lax", path: "/", maxAge: 600 });
    return response;
  } catch(error) { return failure(error); }
}
