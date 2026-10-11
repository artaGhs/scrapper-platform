export const MAX_ITEMS = 50;
export const MIN_PROVIDER_ITEMS = 10;
export const MIN_PROVIDER_BUDGET_USD = 0.04;
export const SCAN_TIMEOUT_MS = 210_000;
export const PROVIDER_TIMEOUT_SECONDS = 180;
export const RETENTION_MS = 24 * 60 * 60_000;
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function liveConfig() {
  const token = process.env.APIFY_TOKEN?.trim();
  const budget = Number(process.env.LIVE_SCAN_BUDGET_USD || 0);
  const hourlyBudget = Number(process.env.LIVE_HOURLY_BUDGET_USD || 2);
  if (!token)
    throw new AppError(
      "Live Reddit is not connected. Ask the operator to connect the source. Sample examples remain available.",
      503,
    );
  if (
    !Number.isFinite(budget) ||
    budget < MIN_PROVIDER_BUDGET_USD ||
    budget > 1 ||
    !Number.isFinite(hourlyBudget) ||
    hourlyBudget <= 0 ||
    hourlyBudget > 10
  ) {
    throw new AppError(
      "Live search needs an explicit server budget: LIVE_SCAN_BUDGET_USD must be at least 0.04 and at most 1; LIVE_HOURLY_BUDGET_USD must be above 0 and at most 10. No provider job was started.",
      503,
    );
  }
  return { token, budget, hourlyBudget };
}
