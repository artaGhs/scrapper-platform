import {randomBytes} from "node:crypto";
import {SignJWT,exportJWK,generateKeyPair} from "jose";
import {customerFromClaims} from "../../lib/customer-auth";
export async function customerFixture() {
  const prior = {...process.env};
  const originalFetch = globalThis.fetch;
  const poolId = `us-east-2_Test${randomBytes(4).toString("hex")}`;
  const issuer = `https://cognito-idp.us-east-2.amazonaws.com/${poolId}`;
  const clientId = "testcustomerclient";
  const keys = await generateKeyPair("RS256");
  const jwk = {...await exportJWK(keys.publicKey), kid:"customer-test", alg:"RS256", use:"sig"};
  const claims = {iss:issuer,sub:"verified-customer",email:"sandbox@example.com",email_verified:true,
    token_use:"id",aud:clientId,exp:Math.floor(Date.now()/1000)+3600};
  const token = await new SignJWT(claims).setProtectedHeader({alg:"RS256",kid:jwk.kid}).sign(keys.privateKey);
  Object.assign(process.env,{COGNITO_USER_POOL_ID:poolId,COGNITO_CLIENT_ID:clientId,
    COGNITO_DOMAIN:"https://fixture.auth.us-east-2.amazoncognito.com",AUTH_ORIGIN:"https://localhost",
    AUTH_SESSION_SECRET:"test-only-secret-"+"a".repeat(48)});
  globalThis.fetch = async (input,init) => String(input) === `${issuer}/.well-known/jwks.json`
    ? new Response(JSON.stringify({keys:[jwk]}),{headers:{"Content-Type":"application/json"}})
    : originalFetch(input,init);
  return {token,customer:customerFromClaims(claims),keys,claims,
    restore(){process.env=prior;globalThis.fetch=originalFetch;}};
}
