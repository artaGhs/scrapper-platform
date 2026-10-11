import { AppError } from "./config";
import type { Mode, Scan, Source } from "./types";
type MaybePromise<T> = T | Promise<T>;
export interface Admission {
  developer?: boolean;
  ipHash: string;
  dailyBudget: number;
  free?: boolean;
}
export interface FreeAllowance {
  used: boolean;
  scanId: string | null;
}
export interface ScanRepository {
  allowance(owner: string): MaybePromise<FreeAllowance>;
  consumeFree(scan: Scan): MaybePromise<void>;
  releaseFree(scan: Scan): MaybePromise<void>;
  throttle(ipHash: string, maxRequests?: number): MaybePromise<void>;
  get(id: string, owner: string): MaybePromise<Scan | null>;
  create(
    owner: string,
    key: string,
    description: string,
    mode: Mode,
    reservedUsd: number,
    hourlyBudget?: number,
    sources?: Source[],
    admission?: Admission,
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
        "Research is temporarily unavailable. Please try again later.",
        503,
      );
    const { ScanStore } = await import("./sqlite-store");
    return new ScanStore(process.env.SCAN_DB_PATH || ".data/scans.sqlite");
  })());
}
