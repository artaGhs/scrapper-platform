import { AppError } from "./config";
import { ApifyProvider, parseRun } from "./provider";
import type { Business } from "./types";

export function xSearchQuery(business: Business, now = Date.now()): string {
  // Product terms and an explicit-request phrase must occur together; no free-standing "monitor" search.
  const subject = [
    ...new Set(
      business.terms.flatMap(
        (term) => term.toLowerCase().match(/[a-z0-9-]+/g) || [],
      ),
    ),
  ].slice(0, 4);
  if (!subject.length)
    throw new AppError("Describe a specific product before searching X.");
  const phrase = business.categoryPhrase || subject.slice(0, 3).join(" ");
  const safePhrase = phrase.replace(/[^a-z0-9 -]/gi, "").trim();
  const since = new Date(now - 30 * 86400_000).toISOString().slice(0, 10);
  return `"${safePhrase}" "looking for" lang:en -filter:retweets since:${since}`;
}
export class XProvider extends ApifyProvider {
  constructor(
    token: string,
    budget: number,
    fetcher: typeof fetch = fetch,
    itemLimit = 10,
  ) {
    super(token, budget, fetcher, itemLimit);
  }
  async start(business: Business) {
    if (
      !Number.isInteger(this.itemLimit) ||
      this.itemLimit < 1 ||
      this.itemLimit > 10
    )
      throw new AppError(
        "The X pilot is limited to 1–10 records. No provider job was started.",
      );
    if (!Number.isFinite(this.budget) || this.budget < 0.02 || this.budget > 1)
      throw new AppError(
        "The X source needs a charge cap between $0.02 and $1. No provider job was started.",
      );
    const params = new URLSearchParams({
      timeout: "180",
      memory: "256",
      maxItems: String(this.itemLimit),
      maxTotalChargeUsd: String(this.budget),
    });
    return parseRun(
      await this.request(`acts/apidojo~twitter-scraper-lite/runs?${params}`, {
        method: "POST",
        body: JSON.stringify({
          searchTerms: [xSearchQuery(business)],
          sort: "Latest",
          maxItems: this.itemLimit,
          includeSearchTerms: true,
        }),
      }),
    );
  }
}
