// One-time deployment preparation. Loads private values directly into CLI stdin, never logs them.
import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
loadEnvConfig(process.cwd());
mkdirSync(".data", { recursive: true });
const codePath = ".data/pilot-access-code";
const code = existsSync(codePath)
  ? readFileSync(codePath, "utf8").trim()
  : randomBytes(24).toString("hex");
writeFileSync(codePath, code + "\n", { mode: 0o600 });
const values: Record<string, string> = {
  APIFY_TOKEN: process.env.APIFY_TOKEN || "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
  LIVE_ACCESS_CODE: code,
  LIVE_SCAN_BUDGET_USD: "0.08",
  LIVE_HOURLY_BUDGET_USD: "0.08",
};
for (const [name, value] of Object.entries(values)) {
  if (!value) throw new Error("Required private configuration is missing.");
  const result = spawnSync(
    "vercel",
    ["env", "add", name, "production", "--sensitive", "--yes"],
    { input: value, encoding: "utf8" },
  );
  if (result.status !== 0) {
    console.error(
      "Private environment setup failed for " + name + "; values withheld.",
    );
    process.exit(1);
  }
  console.log("Configured private production variable: " + name);
}
console.log("Pilot access code is saved only in ignored " + codePath);
