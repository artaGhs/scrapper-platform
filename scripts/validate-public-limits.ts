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
    await sql`DELETE FROM threadfinder.scans WHERE starts_with(owner,${prefix})`;
  };
  try {
    const sums =
      await sql`SELECT coalesce(sum(reserved),0) AS reserved FROM threadfinder.scans WHERE mode='live' AND NOT coalesce((body->>'developer')::boolean,false) AND created>${Date.now() - 86400_000}`;
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
    for (let i = 2; i < 10; i++)
      await db.create(
        prefix + i,
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
        prefix + "eleven",
        randomUUID(),
        description,
        "live",
        0.001,
        10,
        ["reddit"],
        admission,
      ),
      /ten live searches per hour/,
    );
    assert.equal(await db.get(first.id, prefix + "stranger"), null);
    await clean();
    const freeOwner = prefix + "free";
    const freeAdmission = {
      ipHash: prefix + "free",
      dailyBudget: 10,
      free: true,
    };
    const free = await db.create(
      freeOwner,
      randomUUID(),
      description,
      "live",
      0.001,
      10,
      ["reddit"],
      freeAdmission,
    );
    assert.equal((await db.allowance(freeOwner)).used, false);
    // Simulated start marker only; there is deliberately no provider request.
    await db.consumeFree(free);
    free.stage = "empty";
    await db.save(free);
    assert.equal(
      (await new PostgresStore(process.env.DATABASE_URL).allowance(freeOwner))
        .used,
      true,
    );
    await assert.rejects(
      db.create(
        freeOwner,
        randomUUID(),
        description + " Different",
        "live",
        0.001,
        10,
        ["reddit"],
        freeAdmission,
      ),
      /free search has already been used/,
    );
    assert.equal(
      (
        await db.create(
          freeOwner,
          free.key,
          description,
          "live",
          0.001,
          10,
          ["reddit"],
          freeAdmission,
        )
      ).id,
      free.id,
    );
    const allowanceBeforeDeveloper = await db.allowance(freeOwner);
    const developerAdmission = {
      ...freeAdmission,
      developer: true,
      dailyBudget: 0,
    };
    const developerIds = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const developerScan = await db.create(
        freeOwner,
        randomUUID(),
        description,
        "live",
        0.12,
        0,
        ["reddit"],
        developerAdmission,
      );
      developerIds.add(developerScan.id);
      assert.equal(developerScan.developer, true);
      assert.equal(
        (
          await db.create(
            freeOwner,
            developerScan.key,
            description,
            "live",
            0.12,
            0,
            ["reddit"],
            developerAdmission,
          )
        ).id,
        developerScan.id,
      );
    }
    assert.equal(developerIds.size, 25);
    assert.deepEqual(await db.allowance(freeOwner), allowanceBeforeDeveloper);
    await db.create(
      prefix + "after-developer",
      randomUUID(),
      description,
      "live",
      0.001,
      10,
      ["reddit"],
      { ipHash: freeAdmission.ipHash, dailyBudget: 10 },
    );
    await db.releaseFree(free);
    free.stage = "failed";
    await db.save(free);
    assert.equal((await db.allowance(freeOwner)).used, false);
    assert.notEqual(
      (
        await db.create(
          freeOwner,
          randomUUID(),
          description,
          "live",
          0.001,
          10,
          ["reddit"],
          freeAdmission,
        )
      ).id,
      free.id,
    );
    for (let i = 0; i < 30; i++) await db.throttle(prefix);
    await assert.rejects(db.throttle(prefix), /Wait one minute/);
    console.log(
      "Neon public admission passed: atomic daily reservations, ten-search connection cap, durable one-free allowance, safe unused reservation release/retry, idempotency, ownership, request throttle and 25 developer reservations bypassing quotas without altering consumed free usage or visitor capacity. Zero provider/model calls.",
    );
  } finally {
    await clean();
    await sql`DELETE FROM threadfinder.request_limits WHERE ip_hash=${prefix}`;
    await sql`DELETE FROM threadfinder.free_usage WHERE starts_with(owner,${prefix})`;
  }
}
main().catch(() => {
  console.error(
    "Public admission validation failed; private details withheld.",
  );
  process.exitCode = 1;
});
