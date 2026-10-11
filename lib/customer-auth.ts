import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { NextRequest, NextResponse } from "next/server";
import { AppError } from "./config";
import { config as loadEnv } from "dotenv";

export const customerCookie = "threadfinder_customer";
export const oauthCookie = "threadfinder_oauth";
const jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export interface Customer { owner: string; email: string; expiresAt: number }

export function authConfig() {
  loadEnv({ path: ".env.monetization", quiet: true });
  const poolId = process.env.COGNITO_USER_POOL_ID || "";
  const region = poolId.split("_")[0];
  const clientId = process.env.COGNITO_CLIENT_ID || "";
  const domain = process.env.COGNITO_DOMAIN || "";
  const origin = process.env.AUTH_ORIGIN || "";
  const secret = process.env.AUTH_SESSION_SECRET || "";
  try {
    const url = new URL(domain);
    const app = new URL(origin);
    if (!/^[a-z]{2}-[a-z]+-\d+_[A-Za-z0-9]+$/.test(poolId) || !/^[a-z0-9]+$/.test(clientId) ||
      url.protocol !== "https:" || !url.hostname.endsWith(`.auth.${region}.amazoncognito.com`) ||
      url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash ||
      (app.protocol !== "https:" && !(app.protocol === "http:" && app.hostname === "localhost")) ||
      app.username || app.password || app.pathname !== "/" || app.search || app.hash || secret.length < 32)
      throw new Error();
    return { poolId, clientId, domain: url.origin, origin: app.origin, secret,
      issuer: `https://cognito-idp.${region}.amazonaws.com/${poolId}` };
  } catch { throw new AppError("Account sign-in is not configured yet.", 503); }
}

export function customerFromClaims(payload: JWTPayload): Customer {
  if (payload.token_use !== "id" || payload.email_verified !== true ||
      typeof payload.email !== "string" || !payload.sub || !payload.iss || !payload.exp)
    throw new AppError("Verify your email address before starting your trial.", 401);
  return { owner: createHash("sha256").update(`${payload.iss}:${payload.sub}`).digest("hex"),
    email: payload.email, expiresAt: payload.exp * 1000 };
}

export async function verifyCustomerToken(token: string) {
  const config = authConfig();
  let keys = jwks.get(config.issuer);
  if (!keys) { keys = createRemoteJWKSet(new URL(`${config.issuer}/.well-known/jwks.json`)); jwks.set(config.issuer, keys); }
  const { payload } = await jwtVerify(token, keys, {
    issuer: config.issuer, audience: config.clientId, algorithms: ["RS256"],
  });
  return { customer: customerFromClaims(payload), payload };
}

export async function customerSession(request: NextRequest): Promise<Customer | null> {
  const token = request.cookies.get(customerCookie)?.value;
  if (!token) return null;
  try { return (await verifyCustomerToken(token)).customer; }
  catch { return null; }
}

interface OAuthSession { state: string; verifier: string; nonce: string; next: string; expiresAt: number }
export function newOAuthSession(next: string): OAuthSession {
  return { state: randomBytes(32).toString("base64url"), verifier: randomBytes(32).toString("base64url"),
    nonce: randomBytes(32).toString("base64url"), next: next === "/" ? "/" : "/billing", expiresAt: Date.now() + 10 * 60_000 };
}
export function sealOAuth(session: OAuthSession, secret: string): string {
  const body = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}
export function readOAuth(value: string, state: string, secret: string): OAuthSession {
  try {
    const parts = value.split(".");
    if (parts.length !== 2) throw new Error();
    const [body, signature] = parts;
    const expected = createHmac("sha256", secret).update(body).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error();
    const saved = JSON.parse(Buffer.from(body, "base64url").toString()) as OAuthSession;
    if (saved.state !== state || saved.expiresAt <= Date.now() || !saved.verifier || !saved.nonce ||
      !["/", "/billing"].includes(saved.next)) throw new Error();
    return saved;
  } catch { throw new AppError("Sign-in expired. Please sign in again.", 401); }
}
export function attachCustomer(response: NextResponse, token: string, customer: Customer, origin: string) {
  response.cookies.set(customerCookie, token, { httpOnly: true, secure: origin.startsWith("https:"),
    sameSite: "lax", path: "/", maxAge: Math.max(0, Math.floor((customer.expiresAt - Date.now()) / 1000)) });
  response.cookies.delete(oauthCookie);
  return response;
}
