import { loadEnvConfig } from "@next/env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { ScanStore } from "../lib/sqlite-store";
import { RedditProvider } from "../lib/provider";
import { advance } from "../lib/service";
import { isDiscussionRecord, normalize, originalUrl } from "../lib/discovery";
import { terminalStages } from "../lib/types";
loadEnvConfig(process.cwd());
const previousSummary = ".data/live-validation-summary.json";
const corrected = process.argv.includes("--case=minimum-ten");
const prefix = corrected
  ? ".data/retrieval-ten-validation"
  : ".data/retrieval-validation";
const marker = prefix + "-id";
const owner = "retrieval-validation";
const cap = corrected ? 0.08 : 0.05;
const maximumRecords = corrected ? 10 : 5;
async function main() {
  if (!process.argv.includes("--confirm-live") || !process.env.APIFY_TOKEN)
    throw new Error("Validation is not authorized or configured.");
  if (!existsSync(previousSummary))
    throw new Error("Prior spend is unavailable.");
  const first = JSON.parse(readFileSync(previousSummary, "utf8"));
  const priorCosts = [first.actualProviderChargeUsd];
  if (corrected) {
    const prior = JSON.parse(
      readFileSync(".data/retrieval-validation-summary.json", "utf8"),
    );
    priorCosts.push(prior.actualProviderChargeUsd);
  }
  if (
    priorCosts.some(
      (cost) => typeof cost !== "number" || !Number.isFinite(cost) || cost < 0,
    )
  )
    throw new Error("Prior spend cannot be confirmed.");
  const priorTotal = priorCosts.reduce((total, cost) => total + cost, 0);
  if (priorTotal + cap > 1)
    throw new Error("Total validation budget cannot be confirmed.");
  mkdirSync(".data", { recursive: true });
  const db = new ScanStore(prefix + ".sqlite");
  const provider = new RedditProvider(
    process.env.APIFY_TOKEN,
    cap,
    fetch,
    maximumRecords,
  );
  let scan = existsSync(marker)
    ? db.get(readFileSync(marker, "utf8").trim(), owner)
    : null;
  if (existsSync(marker) && !scan)
    throw new Error(
      "The recorded validation is unavailable; no new job will be started.",
    );
  if (!scan) {
    scan = db.create(
      owner,
      randomUUID(),
      "Our website uptime monitor alerts teams when a site goes down.",
      "live",
      cap,
      cap,
    );
    writeFileSync(marker, scan.id, { mode: 0o600 });
  }
  try {
    while (!terminalStages.includes(scan.stage)) {
      scan = await advance(scan.id, owner, db, provider);
      // One deliberately narrow software recommendation query; no model calls in this source-only check.
      if (scan.stage === "preparing") {
        scan.business!.queries = ["uptime monitor recommendation"];
        db.save(scan);
      }
      console.log("Retrieval validation stage: " + scan.stage);
      if (scan.stage === "searching")
        await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    const records = scan.datasetId ? await provider.items(scan.datasetId) : [];
    writeFileSync(prefix + "-dataset.json", JSON.stringify(records, null, 2), {
      mode: 0o600,
    });
    const accepted = normalize(records);
    const summary = {
      checkedAt: new Date().toISOString(),
      stage: scan.stage,
      maximumRecords,
      maximumChargeUsd: cap,
      query: "uptime monitor recommendation",
      actualProviderChargeUsd: scan.actualUsd ?? null,
      totalSourceValidationUsd:
        typeof scan.actualUsd === "number" ? priorTotal + scan.actualUsd : null,
      returnedRecords: records.length,
      discussionRecords: records.filter(isDiscussionRecord).length,
      normalizedRecords: accepted.length,
      qualifiedMatches: scan.results.length,
      error: scan.error ?? null,
      notice: scan.notice ?? null,
      provenance: accepted.map((item) => ({
        url: originalUrl(item.url),
        publishedAt: item.publishedAt,
        title: item.title,
        textLength: item.text.length,
      })),
      returnedRecordTypes: records.map(
        (record) => (record as Record<string, unknown>).dataType || "unknown",
      ),
    };
    writeFileSync(prefix + "-summary.json", JSON.stringify(summary, null, 2), {
      mode: 0o600,
    });
    console.log(JSON.stringify(summary));
  } finally {
    db.close();
  }
}
main().catch(() => {
  console.error(
    "Retrieval validation failed; private details withheld and no automatic new run.",
  );
  process.exitCode = 1;
});
