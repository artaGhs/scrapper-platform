// Explicit setup only: existing production credentials and budgets are preserved.
import { loadEnvConfig } from "@next/env";
import { spawnSync } from "node:child_process";
loadEnvConfig(process.cwd());
const existing = spawnSync(
  "vercel",
  ["env", "ls", "production", "--format=json"],
  { encoding: "utf8" },
);
if (existing.status !== 0)
  throw new Error("Could not inspect private production configuration.");
const names = new Set(
  (JSON.parse(existing.stdout).envs as { key: string }[]).map(
    (item) => item.key,
  ),
);
const values: Record<string, string> = {
  APIFY_TOKEN: process.env.APIFY_TOKEN || "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
  LIVE_SCAN_BUDGET_USD: process.env.LIVE_SCAN_BUDGET_USD || "0",
  LIVE_HOURLY_BUDGET_USD: process.env.LIVE_HOURLY_BUDGET_USD || "0.08",
  LIVE_DAILY_BUDGET_USD: process.env.LIVE_DAILY_BUDGET_USD || "0.08",
};
for (const [name, value] of Object.entries(values)) {
  if (names.has(name)) {
    console.log("Retained private production variable: " + name);
    continue;
  }
  if (!value) throw new Error("Required private configuration is missing.");
  const result = spawnSync(
    "vercel",
    ["env", "add", name, "production", "--sensitive", "--yes"],
    { input: value, encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(
      "Private environment setup failed for " + name + "; values withheld.",
    );
  console.log("Configured private production variable: " + name);
}
