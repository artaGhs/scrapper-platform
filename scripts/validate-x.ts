import { loadEnvConfig } from "@next/env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { ScanStore } from "../lib/sqlite-store";
import { XProvider } from "../lib/x-provider";
import { advance } from "../lib/service";
import { normalize, rank } from "../lib/discovery";
import { terminalStages } from "../lib/types";
loadEnvConfig(process.cwd());
async function main() {
  const token = process.env.APIFY_TOKEN;
  if (!process.argv.includes("--confirm-live") || !token)
    throw Error("Not authorized/configured");
  const cap = 0.08;
  if (cap > 0.25) throw Error("Validation cap exceeded");
  mkdirSync(".data", { recursive: true });
  const marker = ".data/x-validation-id";
  const db = new ScanStore(".data/x-validation.sqlite");
  const owner = "x-validation";
  const provider = new XProvider(token, cap);
  try {
    let scan = existsSync(marker)
      ? db.get(readFileSync(marker, "utf8").trim(), owner)
      : null;
    if (existsSync(marker) && !scan)
      throw Error("Existing validation unavailable; no new run");
    if (!scan) {
      // Read-only entitlement/pricing checks before the sole authorized job.
      const api = async (path: string) => {
        const response = await fetch(`https://api.apify.com/v2/${path}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw Error("Entitlement unavailable");
        return (await response.json()).data;
      };
      const account = await api("users/me");
      const actor = await api("acts/apidojo~twitter-scraper-lite");
      const prior = await api(
        "acts/apidojo~twitter-scraper-lite/runs?limit=100&desc=true",
      );
      const month = new Date().toISOString().slice(0, 7);
      const monthRuns = prior.items.filter(
        (run: { startedAt: string }) => run.startedAt.slice(0, 7) === month,
      ).length;
      const pricing = actor.pricingInfos
        .filter(
          (price: { startedAt: string }) =>
            Date.parse(price.startedAt) <= Date.now(),
        )
        .at(-1);
      const events = pricing.pricingPerEvent.actorChargeEvents;
      const tier = account.plan.tier;
      const queryPrice =
        events["list-query"].eventTieredPricingUsd?.[tier]
          ?.tieredEventPriceUsd ?? events["list-query"].eventPriceUsd;
      const itemPrice =
        events["dataset-item-tier-one"].eventTieredPricingUsd?.[tier]
          ?.tieredEventPriceUsd ??
        events["dataset-item-tier-one"].eventPriceUsd;
      if (
        typeof queryPrice !== "number" ||
        typeof itemPrice !== "number" ||
        queryPrice + 10 * itemPrice > cap ||
        pricing.minimalMaxTotalChargeUsd > cap ||
        (tier === "FREE" && monthRuns >= 5)
      )
        throw Error(
          "Account pricing/quota does not fit the authorized validation",
        );
      writeFileSync(
        ".data/x-validation-entitlement.json",
        JSON.stringify(
          {
            checkedAt: new Date().toISOString(),
            tier,
            monthRuns,
            queryPrice,
            itemPrice,
            minimumCap: pricing.minimalMaxTotalChargeUsd,
            maximumChargeUsd: cap,
          },
          null,
          2,
        ),
        { mode: 0o600 },
      );
      scan = db.create(
        owner,
        randomUUID(),
        "Our website uptime monitor alerts teams when a site goes down.",
        "live",
        cap,
        cap,
        ["x"],
      );
      writeFileSync(marker, scan.id, { mode: 0o600, flag: "wx" });
    }
    while (!terminalStages.includes(scan.stage)) {
      scan = await advance(scan.id, owner, db, { x: provider });
      console.log(`X validation stage: ${scan.stage}`);
      if (scan.stage === "searching")
        await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    const source = scan.sourceRuns?.[0];
    if (source?.runId) {
      const final = await provider.poll(source.runId);
      if (
        typeof final.usageTotalUsd === "number" &&
        Number.isFinite(final.usageTotalUsd)
      ) {
        source.actualUsd = final.usageTotalUsd;
        scan.actualUsd = final.usageTotalUsd;
        db.save(scan);
      }
    }
    const raw = source?.datasetId ? await provider.items(source.datasetId) : [];
    writeFileSync(
      ".data/x-validation-dataset.json",
      JSON.stringify(raw, null, 2),
      { mode: 0o600 },
    );
    const items = normalize(raw, Date.now(), "x");
    const summary = {
      checkedAt: new Date().toISOString(),
      stage: scan.stage,
      sourceStatus: source?.status,
      maximumRecords: 10,
      maximumChargeUsd: cap,
      query: source?.queries?.[0],
      actualProviderChargeUsd: scan.actualUsd ?? null,
      returnedRecords: raw.length,
      normalizedRecords: items.length,
      qualifiedMatches: rank(items, scan.business!).length,
      error: scan.error ?? null,
      provenance: items.map((item) => ({
        url: item.url,
        publishedAt: item.publishedAt,
        textLength: item.text.length,
      })),
    };
    writeFileSync(
      ".data/x-validation-summary.json",
      JSON.stringify(summary, null, 2),
      { mode: 0o600 },
    );
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    db.close();
  }
}
main().catch(() => {
  console.error(
    "X validation stopped; private details withheld. No automatic new run.",
  );
  process.exitCode = 1;
});
