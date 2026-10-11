import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { AppError, RETENTION_MS } from "./config";
import { terminalStages, type Mode, type Scan } from "./types";

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
      CREATE INDEX IF NOT EXISTS scan_owner ON scans(owner, created);`);
  }
  close() {
    this.db.close();
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
  ): Scan {
    const now = Date.now();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("DELETE FROM scans WHERE created<?")
        .run(now - RETENTION_MS);
      const duplicate = this.db
        .prepare(
          "SELECT body FROM scans WHERE owner=? AND (idem=? OR (description=? AND mode=? AND created>?)) ORDER BY created DESC LIMIT 1",
        )
        .get(owner, key, description, mode, now - 120_000);
      if (duplicate) {
        const scan = JSON.parse(duplicate.body as string) as Scan;
        if (
          scan.key === key &&
          (scan.description !== description || scan.mode !== mode)
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
          "SELECT COUNT(*) AS n FROM scans WHERE owner=? AND stage NOT IN ('complete','empty','partial','failed') AND created>?",
        )
        .get(owner, now - 210_000);
      const recent = this.db
        .prepare("SELECT COUNT(*) AS n FROM scans WHERE owner=? AND created>?")
        .get(owner, now - 3600_000);
      if (Number(active?.n) > 0)
        throw new AppError(
          "You already have a search in progress. Finish it before starting another.",
          429,
        );
      if (Number(recent?.n) >= 20)
        throw new AppError(
          "This session has reached its hourly search limit. Try again later.",
          429,
        );
      if (mode === "live") {
        const spent = this.db
          .prepare(
            "SELECT COALESCE(SUM(reserved),0) AS total FROM scans WHERE mode='live' AND created>?",
          )
          .get(now - 3600_000);
        if (Number(spent?.total) + reservedUsd > hourlyBudget)
          throw new AppError(
            "The server has reached its hourly live-search budget. No provider job was started.",
            429,
          );
      }
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
      };
      this.db
        .prepare(
          "INSERT INTO scans(id,owner,idem,mode,description,stage,created,reserved,body) VALUES (?,?,?,?,?,?,?,?,?)",
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
        );
      this.db.exec("COMMIT");
      return scan;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
  claim(id: string, owner: string): boolean {
    return (
      this.db
        .prepare("UPDATE scans SET lease=? WHERE id=? AND owner=? AND lease=0")
        .run(Date.now() + 60_000, id, owner).changes === 1
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
