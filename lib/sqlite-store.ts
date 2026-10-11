import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { AppError, RETENTION_MS, xMonthlyRunLimit } from "./config";
import { terminalStages, type Mode, type Scan, type Source } from "./types";
import type { Admission } from "./store";
import { TRIAL_DAYS } from "./pricing";

export class ScanStore {
  private db: DatabaseSync;
  constructor(path: string) {
    if (path !== ":memory:")
      mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS scans (id TEXT PRIMARY KEY, owner TEXT NOT NULL, idem TEXT NOT NULL, mode TEXT NOT NULL,
      description TEXT NOT NULL, stage TEXT NOT NULL, created INTEGER NOT NULL, reserved REAL NOT NULL,
      body TEXT NOT NULL, lease INTEGER NOT NULL DEFAULT 0, UNIQUE(owner, idem));
      CREATE INDEX IF NOT EXISTS scan_owner ON scans(owner, created);
      CREATE TABLE IF NOT EXISTS source_usage (source TEXT NOT NULL, month TEXT NOT NULL, used INTEGER NOT NULL, PRIMARY KEY(source, month));`);
    const columns = this.db.prepare("PRAGMA table_info(scans)").all();
    if (!columns.some((column) => column.name === "ip_hash"))
      this.db.exec("ALTER TABLE scans ADD COLUMN ip_hash TEXT");
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS request_limits (ip_hash TEXT NOT NULL, minute INTEGER NOT NULL, used INTEGER NOT NULL, PRIMARY KEY(ip_hash,minute))",
    );
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS free_usage (owner TEXT PRIMARY KEY, scan_id TEXT NOT NULL, consumed INTEGER NOT NULL DEFAULT 0)",
    );
    this.db.exec("CREATE TABLE IF NOT EXISTS customer_trials (owner TEXT PRIMARY KEY, started INTEGER NOT NULL)");
  }
  close() {
    this.db.close();
  }
  allowance(owner: string) {
    const row = this.db
      .prepare("SELECT scan_id,consumed FROM free_usage WHERE owner=?")
      .get(owner);
    return { used: !!row?.consumed, scanId: row ? String(row.scan_id) : null };
  }
  trial(owner: string) {
    this.db.prepare("INSERT INTO customer_trials(owner,started) VALUES(?,?) ON CONFLICT(owner) DO NOTHING").run(owner, Date.now());
    const row = this.db.prepare("SELECT started FROM customer_trials WHERE owner=?").get(owner)!;
    const startsAt = Number(row.started);
    return { ...this.allowance(owner), startsAt, expiresAt: startsAt + TRIAL_DAYS * 86400_000 };
  }
  consumeFree(scan: Scan): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db
        .prepare(
          "UPDATE free_usage SET consumed=1 WHERE owner=? AND scan_id=? RETURNING owner",
        )
        .get(scan.owner, scan.id);
      if (!row)
        throw new AppError(
          "Your free search has already been used. Results are available for 24 hours after a search.",
          403,
        );
      scan.startAttempted = true;
      this.db
        .prepare("UPDATE scans SET body=? WHERE id=? AND owner=?")
        .run(JSON.stringify(scan), scan.id, scan.owner);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  releaseFree(scan: Scan): void {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("UPDATE free_usage SET consumed=0 WHERE owner=? AND scan_id=?")
        .run(scan.owner, scan.id);
      scan.startAttempted = false;
      scan.reservedUsd = 0;
      this.db
        .prepare("UPDATE scans SET reserved=0,body=? WHERE id=? AND owner=?")
        .run(JSON.stringify(scan), scan.id, scan.owner);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  throttle(ipHash: string, maxRequests = 30): void {
    const minute = Math.floor(Date.now() / 60_000);
    this.db
      .prepare("DELETE FROM request_limits WHERE minute<?")
      .run(minute - 2);
    const row = this.db
      .prepare(
        "INSERT INTO request_limits(ip_hash,minute,used) VALUES(?,?,1) ON CONFLICT(ip_hash,minute) DO UPDATE SET used=used+1 RETURNING used",
      )
      .get(ipHash, minute);
    if (Number(row?.used) > maxRequests)
      throw new AppError(
        "Too many research requests from this connection. Wait one minute and try again.",
        429,
      );
  }
  get(id: string, owner: string): Scan | null {
    const row = this.db
      .prepare("SELECT body FROM scans WHERE id=? AND owner=? AND created>?")
      .get(id, owner, Date.now() - RETENTION_MS);
    return row ? (JSON.parse(row.body as string) as Scan) : null;
  }
  create(
    owner: string,
    key: string,
    description: string,
    mode: Mode,
    reservedUsd: number,
    hourlyBudget = 0,
    sources: Source[] = ["reddit"],
    admission?: Admission,
  ): Scan {
    const now = Date.now();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("DELETE FROM scans WHERE created<?")
        .run(now - RETENTION_MS);
      const duplicate = this.db
        .prepare(
          `SELECT body FROM scans WHERE owner=? AND (idem=? OR (?=0 AND description=? AND mode=? AND COALESCE(json_extract(body, '$.sources'), '["reddit"]')=? AND COALESCE(json_extract(body,'$.developer'),0)=? AND created>? AND NOT (stage='failed' AND COALESCE(json_extract(body,'$.free'),0)=1 AND COALESCE(json_extract(body,'$.startAttempted'),0)=0))) ORDER BY created DESC LIMIT 1`,
        )
        .get(
          owner,
          key,
          admission?.developer ? 1 : 0,
          description,
          mode,
          JSON.stringify(sources),
          admission?.developer ? 1 : 0,
          now - 120_000,
        );
      if (duplicate) {
        const scan = JSON.parse(duplicate.body as string) as Scan;
        if (
          scan.key === key &&
          (scan.description !== description ||
            scan.mode !== mode ||
            JSON.stringify(scan.sources || ["reddit"]) !==
              JSON.stringify(sources))
        )
          throw new AppError(
            "This run key belongs to another request. Start a new search.",
            409,
          );
        this.db.exec("COMMIT");
        return scan;
      }
      const active = this.db
        .prepare(
          "SELECT COUNT(*) AS n FROM scans WHERE owner=? AND COALESCE(json_extract(body,'$.developer'),0)=0 AND stage NOT IN ('complete','empty','partial','failed') AND created>?",
        )
        .get(owner, now - 210_000);
      const recent = this.db
        .prepare(
          "SELECT COUNT(*) AS n FROM scans WHERE owner=? AND COALESCE(json_extract(body,'$.developer'),0)=0 AND created>?",
        )
        .get(owner, now - 3600_000);
      if (!admission?.developer && Number(active?.n) > 0)
        throw new AppError(
          "You already have a search in progress. Finish it before starting another.",
          429,
        );
      if (!admission?.developer && Number(recent?.n) >= 20)
        throw new AppError(
          "This session has reached its hourly search limit. Try again later.",
          429,
        );
      if (mode === "live" && !admission?.developer) {
        if (admission?.free && this.allowance(owner).used)
          throw new AppError(
            "Your free search has already been used. Saved results are available for 24 hours after your search.",
            403,
          );
        if (
          Number(
            this.db
              .prepare(
                "SELECT COUNT(*) AS n FROM scans WHERE mode='live' AND COALESCE(json_extract(body,'$.developer'),0)=0 AND created>? AND (owner=? OR (? IS NOT NULL AND ip_hash=?))",
              )
              .get(
                now - 3600_000,
                owner,
                admission?.ipHash || null,
                admission?.ipHash || null,
              )?.n,
          ) >= 10
        )
          throw new AppError(
            "This connection has reached its limit of ten live searches per hour. Try again in an hour.",
            429,
          );
        const spent = this.db
          .prepare(
            "SELECT COALESCE(SUM(reserved),0) AS total FROM scans WHERE mode='live' AND COALESCE(json_extract(body,'$.developer'),0)=0 AND created>?",
          )
          .get(now - 3600_000);
        if (Number(spent?.total) + reservedUsd > hourlyBudget + 1e-9)
          throw new AppError(
            "Research capacity is full for this hour. Try again in an hour; no source job was started.",
            429,
          );
        const daily = this.db
          .prepare(
            "SELECT COALESCE(SUM(reserved),0) AS total FROM scans WHERE mode='live' AND COALESCE(json_extract(body,'$.developer'),0)=0 AND created>?",
          )
          .get(now - RETENTION_MS);
        if (
          Number(daily?.total) + reservedUsd >
          (admission?.dailyBudget ?? hourlyBudget) + 1e-9
        )
          throw new AppError(
            "Today's research capacity is full. Try again tomorrow; no source job was started.",
            429,
          );
      }
      if (mode === "live" && sources.includes("x")) {
        const activeX = this.db
          .prepare(
            "SELECT COUNT(*) AS n FROM scans WHERE mode='live' AND stage NOT IN ('complete','empty','partial','failed') AND created>? AND EXISTS (SELECT 1 FROM json_each(body, '$.sources') WHERE value='x')",
          )
          .get(now - 210_000);
        if (Number(activeX?.n) > 0)
          throw new AppError(
            "The X source already has a job in progress. Wait for it to finish before starting another.",
            429,
          );
      }
      const xLimit =
        mode === "live" && sources.includes("x")
          ? xMonthlyRunLimit()
          : undefined;
      if (xLimit !== undefined) {
        const month = new Date(now).toISOString().slice(0, 7);
        const usage = this.db
          .prepare("SELECT used FROM source_usage WHERE source='x' AND month=?")
          .get(month);
        if (Number(usage?.used || 0) >= xLimit)
          throw new AppError(
            "The X pilot has reached its monthly run allowance. Reddit and sample mode remain available.",
            429,
          );
        this.db
          .prepare(
            "INSERT INTO source_usage(source, month, used) VALUES ('x', ?, 1) ON CONFLICT(source,month) DO UPDATE SET used=used+1",
          )
          .run(month);
      }
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
        xMonthlyRunLimit: xLimit,
      };
      this.db
        .prepare(
          "INSERT INTO scans(id,owner,idem,mode,description,stage,created,reserved,body,ip_hash) VALUES (?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          scan.id,
          owner,
          key,
          mode,
          description,
          scan.stage,
          now,
          reservedUsd,
          JSON.stringify(scan),
          admission?.ipHash || null,
        );
      if (scan.free && !scan.developer)
        this.db
          .prepare(
            "INSERT INTO free_usage(owner,scan_id,consumed) VALUES(?,?,0) ON CONFLICT(owner) DO UPDATE SET scan_id=excluded.scan_id,consumed=0",
          )
          .run(owner, scan.id);
      this.db.exec("COMMIT");
      return scan;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  claim(id: string, owner: string, leaseMs = 60_000): boolean {
    return (
      this.db
        .prepare("UPDATE scans SET lease=? WHERE id=? AND owner=? AND lease=0")
        .run(Date.now() + leaseMs, id, owner).changes === 1
    );
  }
  expiredLease(id: string, owner: string): boolean {
    const row = this.db
      .prepare("SELECT lease FROM scans WHERE id=? AND owner=?")
      .get(id, owner);
    return !!row && Number(row.lease) > 0 && Number(row.lease) < Date.now();
  }
  save(scan: Scan, release = true): void {
    scan.updatedAt = Date.now();
    this.db
      .prepare(
        "UPDATE scans SET body=?,stage=?,lease=CASE WHEN ? THEN 0 ELSE lease END WHERE id=? AND owner=?",
      )
      .run(
        JSON.stringify(scan),
        scan.stage,
        release ? 1 : 0,
        scan.id,
        scan.owner,
      );
  }
  feedback(
    id: string,
    owner: string,
    resultId: string,
    action: "save" | "irrelevant",
    value: boolean,
  ): Scan {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const scan = this.get(id, owner);
      if (!scan) throw new AppError("Search not found or expired.", 404);
      if (!terminalStages.includes(scan.stage))
        throw new AppError(
          "Wait until this search finishes before saving feedback.",
          409,
        );
      const result = scan.results.find((item) => item.id === resultId);
      if (!result) throw new AppError("Result not found.", 404);
      if (action === "save") result.saved = value;
      else result.irrelevant = value;
      this.save(scan);
      this.db.exec("COMMIT");
      return scan;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}
