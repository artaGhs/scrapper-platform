import { NextRequest, NextResponse } from "next/server";
import { authConfig, customerCookie, oauthCookie } from "@/lib/customer-auth";
import { failure, sameOrigin } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    sameOrigin(request);
    const config = authConfig();
    const url = new URL(`${config.domain}/logout`);
    url.search = new URLSearchParams({ client_id: config.clientId, logout_uri: `${config.origin}/billing` }).toString();
    const response = NextResponse.redirect(url, 303);
    response.cookies.delete(customerCookie);
    response.cookies.delete(oauthCookie);
    response.cookies.delete("threadfinder_session");
    response.cookies.delete("threadfinder_developer");
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.endsWith("_session") || cookie.name.endsWith("_developer")) {
        response.cookies.delete(cookie.name);
      }
    }
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch(error) { return failure(error); }
}
