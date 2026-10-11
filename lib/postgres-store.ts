import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { AppError, RETENTION_MS, xMonthlyRunLimit } from "./config";
import type { Mode, Scan, Source } from "./types";
import type { ScanRepository } from "./store";
export class PostgresStore implements ScanRepository {
  private sql;
  constructor(url: string) {
    this.sql = neon(url);
  }
  async get(id: string, owner: string): Promise<Scan | null> {
    const rows = await this
      .sql`SELECT body FROM scrapper.scans WHERE id=${id} AND owner=${owner} AND created>${Date.now() - RETENTION_MS}`;
    return rows[0]?.body || null;
  }
  async create(
    owner: string,
    key: string,
    description: string,
    mode: Mode,
    reservedUsd: number,
    hourlyBudget = 0,
    sources: Source[] = ["reddit"],
  ): Promise<Scan> {
    const now = Date.now();
    const scan: Scan = {
      id: randomUUID(),
      owner,
      key,
      description,
      mode,
      stage: "interpreting",
      createdAt: now,
      updatedAt: now,
      results: [],
      reservedUsd,
      sources,
      xMonthlyRunLimit:
        mode === "live" && sources.includes("x")
          ? xMonthlyRunLimit()
          : undefined,
    };
    const rows = await this
      .sql`SELECT scrapper.create_scan(${JSON.stringify(scan)}::jsonb, ${hourlyBudget}::numeric) AS result`;
    return this.result(rows[0].result);
  }
  private result(result: { error?: string; status?: number } | Scan): Scan {
    if ("error" in result && result.error && !("id" in result))
      throw new AppError(result.error, result.status || 400);
    return result as Scan;
  }
  async claim(id: string, owner: string) {
    const rows = await this
      .sql`UPDATE scrapper.scans SET lease=${Date.now() + 60_000} WHERE id=${id} AND owner=${owner} AND lease=0 RETURNING id`;
    return rows.length === 1;
  }
  async expiredLease(id: string, owner: string) {
    const rows = await this
      .sql`SELECT id FROM scrapper.scans WHERE id=${id} AND owner=${owner} AND lease>0 AND lease<${Date.now()}`;
    return rows.length === 1;
  }
  async save(scan: Scan, release = true) {
    scan.updatedAt = Date.now();
    await this
      .sql`UPDATE scrapper.scans SET body=${JSON.stringify(scan)}::jsonb, stage=${scan.stage}, lease=CASE WHEN ${release} THEN 0 ELSE lease END WHERE id=${scan.id} AND owner=${scan.owner}`;
  }
  async feedback(
    id: string,
    owner: string,
    resultId: string,
    action: "save" | "irrelevant",
    value: boolean,
  ): Promise<Scan> {
    const rows = await this
      .sql`SELECT scrapper.feedback(${id}, ${owner}, ${resultId}, ${action}, ${value}, ${Date.now()}::bigint) AS result`;
    return this.result(rows[0].result);
  }
}
