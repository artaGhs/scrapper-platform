import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { AppError, RETENTION_MS, xMonthlyRunLimit } from "./config";
import type { Mode, Scan, Source } from "./types";
import type { Admission, ScanRepository } from "./store";
export class PostgresStore implements ScanRepository {
  private sql;
  constructor(url: string) {
    this.sql = neon(url);
  }
  async allowance(owner: string) {
    const rows = await this
      .sql`SELECT scan_id,consumed FROM scrapper.free_usage WHERE owner=${owner}`;
    return { used: !!rows[0]?.consumed, scanId: rows[0]?.scan_id || null };
  }
  async consumeFree(scan: Scan) {
    scan.startAttempted = true;
    const rows = await this
      .sql`WITH consumed AS (UPDATE scrapper.free_usage SET consumed=true WHERE owner=${scan.owner} AND scan_id=${scan.id} RETURNING owner) UPDATE scrapper.scans SET body=${JSON.stringify(scan)}::jsonb WHERE id=${scan.id} AND owner IN (SELECT owner FROM consumed) RETURNING id`;
    if (!rows.length) {
      scan.startAttempted = false;
      throw new AppError(
        "Your free search has already been used. Full research is coming later.",
        403,
      );
    }
  }
  async releaseFree(scan: Scan) {
    scan.startAttempted = false;
    scan.reservedUsd = 0;
    await this.sql.transaction([
      this
        .sql`UPDATE scrapper.free_usage SET consumed=false WHERE owner=${scan.owner} AND scan_id=${scan.id}`,
      this
        .sql`UPDATE scrapper.scans SET reserved=0,body=${JSON.stringify(scan)}::jsonb WHERE id=${scan.id} AND owner=${scan.owner}`,
    ]);
  }
  async throttle(ipHash: string, maxRequests = 30) {
    const minute = Math.floor(Date.now() / 60_000);
    await this
      .sql`DELETE FROM scrapper.request_limits WHERE minute<${minute - 2}`;
    const rows = await this
      .sql`INSERT INTO scrapper.request_limits(ip_hash,minute,used) VALUES(${ipHash},${minute},1) ON CONFLICT(ip_hash,minute) DO UPDATE SET used=scrapper.request_limits.used+1 RETURNING used`;
    if (Number(rows[0].used) > maxRequests)
      throw new AppError(
        "Too many research requests from this connection. Wait one minute and try again.",
        429,
      );
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
    admission?: Admission,
  ): Promise<Scan> {
    const now = Date.now();
    const scan: Scan = {
      free: admission?.free,
      developer: admission?.developer,
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
      .sql`SELECT scrapper.create_scan(${JSON.stringify({ ...scan, admission })}::jsonb, ${hourlyBudget}::numeric) AS result`;
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
