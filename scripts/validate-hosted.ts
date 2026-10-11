import { loadEnvConfig } from "@next/env";
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PostgresStore } from "../lib/postgres-store";
import { terminalStages, type PublicScan } from "../lib/types";

// Authorized release verification only: at most three $0.08 reservations ($0.24 total).
async function main() {
  loadEnvConfig(process.cwd());
  if (!process.argv.includes("--confirm-live"))
    throw Error("Explicit live authorization is required.");
  const name =
    process.argv.find((arg) => arg.startsWith("--case="))?.slice(7) || "food";
  if (!["food", "food-correction", "uptime"].includes(name))
    throw Error("Unknown validation case.");
  const base = "https://scrapper-platform-khaki.vercel.app";
  const description =
    name === "uptime"
      ? "Our website uptime monitor sends a Slack alert when a site goes down, so small teams notice downtime quickly."
      : "Our app estimates calories from a food photo, so people can track meals without manually entering every ingredient.";
  mkdirSync(".data", { recursive: true });
  const ledgerPath = ".data/hosted-release-ledger.json";
  const ledger: Record<
    string,
    { reservationUsd: number; scanId?: string; started: string }
  > = existsSync(ledgerPath)
    ? JSON.parse(readFileSync(ledgerPath, "utf8"))
    : {};
  const privateWrite = (path: string, value: unknown) =>
    writeFileSync(path, JSON.stringify(value, null, 2), { mode: 0o600 });
  const statePath = `.data/hosted-release-${name}-browser.json`;
  if (ledger[name] && (!ledger[name].scanId || !existsSync(statePath)))
    throw Error(
      "Uncertain earlier submission; inspect private state. No replacement job was started.",
    );
  if (!ledger[name]) {
    const reserved = Object.values(ledger).reduce(
      (sum, entry) => sum + entry.reservationUsd,
      0,
    );
    if (reserved + 0.08 > 0.25)
      throw Error("Additional provider cap reached; no job was started.");
    ledger[name] = { reservationUsd: 0.08, started: new Date().toISOString() };
    privateWrite(ledgerPath, ledger);
  }
  const browser = await chromium.launch();
  const context = await browser.newContext(
    existsSync(statePath) ? { storageState: statePath } : {},
  );
  const page = await context.newPage();
  let scan: PublicScan | undefined;
  try {
    if (!ledger[name].scanId) {
      await page.goto(base);
      await page
        .getByLabel("What do you offer, and who is it for?")
        .fill(description);
      await page.getByLabel("Live search", { exact: true }).check();
      await page
        .getByLabel("Pilot access code", { exact: true })
        .fill(readFileSync(".data/pilot-access-code", "utf8").trim());
      const created = page.waitForResponse(
        (response) =>
          response.url() === `${base}/api/scans` &&
          response.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Run search", exact: true })
        .click();
      const response = await created;
      if (response.status() !== 201)
        throw Error("Hosted creation failed; no replacement submitted.");
      scan = (await response.json()) as PublicScan;
      ledger[name].scanId = scan.id;
      privateWrite(ledgerPath, ledger);
      privateWrite(statePath, await context.storageState());
    } else {
      await page.goto(base);
      await page.evaluate(
        (id) => localStorage.setItem("scrapper-scan", JSON.stringify({ id })),
        ledger[name].scanId!,
      );
      await page.reload();
    }
    const id = ledger[name].scanId!;
    const deadline = Date.now() + 270_000;
    let lastStage = "";
    while (Date.now() < deadline) {
      const response = await context.request.get(`${base}/api/scans/${id}`);
      if (!response.ok())
        throw Error("Hosted scan unavailable; no replacement submitted.");
      scan = (await response.json()) as PublicScan;
      privateWrite(`.data/hosted-release-${name}-scan.json`, scan);
      if (scan.stage !== lastStage) {
        console.log(`Hosted ${name}: ${scan.stage}`);
        lastStage = scan.stage;
      }
      if (terminalStages.includes(scan.stage)) break;
      await page.waitForTimeout(2500);
    }
    if (!scan || !terminalStages.includes(scan.stage))
      throw Error("Hosted deadline reached; preserve scan for inspection.");
    await page.reload();
    await page.locator(".results-heading").waitFor();
    await page.screenshot({
      path: `.data/hosted-release-${name}.png`,
      fullPage: true,
    });
    if (scan.results.length) {
      await page
        .locator("article")
        .first()
        .getByRole("button", { name: "Save", exact: true })
        .click();
      await page.reload();
      await page
        .getByRole("button", { name: "Saved", exact: true })
        .first()
        .waitFor();
    }
    const cookies = await context.cookies();
    const owner = cookies.find(
      (cookie) => cookie.name === "scrapper_session",
    )?.value;
    if (!owner || !process.env.DATABASE_URL)
      throw Error("Private billing inspection unavailable.");
    const stored = await new PostgresStore(process.env.DATABASE_URL).get(
      id,
      owner,
    );
    privateWrite(`.data/hosted-release-${name}-private.json`, stored);
    let actualUsd: number | null = null;
    const runId = stored?.sourceRuns?.[0]?.runId;
    if (runId && process.env.APIFY_TOKEN) {
      const run = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
        headers: { Authorization: `Bearer ${process.env.APIFY_TOKEN}` },
      });
      if (run.ok) {
        const data = (await run.json()).data;
        privateWrite(`.data/hosted-release-${name}-run.json`, data);
        actualUsd = data.usageTotalUsd ?? null;
        const logs = await fetch(
          `https://api.apify.com/v2/actor-runs/${runId}/log`,
          { headers: { Authorization: `Bearer ${process.env.APIFY_TOKEN}` } },
        );
        if (logs.ok)
          writeFileSync(
            `.data/hosted-release-${name}-log.txt`,
            await logs.text(),
            { mode: 0o600 },
          );
      }
    }
    const summary = {
      checkedAt: new Date().toISOString(),
      case: name,
      stage: scan.stage,
      retrieved: scan.retrieved,
      normalized: scan.sourceRuns?.[0]?.normalized,
      qualified: scan.results.length,
      modelReview: scan.modelReview,
      reservationUsd: 0.08,
      actualUsd,
      notice: scan.notice,
      links: scan.results.map(
        ({ title, url, text, evidence, need, publishedAt, reviewMethod }) => ({
          title,
          url,
          text,
          evidence,
          need,
          publishedAt,
          reviewMethod,
        }),
      ),
    };
    privateWrite(`.data/hosted-release-${name}-summary.json`, summary);
    console.log(JSON.stringify(summary));
  } finally {
    await browser.close();
  }
}
void main().catch(() => {
  console.error(
    "Hosted verification stopped; inspect private persisted state. No replacement job was submitted.",
  );
  process.exitCode = 1;
});
