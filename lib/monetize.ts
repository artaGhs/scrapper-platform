import { MonetizationAI } from "@aws-app-monetization/sdk";
import { config as loadEnv } from "dotenv";
import { AppError } from "./config";
import { authConfig } from "./customer-auth";
import { prepareBillingCredentials } from "./billing-credentials";

let sdk: MonetizationAI | undefined;

// Sign in the payment service's Region, which may differ from the app's Region.
// The endpoint, signing Region and sandbox ARN must still agree.
export function billingConnection() {
  const region = process.env.MONETIZATION_REGION;
  const endpoint = process.env.MONETIZATION_ENDPOINT;
  if (!endpoint || !region || !/^[a-z]{2}-[a-z]+-\d+$/.test(region))
    throw new AppError(
      "Billing requires a configured AWS endpoint and signing Region.",
      503,
    );
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new AppError("The AWS billing endpoint is invalid.", 503);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    url.hostname.split(".")[0] !== region
  )
    throw new AppError(
      "The billing endpoint must match its signing Region.",
      503,
    );
  return { region, endpoint };
}

export function billingEnabled(): boolean {
  loadEnv({ path: ".env.monetization", quiet: true });
  if (process.env.MONETIZATION_ENABLED !== "true") return false;
  const live = process.env.MONETIZATION_MODE === "live";
  if (process.env.VERCEL_ENV === "production" && !live)
    throw new AppError(
      "Billing beta is available only in an evaluation environment.",
      503,
    );
  const app = /^arn:aws:appmonetization:([a-z]{2}-[a-z]+-\d+):\d{12}:apps?\/[A-Za-z0-9_-]{1,57}(\/sandbox)?$/.exec(
    process.env.MONETIZATION_APP_ID || "",
  );
  if (!app || Boolean(app[2]) === live)
    throw new AppError(
      "Billing beta requires a configured AWS sandbox app.",
      503,
    );
  if (app[1] !== billingConnection().region)
    throw new AppError("Billing beta requires a sandbox app in the signing Region.", 503);
  if (!process.env.MONETIZATION_EVENT_TYPE?.trim())
    throw new AppError("Billing beta metric has not been configured.", 503);
  if (live) {
    authConfig();
    if (process.env.MONETIZATION_LIVE_APPROVED !== "true")
      throw new AppError("Live payments have not been activated yet.", 503);
    if (process.env.VERCEL_ENV === "production" && !process.env.MONETIZATION_EXECUTION_ROLE_ARN)
      throw new AppError("Production billing requires its service execution identity.",503);
  }
  return true;
}

export function getMonetize(): MonetizationAI {
  if (!billingEnabled())
    throw new AppError("Billing beta is not configured yet.", 503);
  prepareBillingCredentials();
  return (sdk ??= new MonetizationAI({
    appId: process.env.MONETIZATION_APP_ID!,
    ...billingConnection(),
  }));
}
