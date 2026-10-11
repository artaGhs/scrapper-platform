import { AppError, MAX_ITEMS, PROVIDER_TIMEOUT_SECONDS } from "./config";
import type { Business } from "./types";

type Run = {
  id: string;
  defaultDatasetId: string;
  status: string;
  usageTotalUsd?: number;
};
function parseRun(value: unknown): Run {
  const data = (value as { data?: Partial<Run> })?.data;
  if (
    !data ||
    typeof data.id !== "string" ||
    !/^[\w-]+$/.test(data.id) ||
    typeof data.defaultDatasetId !== "string" ||
    !/^[\w-]+$/.test(data.defaultDatasetId) ||
    typeof data.status !== "string"
  ) {
    throw new AppError(
      "The source returned an unexpected job response. No automatic new job will be started.",
      502,
    );
  }
  return data as Run;
}
export class RedditProvider {
  constructor(
    private token: string,
    private budget: number,
    private fetcher: typeof fetch = fetch,
    private itemLimit = MAX_ITEMS,
  ) {}
  private async request(path: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await this.fetcher(`https://api.apify.com/v2/${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
    } catch {
      throw new AppError(
        "The source request timed out or lost its connection. An uncertain job start will not be retried automatically.",
        502,
      );
    }
    if (!response.ok) {
      const reason =
        response.status === 401 || response.status === 403
          ? "Check the source credential and access permissions."
          : response.status === 402
            ? "The provider account has no usable balance. Sample examples are still available."
            : response.status === 429
              ? "The provider is rate-limiting requests. Try again later."
              : "The provider could not complete this request. Try again later.";
      throw new AppError(reason, 502);
    }
    try {
      return await response.json();
    } catch {
      throw new AppError("The source returned an unreadable response.", 502);
    }
  }
  async start(business: Business): Promise<Run> {
    const limit = Math.max(1, Math.min(MAX_ITEMS, Math.floor(this.itemLimit)));
    const params = new URLSearchParams({
      timeout: String(PROVIDER_TIMEOUT_SECONDS),
      memory: "256",
      maxItems: String(limit),
      maxTotalChargeUsd: String(this.budget),
    });
    return parseRun(
      await this.request(`acts/trudax~reddit-scraper-lite/runs?${params}`, {
        method: "POST",
        body: JSON.stringify({
          searches: business.queries.slice(0, 3),
          startUrls: [],
          searchPosts: true,
          searchComments: false,
          searchCommunities: false,
          searchUsers: false,
          skipComments: true,
          skipCommunity: true,
          skipUserPosts: true,
          searchMedia: false,
          includeNSFW: false,
          maxItems: limit,
          maxPostCount: Math.ceil(limit / Math.max(1, business.queries.length)),
          maxComments: 0,
          sort: "new",
          time: "month",
        }),
      }),
    );
  }
  async poll(runId: string): Promise<Run> {
    return parseRun(
      await this.request(`actor-runs/${encodeURIComponent(runId)}`),
    );
  }
  async items(datasetId: string): Promise<unknown[]> {
    const result = await this.request(
      `datasets/${encodeURIComponent(datasetId)}/items?format=json&clean=true&limit=${MAX_ITEMS}`,
    );
    if (!Array.isArray(result))
      throw new AppError("The source returned an unexpected dataset.", 502);
    return result.slice(0, MAX_ITEMS);
  }
  async abort(runId: string): Promise<void> {
    await this.request(`actor-runs/${encodeURIComponent(runId)}/abort`, {
      method: "POST",
    });
  }
}
