// Durable admission checks only. No advance/model/provider calls.
import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { PostgresStore } from "../lib/postgres-store";
loadEnvConfig(process.cwd());
async function main() {
  if (!process.env.DATABASE_URL) throw Error("Database missing");
  const sql = neon(process.env.DATABASE_URL);
  const db = new PostgresStore(process.env.DATABASE_URL);
  const prefix = "public-limit-validation-" + randomUUID();
  const description =
    "Simulated admission test for calorie logging; never sent to a provider.";
  const clean = async () => {
    await sql`DELETE FROM scrapper.scans WHERE starts_with(owner,${prefix})`;
  };
  try {
    const sums =
      await sql`SELECT coalesce(sum(reserved),0) AS reserved FROM scrapper.scans WHERE mode='live' AND created>${Date.now() - 86400_000}`;
    const dayBudget = Number(sums[0].reserved) + 0.002;
    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        db.create(
          prefix + i,
          randomUUID(),
          description,
          "live",
          0.001,
          10,
          ["reddit"],
          { ipHash: prefix + i, dailyBudget: dayBudget },
        ),
      ),
    );
    assert.equal(attempts.filter((r) => r.status === "fulfilled").length, 2);
    assert(
      attempts
        .filter((r) => r.status === "rejected")
        .every((r) => r.reason.status === 429),
    );
    await clean();
    const admission = { ipHash: prefix, dailyBudget: 10 };
    const key = randomUUID();
    const first = await db.create(
      prefix + "a",
      key,
      description,
      "live",
      0.001,
      10,
      ["reddit"],
      admission,
    );
    assert.equal(
      (
        await db.create(
          prefix + "a",
          key,
          description,
          "live",
          0.001,
          10,
          ["reddit"],
          admission,
        )
      ).id,
      first.id,
    );
    await db.create(
      prefix + "b",
      randomUUID(),
      description,
      "live",
      0.001,
      10,
      ["reddit"],
      admission,
    );
    await assert.rejects(
      db.create(
        prefix + "c",
        randomUUID(),
        description,
        "live",
        0.001,
        10,
        ["reddit"],
        admission,
      ),
      /two live searches per hour/,
    );
    assert.equal(await db.get(first.id, prefix + "stranger"), null);
    for (let i = 0; i < 30; i++) await db.throttle(prefix);
    await assert.rejects(db.throttle(prefix), /Wait one minute/);
    console.log(
      "Neon public admission passed: atomic daily reservations, shared connection limits, idempotency, ownership and request throttle. Zero provider/model calls.",
    );
  } finally {
    await clean();
    await sql`DELETE FROM scrapper.request_limits WHERE ip_hash=${prefix}`;
  }
}
main().catch(() => {
  console.error(
    "Public admission validation failed; private details withheld.",
  );
  process.exitCode = 1;
});
