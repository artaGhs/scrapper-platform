import { loadEnvConfig } from "@next/env";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
loadEnvConfig(process.cwd());
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");
  const sql = neon(process.env.DATABASE_URL);
  const statements = readFileSync("db/schema.sql", "utf8")
    .split("-- statement")
    .map((s) => s.trim())
    .filter(Boolean);
  await sql.transaction(
    statements.map((statement) => sql.query(statement, [])),
  );
  console.log("Durable scan schema installed.");
}
main().catch(() => {
  console.error(
    "Database setup failed. Check the private connection and schema permissions.",
  );
  process.exitCode = 1;
});
