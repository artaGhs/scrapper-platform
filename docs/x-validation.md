# Reddit + X MVP extension — October 11, 2026

The deployed MVP now supports Reddit, X, or both from one description and one Run action. Source choice is part of durable idempotency. Each source has its own persisted job state, actual record count, queries and sanitized failure message. Selecting both reserves $0.02 for the validated ten-item X allowance and assigns the remaining source cap to Reddit; the two caps sum to the original reservation. A stopped/failed source cannot masquerade as an empty search or discard the other source's retrieved matches. Source-specific IDs keep feedback isolated. Existing Reddit scans resume their existing job and are never restarted by the upgrade.

## Current account and actor

Read-only authenticated API checks confirmed the account is **FREE** and had no prior runs of `apidojo/twitter-scraper-lite` before this validation. Its [documentation](https://apify.com/apidojo/twitter-scraper-lite) limits free users to **demo mode, ten items per run and five runs per month**, and requires one concurrent actor run. The public pricing table and headline rate alone do not establish entitlement.

The active API `pricingInfos` record, effective June 9, 2026, reports a $0.02 minimum charge cap, a FREE-tier query event of $0.016 and a tier-one item event of $0.0004. Those values were checked before starting; no older pricing record or paid-plan rate was assumed. The current build's `inputSchema` confirms `searchTerms`, `sort`, `maxItems` and `includeSearchTerms`. The adapter uses those fields, one query, `Latest`, ten items, a 180-second actor timeout and `maxTotalChargeUsd`. Language and thirty-day freshness are expressed inside the advanced query. No SocialData key was established, and none is required by this adapter.

The app's monthly X allowance defaults to five **global reservations**, retained independently of 24-hour scan cleanup. It was synced with this validation's one provider run. Duplicate submissions do not reserve another unit; failed/interrupted searches retain their reservation conservatively. An operator can sync external actor usage with `scripts/sync-x-allowance.ts`. Source errors can still occur when external activity consumes the provider's quota. The allowance may be changed within 1–1,000 only after separately verifying new entitlement; ten-item, time, charge and pilot-access caps remain. No subscription or top-up was purchased. The actor's availability does not establish commercial resale rights.

## One authorized live check

The user authorized one X test using existing credit, at most ten returned items and no more than $0.25 additional X validation spending. The actual job was capped at **$0.08**, with one query:

```text
(uptime) ("looking for" OR "anyone recommend" OR "is there" OR "alternative") lang:en -filter:retweets since:2026-09-11
```

| Observation                                       | Result                           |
| ------------------------------------------------- | -------------------------------- |
| Job state                                         | SUCCEEDED                        |
| Duration                                          | Approximately 6.9 seconds        |
| Returned / normalized records                     | 10 / 10                          |
| Original URLs / publication dates / nonempty text | Present on all ten records       |
| Qualified request-and-fit matches                 | 0                                |
| Final reported source charge                      | $0.020                           |
| Charged events                                    | One query and ten tier-one items |

The first terminal polling snapshot still reported $0. A subsequent **read-only** run lookup returned the final $0.020, and the private validation summary was reconciled to that amount. Inspecting the existing marker and job did not start another run. Total reported source-validation charges are **$0.112** across Reddit ($0.092) and X ($0.020). The separate Gemini paid-rate estimate remains $0.0001188; its actual billing charge was not inspected.

The stored actor input confirms the query arrived unchanged. Logs confirm the free-plan ten-item restriction. Returned content was largely unrelated or promotional; the logs do not prove why those posts were returned, or that free demo mode honored all search operators. A genuine empty fit result is appropriate. Successful retrieval does **not** validate focused discovery or general lead coverage.

A provenance example is [this technical X discussion](https://x.com/asmirkn/status/2109304844700053869), dated **2026-10-11T15:27:18.000Z** in the provider output, with 189 characters of text. It asks about retrieving machine metrics over Tailscale rather than requesting a website-uptime product, and was excluded. No retrieved post is presented as a qualified lead. Full private datasets, entitlement, input, log, final billing snapshot and the immutable validation marker are kept under ignored `.data/` paths.

## AI and validation boundaries

Gemini's actual generation check passed separately. In the app, Gemini drafts grounded Reddit phrases only when a live scan includes Reddit and the key is configured; failure falls back to keywords. X builds one deterministic advanced query from the same structured business terms. Categorization, capability extraction, explicit-request detection, fit filtering and ranking remain deterministic. Source-only live validations bypassed Gemini. Combined paid model-plus-source discovery has not been validated end to end.

Unit checks cover X URL/date/text normalization, source impersonation, distinct result IDs, bounded adapter input, source-aware idempotency, concurrent advances, both directions of one-source failure, global X concurrency and monthly allowance persistence after scan removal. Hosted browser checks retain the basic input/progress/results/save/reload flow, add X/both sample source isolation, and verify original X provenance with a **simulated** both-source partial failure. These checks make no additional paid source calls.

Instagram and TikTok are deferred until after the Reddit/X MVP; YouTube is outside scope. Replies remain manual and transparent. No automatic outreach, dashboard, new billing or merchant setup was added.
