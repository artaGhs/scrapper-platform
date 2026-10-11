import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
loadEnvConfig(process.cwd());
async function main() {
  if (!process.env.APIFY_TOKEN || !process.env.DATABASE_URL)
    throw Error("Not configured");
  const month = new Date().toISOString().slice(0, 7);
  const response = await fetch(
    "https://api.apify.com/v2/acts/apidojo~twitter-scraper-lite/runs?limit=100&desc=true",
    {
      headers: { Authorization: `Bearer ${process.env.APIFY_TOKEN}` },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) throw Error("History unavailable");
  const data = (await response.json()).data;
  if (
    !Array.isArray(data.items) ||
    (data.items.length === 100 && data.items.at(-1).startedAt.startsWith(month))
  )
    throw Error("History incomplete; allowance not changed");
  const used = data.items.filter((run: { startedAt: string }) =>
    run.startedAt.startsWith(month),
  ).length;
  const sql = neon(process.env.DATABASE_URL);
  await sql`INSERT INTO threadfinder.source_usage(source,month,used) VALUES ('x',${month},${used}) ON CONFLICT(source,month) DO UPDATE SET used=greatest(threadfinder.source_usage.used,${used})`;
  console.log(
    `X allowance synced for ${month}: at least ${used} provider runs; existing reservations preserved.`,
  );
}
main().catch(() => {
  console.error("X allowance could not be synced; private details withheld.");
  process.exitCode = 1;
});
