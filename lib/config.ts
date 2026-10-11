import type { Source } from "./types";
export const MAX_ITEMS = 50;
export const MIN_PROVIDER_ITEMS = 10;
export const FREE_RESULT_LIMIT = 3;
export const FREE_SOURCE_BUDGET_USD = 0.12;
export const MIN_PROVIDER_BUDGET_USD = 0.04;
export const SCAN_TIMEOUT_MS = 210_000;
export const PROVIDER_TIMEOUT_SECONDS = 180;
export const RETENTION_MS = 24 * 60 * 60_000;
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public noJobStarted = false,
  ) {
    super(message);
  }
}
export function liveConfig(sources: Source[] = ["reddit"]) {
  const minimum = sources.reduce(
    (total, source) =>
      total + (source === "reddit" ? MIN_PROVIDER_BUDGET_USD : 0.02),
    0,
  );
  const token = process.env.APIFY_TOKEN?.trim();
  const budget = Number(process.env.LIVE_SCAN_BUDGET_USD || 0);
  const hourlyBudget = Number(process.env.LIVE_HOURLY_BUDGET_USD || 2);
  const dailyBudget = Number(process.env.LIVE_DAILY_BUDGET_USD || hourlyBudget);
  if (
    !token &&
    !(
      sources.length === 1 &&
      sources[0] === "reddit" &&
      process.env.OPENAI_API_KEY?.trim()
    )
  )
    throw new AppError(
      "Reddit search is temporarily unavailable. Please try again later. Your free search has not been used.",
      503,
    );
  if (
    !Number.isFinite(budget) ||
    budget < minimum ||
    budget > 1 ||
    !Number.isFinite(hourlyBudget) ||
    hourlyBudget <= 0 ||
    hourlyBudget > 10 ||
    !Number.isFinite(dailyBudget) ||
    dailyBudget <= 0 ||
    dailyBudget > 10
  ) {
    throw new AppError(
      "Reddit search is temporarily unavailable. Please try again later. Your free search has not been used.",
      503,
    );
  }
  return { token: token || "", budget, hourlyBudget, dailyBudget };
}

export function xMonthlyRunLimit(): number {
  const limit = Number(process.env.X_MONTHLY_RUN_LIMIT || 5);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
    throw new AppError(
      "The X pilot run allowance is not configured correctly. No source job was started.",
      503,
    );
  return limit;
}
