import { NextRequest, NextResponse } from "next/server";
import { authConfig, attachCustomer, oauthCookie, readOAuth, verifyCustomerToken } from "@/lib/customer-auth";
import { AppError } from "@/lib/config";
import { attachSession, failure } from "@/lib/http";
import { store } from "@/lib/store";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const config = authConfig();
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state") || "";
    const saved = readOAuth(request.cookies.get(oauthCookie)?.value || "", state, config.secret);
    if (!code) throw new AppError("Sign-in was not completed. Please try again.", 401);
    const exchanged = await fetch(`${config.domain}/oauth2/token`, { method: "POST", cache: "no-store",
      signal: AbortSignal.timeout(15_000), headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", client_id: config.clientId,
        code, redirect_uri: `${config.origin}/api/auth/callback`, code_verifier: saved.verifier }) });
    if (!exchanged.ok) throw new AppError("Sign-in could not be completed. Please try again.", 401);
    const data = await exchanged.json();
    if (typeof data.id_token !== "string") throw new AppError("Sign-in could not be verified.", 401);
    const { customer, payload } = await verifyCustomerToken(data.id_token);
    if (payload.nonce !== saved.nonce) throw new AppError("Sign-in could not be verified.", 401);
    await (await store()).trial(customer.owner);
    const response = attachCustomer(attachSession(NextResponse.redirect(`${config.origin}${saved.next}`),
      customer.owner, request), data.id_token, customer, config.origin);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch(error) { const response = failure(error); response.cookies.delete(oauthCookie); return response; }
}
