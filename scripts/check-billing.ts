import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import { config as loadEnv } from "dotenv";
import { billingConnection, billingEnabled } from "../lib/monetize";

loadEnvConfig(process.cwd());
loadEnv({ path: ".env.monetization", quiet: true });

// The SDK's config command resolves connection facts without AWS credentials
// or API requests. Do not invent an endpoint or probe other Regions.
const command = spawnSync(
  process.execPath,
  [
    join(process.cwd(), "node_modules/@aws-app-monetization/sdk/bin/cli.mjs"),
    "config",
    "--json",
  ],
  { encoding: "utf8" },
);
const blockers: string[] = [];
if (command.status !== 0) {
  blockers.push("Could not resolve the installed AWS payment SDK connection.");
} else {
  try {
    const sdk = JSON.parse(command.stdout) as {
      region: string;
      endpoint: string;
    };
    const endpointRegion = new URL(sdk.endpoint).hostname.split(".")[0];
    console.log(
      `Selected Region: us-east-2; SDK signing Region: ${sdk.region}; endpoint Region: ${endpointRegion}.`,
    );
    if (sdk.region !== process.env.MONETIZATION_REGION || sdk.endpoint !== process.env.MONETIZATION_ENDPOINT || endpointRegion !== sdk.region)
      blockers.push(
        "The configured billing connection does not match the installed SDK connection.",
      );
  } catch {
    blockers.push("The SDK returned an invalid connection descriptor.");
  }
}
try {
  billingConnection();
} catch (error) {
  blockers.push(
    error instanceof Error ? error.message : "Invalid AWS billing connection.",
  );
}

const enabled = process.env.MONETIZATION_ENABLED;
process.env.MONETIZATION_ENABLED = "true";
try {
  billingEnabled();
} catch (error) {
  blockers.push(
    error instanceof Error ? error.message : "Invalid billing configuration.",
  );
} finally {
  if (enabled === undefined) delete process.env.MONETIZATION_ENABLED;
  else process.env.MONETIZATION_ENABLED = enabled;
}

console.log(`Billing enabled: ${enabled === "true" ? "yes" : "no"}.`);
if (blockers.length) {
  console.log("Billing readiness: BLOCKED");
  for (const blocker of new Set(blockers)) console.log(`- ${blocker}`);
  process.exitCode = 1;
} else {
  console.log(
    "Local billing configuration passed. Checkout, subscription activation and metering still require AWS sandbox verification.",
  );
}
