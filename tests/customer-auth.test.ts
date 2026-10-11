import test from "node:test";
import assert from "node:assert/strict";
import {NextRequest} from "next/server";
import {SignJWT} from "jose";
import {authConfig,customerSession,customerFromClaims,newOAuthSession,sealOAuth,readOAuth} from "../lib/customer-auth";
import {customerFixture} from "./helpers/customer";

test("customer identity requires a signed, unexpired token for the configured pool and client, with verified email", async () => {
  const fixture=await customerFixture();
  const req=(token:string)=>new NextRequest("https://localhost",{headers:{cookie:`threadfinder_customer=${token}; threadfinder_session=${"f".repeat(64)}`}});
  try {
    assert.equal((await customerSession(req(fixture.token)))?.owner,fixture.customer.owner);
    assert.equal(await customerSession(req("forged")),null);
    for(const change of [{email_verified:false},{token_use:"access"},{aud:"otherclient"},{iss:"https://evil.example"},{exp:1}]) {
      const token=await new SignJWT({...fixture.claims,...change}).setProtectedHeader({alg:"RS256",kid:"customer-test"}).sign(fixture.keys.privateKey);
      assert.equal(await customerSession(req(token)),null);
    }
    assert.equal(customerFromClaims(fixture.claims).owner,fixture.customer.owner);
  } finally {fixture.restore();}
});

test("OAuth sign-in binds state and PKCE to a short-lived signed session and rejects open redirects", () => {
  const secret="test-oauth-secret-"+"x".repeat(48);
  const session=newOAuthSession("https://evil.example");
  assert.equal(session.next,"/billing");
  assert.equal(newOAuthSession("/").next,"/");
  const sealed=sealOAuth(session,secret);
  assert.deepEqual(readOAuth(sealed,session.state,secret),session);
  assert.throws(()=>readOAuth(sealed,"wrong-state",secret),/expired/);
  assert.throws(()=>readOAuth(sealed,session.state,secret+"changed"),/expired/);
  assert.throws(()=>readOAuth(sealOAuth({...session,expiresAt:1},secret),session.state,secret),/expired/);
  assert.throws(()=>readOAuth(sealOAuth({...session,next:"//evil.example"},secret),session.state,secret),/expired/);
});

test("authentication configuration rejects insecure or foreign authorization origins", async () => {
  const fixture=await customerFixture();
  try {
    assert.equal(authConfig().origin,"https://localhost");
    process.env.COGNITO_DOMAIN="https://evil.example";
    assert.throws(authConfig,/not configured/);
    process.env.COGNITO_DOMAIN="https://fixture.auth.us-east-2.amazoncognito.com";
    process.env.AUTH_ORIGIN="http://public.example";
    assert.throws(authConfig,/not configured/);
  } finally {fixture.restore();}
});
