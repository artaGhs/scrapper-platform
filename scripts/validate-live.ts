import { loadEnvConfig } from "@next/env";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { ScanStore } from "../lib/sqlite-store";
import { RedditProvider } from "../lib/provider";
import { advance } from "../lib/service";
import { terminalStages } from "../lib/types";

async function main() {
  // Explicit one-run validation only. Re-running resumes the persisted scan, never starts a second one.
  loadEnvConfig(process.cwd());
  if (!process.argv.includes("--confirm-live"))
    throw new Error(
      "Pass --confirm-live only with authorization for this bounded validation.",
    );
  if (!process.env.APIFY_TOKEN) throw new Error("APIFY_TOKEN is missing.");
  mkdirSync(".data", { recursive: true });
  const db = new ScanStore(".data/live-validation.sqlite");
  const provider = new RedditProvider(process.env.APIFY_TOKEN, 0.08, fetch, 15);
  const marker = ".data/live-validation-id";
  let scan = existsSync(marker)
    ? db.get(readFileSync(marker, "utf8").trim(), "local-validation")
    : null;
  if (!scan) {
    scan = db.create(
      "local-validation",
      randomUUID(),
      "Our app estimates calories from food photos instead of manual ingredient logging.",
      "live",
      0.08,
      0.08,
    );
    writeFileSync(marker, scan.id, { mode: 0o600 });
  }
  try {
    while (!terminalStages.includes(scan.stage)) {
      scan = await advance(scan.id, "local-validation", db, provider);
      console.log("Validation stage: " + scan.stage);
      if (scan.stage === "searching")
        await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    const summary = {
      checkedAt: new Date().toISOString(),
      stage: scan.stage,
      maximumRecords: 15,
      maximumChargeUsd: 0.08,
      actualProviderChargeUsd: scan.actualUsd ?? null,
      returnedRecords: scan.retrieved ?? null,
      qualifiedMatches: scan.results.length,
      error: scan.error ?? null,
      notice: scan.notice ?? null,
      links: scan.results.map((result) => ({
        url: result.url,
        publishedAt: result.publishedAt,
      })),
    };
    writeFileSync(
      ".data/live-validation-summary.json",
      JSON.stringify(summary, null, 2),
      { mode: 0o600 },
    );
    console.log(JSON.stringify(summary));
  } finally {
    db.close();
  }
}
void main().catch(() => {
  console.error(
    "Validation could not complete; inspect safe local state before retrying.",
  );
  process.exitCode = 1;
});
