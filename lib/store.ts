import { AppError } from "./config";
import type { Mode, Scan, Source } from "./types";
type MaybePromise<T> = T | Promise<T>;
export interface ScanRepository {
  get(id: string, owner: string): MaybePromise<Scan | null>;
  create(
    owner: string,
    key: string,
    description: string,
    mode: Mode,
    reservedUsd: number,
    hourlyBudget?: number,
    sources?: Source[],
  ): MaybePromise<Scan>;
  claim(id: string, owner: string): MaybePromise<boolean>;
  expiredLease(id: string, owner: string): MaybePromise<boolean>;
  save(scan: Scan, release?: boolean): MaybePromise<void>;
  feedback(
    id: string,
    owner: string,
    resultId: string,
    action: "save" | "irrelevant",
    value: boolean,
  ): MaybePromise<Scan>;
}
let singleton: Promise<ScanRepository> | undefined;
export function store(): Promise<ScanRepository> {
  return (singleton ??= (async () => {
    if (process.env.DATABASE_URL) {
      const { PostgresStore } = await import("./postgres-store");
      return new PostgresStore(process.env.DATABASE_URL);
    }
    if (process.env.VERCEL)
      throw new AppError(
        "Scan storage is not connected. Please try again after setup is complete.",
        503,
      );
    const { ScanStore } = await import("./sqlite-store");
    return new ScanStore(process.env.SCAN_DB_PATH || ".data/scans.sqlite");
  })());
}
