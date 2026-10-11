import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import { AppError, RETENTION_MS, xMonthlyRunLimit } from "./config";
import type { Mode, Scan, Source } from "./types";
import type { Admission, ScanRepository } from "./store";
import { TRIAL_DAYS } from "./pricing";
export class PostgresStore implements ScanRepository {
  private sql;
  constructor(url: string, schema = process.env.DATABASE_SCHEMA || "threadfinder") {
    // Existing deployments can retain their database namespace while a renamed
    // application is staged. Rewrite trusted SQL text, never parameter values.
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schema))
      throw new AppError("Database namespace is invalid.", 503);
    const query = neon(url);
    this.sql = Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => {
      const mapped = Object.assign(
        strings.map(text => text.replaceAll("threadfinder.", `"${schema}".`)),
        { raw: strings.raw.map(text => text.replaceAll("threadfinder.", `"${schema}".`)) },
      ) as unknown as TemplateStringsArray;
      return query(mapped, ...values);
    }, query);
  }
  async allowance(owner: string) {
    const rows = await this
      .sql`SELECT scan_id,consumed FROM threadfinder.free_usage WHERE owner=${owner}`;
    return { used: !!rows[0]?.consumed, scanId: rows[0]?.scan_id || null };
  }
  async trial(owner: string) {
    const rows = await this.sql`INSERT INTO threadfinder.customer_trials(owner,started) VALUES(${owner},${Date.now()}) ON CONFLICT(owner) DO UPDATE SET started=threadfinder.customer_trials.started RETURNING started`;
    const startsAt = Number(rows[0].started);
    return { ...await this.allowance(owner), startsAt, expiresAt: startsAt + TRIAL_DAYS * 86400_000 };
  }
  async consumeFree(scan: Scan) {
    scan.startAttempted = true;
    const rows = await this
      .sql`WITH consumed AS (UPDATE threadfinder.free_usage SET consumed=true WHERE owner=${scan.owner} AND scan_id=${scan.id} RETURNING owner) UPDATE threadfinder.scans SET body=${JSON.stringify(scan)}::jsonb WHERE id=${scan.id} AND owner IN (SELECT owner FROM consumed) RETURNING id`;
    if (!rows.length) {
      scan.startAttempted = false;
      throw new AppError(
        "Your free search has already been used. Results are available for 24 hours after a search.",
        403,
      );
    }
  }
  async releaseFree(scan: Scan) {
    scan.startAttempted = false;
    scan.reservedUsd = 0;
    await this.sql.transaction([
      this
        .sql`UPDATE threadfinder.free_usage SET consumed=false WHERE owner=${scan.owner} AND scan_id=${scan.id}`,
      this
        .sql`UPDATE threadfinder.scans SET reserved=0,body=${JSON.stringify(scan)}::jsonb WHERE id=${scan.id} AND owner=${scan.owner}`,
    ]);
  }
  async throttle(ipHash: string, maxRequests = 30) {
    const minute = Math.floor(Date.now() / 60_000);
    await this
      .sql`DELETE FROM threadfinder.request_limits WHERE minute<${minute - 2}`;
    const rows = await this
      .sql`INSERT INTO threadfinder.request_limits(ip_hash,minute,used) VALUES(${ipHash},${minute},1) ON CONFLICT(ip_hash,minute) DO UPDATE SET used=threadfinder.request_limits.used+1 RETURNING used`;
    if (Number(rows[0].used) > maxRequests)
      throw new AppError(
        "Too many research requests from this connection. Wait one minute and try again.",
        429,
      );
  }
  async get(id: string, owner: string): Promise<Scan | null> {
    const rows = await this
      .sql`SELECT body FROM threadfinder.scans WHERE id=${id} AND owner=${owner} AND created>${Date.now() - RETENTION_MS}`;
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
      billingEventType: admission?.billingEventType,
      fullResults: admission?.fullResults,
      trialExpiresAt: admission?.trialExpiresAt,
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
      .sql`SELECT threadfinder.create_scan(${JSON.stringify({ ...scan, admission })}::jsonb, ${hourlyBudget}::numeric) AS result`;
    return this.result(rows[0].result);
  }
  private result(result: { error?: string; status?: number } | Scan): Scan {
    if ("error" in result && result.error && !("id" in result))
      throw new AppError(result.error, result.status || 400);
    return result as Scan;
  }
  async claim(id: string, owner: string, leaseMs = 60_000) {
    const rows = await this
      .sql`UPDATE threadfinder.scans SET lease=${Date.now() + leaseMs} WHERE id=${id} AND owner=${owner} AND lease=0 RETURNING id`;
    return rows.length === 1;
  }
  async expiredLease(id: string, owner: string) {
    const rows = await this
      .sql`SELECT id FROM threadfinder.scans WHERE id=${id} AND owner=${owner} AND lease>0 AND lease<${Date.now()}`;
    return rows.length === 1;
  }
  async save(scan: Scan, release = true) {
    scan.updatedAt = Date.now();
    await this
      .sql`UPDATE threadfinder.scans SET body=${JSON.stringify(scan)}::jsonb, stage=${scan.stage}, lease=CASE WHEN ${release} THEN 0 ELSE lease END WHERE id=${scan.id} AND owner=${scan.owner}`;
  }
  async saveReply(
    id: string,
    owner: string,
    resultId: string,
    reply: string,
  ): Promise<string> {
    // Only change this field, using the current row under its write lock.
    const rows = await this.sql`
      UPDATE scrapper.scans AS scan
      SET body = jsonb_set(scan.body,
        ARRAY['results', (SELECT (ordinality - 1)::text
          FROM jsonb_array_elements(scan.body->'results') WITH ORDINALITY AS result(item, ordinality)
          WHERE item->>'id' = ${resultId} LIMIT 1), 'suggestedReply'],
        COALESCE((SELECT item->'suggestedReply'
          FROM jsonb_array_elements(scan.body->'results') AS result(item)
          WHERE item->>'id' = ${resultId} LIMIT 1), to_jsonb(${reply}::text)))
      WHERE scan.id = ${id} AND scan.owner = ${owner}
        AND scan.created > ${Date.now() - RETENTION_MS}
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(scan.body->'results') AS result(item)
          WHERE item->>'id' = ${resultId})
      RETURNING body`;
    if (!rows.length) throw new AppError("Result not found or expired.", 404);
    return (rows[0].body as Scan).results.find((item) => item.id === resultId)!
      .suggestedReply!;
  }
  async feedback(
    id: string,
    owner: string,
    resultId: string,
    action: "save" | "irrelevant",
    value: boolean,
  ): Promise<Scan> {
    const rows = await this
      .sql`SELECT threadfinder.feedback(${id}, ${owner}, ${resultId}, ${action}, ${value}, ${Date.now()}::bigint) AS result`;
    return this.result(rows[0].result);
  }
}
