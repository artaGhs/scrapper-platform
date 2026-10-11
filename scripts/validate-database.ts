import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { neon } from "@neondatabase/serverless";
import { PostgresStore } from "../lib/postgres-store";
import { advance } from "../lib/service";
loadEnvConfig(process.cwd());
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("Database not configured");
  const db = new PostgresStore(process.env.DATABASE_URL);
  const owner = "database-validation-" + randomUUID();
  const other = "database-validation-" + randomUUID();
  const budgetOwners = Array.from(
    { length: 3 },
    () => "database-validation-" + randomUUID(),
  );
  const sql = neon(process.env.DATABASE_URL);
  try {
    const key = randomUUID();
    const description =
      "Our app estimates calories from food photos instead of manual logging.";
    const created = await db.create(owner, key, description, "sample", 0);
    const duplicate = await db.create(owner, key, description, "sample", 0);
    assert.equal(created.id, duplicate.id);
    assert.equal(await db.get(created.id, other), null);
    await assert.rejects(
      db.create(
        owner,
        key,
        "We offer different uptime monitoring software.",
        "sample",
        0,
      ),
      { status: 409 },
    );
    let scan = created;
    while (!["complete", "empty", "failed"].includes(scan.stage))
      scan = await advance(scan.id, owner, db);
    assert.equal(scan.results.length, 3);
    const saved = await db.feedback(
      scan.id,
      owner,
      scan.results[0].id,
      "save",
      true,
    );
    assert(saved.results[0].saved);
    const reopened = new PostgresStore(process.env.DATABASE_URL);
    assert((await reopened.get(scan.id, owner))!.results[0].saved);
    await assert.rejects(
      db.feedback(scan.id, other, scan.results[0].id, "save", true),
      { status: 404 },
    );
    // No external provider requests. Fake provider tests the durable atomic lease.
    let starts = 0;
    const provider = {
      start: async () => {
        starts++;
        return {
          id: "test-run",
          defaultDatasetId: "test-data",
          status: "RUNNING",
        };
      },
      poll: async () => ({
        id: "test-run",
        defaultDatasetId: "test-data",
        status: "SUCCEEDED",
      }),
      items: async () => [],
      abort: async () => {},
    };
    const live = await db.create(
      other,
      randomUUID(),
      description,
      "live",
      0.01,
      10,
    );
    await advance(live.id, other, db, provider);
    await Promise.all(
      Array.from({ length: 10 }, () => advance(live.id, other, db, provider)),
    );
    assert.equal(starts, 1);
    const reserved = await Promise.allSettled(
      budgetOwners.map((own) =>
        db.create(own, randomUUID(), description, "live", 0.01, 0.02),
      ),
    );
    assert.equal(
      reserved.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert(
      reserved
        .filter((result) => result.status === "rejected")
        .every((result) => result.reason.status === 429),
    );
    console.log(
      "Neon validation passed: persistence, ownership, idempotency, feedback, atomic global budget and 10 concurrent advances / one simulated source start.",
    );
  } finally {
    await sql`DELETE FROM scrapper.scans WHERE owner=${owner} OR owner=${other} OR owner = ANY(${budgetOwners})`;
  }
}
main().catch(() => {
  console.error("Database validation failed; connection details withheld.");
  process.exitCode = 1;
});
