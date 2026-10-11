import {mkdtempSync,writeFileSync,renameSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {getVercelOidcTokenSync} from "@vercel/oidc";
import {AppError} from "./config";

let directory: string | undefined;
// This SDK uses the default AWS credential chain. Feed it a renewable web-identity
// token instead of the unrelated Lambda credentials supplied by the hosting platform.
export function prepareBillingCredentials() {
  const role = process.env.MONETIZATION_EXECUTION_ROLE_ARN;
  if (!role) return;
  if (!/^arn:aws:iam::\d{12}:role\/[A-Za-z0-9_+=,.@/-]+$/.test(role))
    throw new AppError("Billing execution identity is invalid.",503);
  const token = getVercelOidcTokenSync();
  directory ??= mkdtempSync(join(tmpdir(),"threadfinder-billing-"));
  const path = join(directory,"identity.jwt");
  const pending = join(directory,"identity.pending");
  writeFileSync(pending,token,{mode:0o600});
  renameSync(pending,path);
  for(const key of ["AWS_ACCESS_KEY_ID","AWS_SECRET_ACCESS_KEY","AWS_SESSION_TOKEN","AWS_PROFILE"])
    delete process.env[key];
  process.env.AWS_ROLE_ARN = role;
  process.env.AWS_WEB_IDENTITY_TOKEN_FILE = path;
  process.env.AWS_REGION = process.env.COGNITO_USER_POOL_ID!.split("_")[0];
}
