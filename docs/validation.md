# MVP validation — October 11, 2026

## Paid validation boundary

The user authorized validation using existing credit, no top-ups, and a combined maximum of $1. After read-only investigation of the first run, the user authorized one bounded additional source attempt. That five-item attempt was rejected without charge; the user then explicitly approved one corrected ten-item check capped at $0.08. No further Reddit source jobs were started. One separate Gemini generation request was made. The later, separately authorized X check is recorded in [X validation](x-validation.md): $0.020, ten real posts, zero qualified matches. Total reported Reddit/X source charges are $0.112.

| Source attempt                     | Requested records / charge cap | Terminal state              | Reported charge | Returned evidence                                         |
| ---------------------------------- | ------------------------------ | --------------------------- | --------------- | --------------------------------------------------------- |
| Initial check                      | 15 / $0.08                     | TIMED-OUT                   | $0.024          | One community; no usable discussions                      |
| Corrected adapter, five-item check | 5 / $0.05                      | FAILED: minimum 10 required | $0              | No records                                                |
| Explicitly approved ten-item check | 10 / $0.08                     | SUCCEEDED                   | $0.068          | Seven posts; all seven normalized; zero qualified matches |

**Total reported source charges: $0.092.** The successful run completed in approximately 33.7 seconds. All seven posts had nonempty text, original discussion URLs and publication dates. The app correctly produced an empty result for the supplied uptime-monitor business; successful retrieval does not establish useful lead coverage.

The separate Gemini 3.5 Flash-Lite generation passed with 96 input tokens and 36 output tokens (132 total). Its estimated paid-tier cost is $0.0001188, making the combined source charges plus model estimate **$0.0921188**, below $1. Model pricing uses [Google's official pricing](https://ai.google.dev/gemini-api/docs/pricing): $0.30 per million input tokens and $2.50 per million output tokens. No search-grounding tools were enabled. The model amount is an estimate; its actual billing charge was not inspected.

Run identifiers, original datasets, sanitized logs, usage summaries and one-run markers remain in ignored private `.data/` files. Public evidence omits credentials, private identifiers and unrelated personal posts.

## Functional evidence

- 28 unit tests cover request-and-fit matching, explicit capabilities, provenance URLs, duplicate/stale filtering, unknown dates, promotional rejection, bounded model output, session ownership, persistence, idempotency, concurrent paid-job prevention, uncertain starts, global source reservations and partial results.
- A real Neon validation passed persistence across store instances, ownership isolation, idempotent creation, feedback, concurrent global budget reservations and ten concurrent advances with exactly one **simulated** source start.
- Browser checks cover description → actual progress → results, saving, feedback, reload persistence, honest sample/empty states, mobile keyboard use, reduced motion, overflow, HTTP ownership, idempotency, read-only GET, cross-origin rejection and input limits.
- Production build, lint and TypeScript checks are part of deployment verification.

This establishes the prototype's mechanics and a bounded retrieval of real posts. It does not establish useful search precision or lead coverage, commercial data permission, buying intent, customer demand or hackathon AWS payment eligibility. The public demonstration should use sample mode until those separate checks are resolved.

## Deployment verification

The Vercel production build completed and all six browser checks passed against the deployed application backed by Neon, including save/reload persistence and rejection of live requests without pilot access. The public URL is https://scrapper-platform-khaki.vercel.app. Deployment uploads explicitly exclude local environment files, private validation state and SQLite files; production credentials are configured through Vercel's private environment handling.

## Dependency and secret checks

`npm audit --omit=dev` reported **zero runtime vulnerabilities**. The full audit reported five high-severity dependency entries, all cascading from `braces` 3.0.3 through `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → development-only `eslint-config-next`. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) describes stack exhaustion with deeply nested brace patterns and lists no patched version. npm also reports 3.0.3 as the latest braces release. Lint uses fixed repository patterns; user descriptions do not reach this dependency. No forced framework downgrade was applied. This development-tooling limitation remains open.

Known configured private values were checked without displaying them: no matches in tracked or proposed repository files, the deployed homepage, or its nine referenced public static assets. The deployed `/.env`, `/.env.local` and `/.data/pilot-access-code` paths all returned 404. This is a targeted check of known values and referenced assets, not a claim of an exhaustive security audit. The initial deployment that loaded a local environment file was replaced with an explicitly excluded upload and removed; there was no evidence of public secret exposure.

## Source investigation and minimum correction

Read-only inspection of the first run's actual input and logs confirmed `searchPosts: true` and `searchCommunities: false`, but the independent `skipCommunity` flag defaulted to false. Reddit returned HTTP 429 and 403, the actor fell back to browser crawling, queued subreddit pages and timed out. The one returned record was a community, not a post. The app correctly excluded it; the actor's crawling and blocking behavior prevented usable retrieval.

The first run used 256 MB while the actor's metadata specifies a 2,048 MB default; observed memory peaked near 479 MB. The adapter now requests the default 2,048 MB, explicitly skips communities/users/comments, retains post-only search, sets `ignoreStartUrls: true`, keeps fast extraction (`includeMediaLinks: false`), and bounds navigation/scroll waits to 20/10 seconds. Increased memory addresses undersizing; it does not prove that blocking is solved. The [actor documentation](https://apify.com/trudax/reddit-scraper-lite) describes these controls and the [input schema](https://apify.com/trudax/reddit-scraper-lite/input-schema) documents their bounds.

The subsequently authorized five-item check failed before retrieval with **Invalid input** and **$0 reported charge**. Its log explicitly requires at least **10 requested items**, a minimum missing from the public input table. Actor pricing metadata also reports a **$0.04 minimum charge cap** and a startup event per GB of memory. Both minimums are now checked locally before starting a source job. An invalid five-item or under-budget request is tested to make zero provider HTTP calls.

The user then explicitly approved one corrected ten-item check capped at $0.08, with a single `uptime monitor recommendation` query. Its immutable private marker prevents automatic new runs; the script checks prior recorded charges before starting. The maximum possible total source-validation spend under these approvals is $0.104, below $1. No purchase, top-up or blind retry occurred.

## Successful retrieval and remaining precision limit

The corrected run's logs confirm the intended query reached the actor unchanged: `uptime monitor recommendation`, with `sort=new`, `t=month` and `type=posts`. Two HTTP 403 responses were retried within that same job; its final status reported 11 successful requests and no failed requests. No second job or paid retry was launched.

The returned posts all used “monitor” in unrelated contexts; none mentioned “uptime”. The logs establish that the adapter sent the correct search, but do not establish why the source returned such broad matches. The fit filter rejected them rather than manufacturing opportunities. As a concrete provenance check, one [hardware-monitor discussion](https://www.reddit.com/r/Monitors/comments/1x3dz55/anyone_using_the_msi_mag_274updf_e16m_with_a_ps5/) had a provider publication date of `2026-10-11T17:24:52.000Z` and 519 characters of body text. It was correctly excluded from the website-uptime business's results.

Retrieval, provenance normalization and rejection of unrelated posts are validated. Useful discovery remains unproven; further query/source experiments require separate authorization and are outside this completed check.

## Gemini's precise role

Gemini is integrated into the application's live `interpreting` stage for scans containing Reddit when `GEMINI_API_KEY` is configured. It drafts up to three grounded search phrases from the supplied description and the heuristic's stated terms. The service then passes those phrases to the Reddit provider. X-only scans do not call Gemini: they combine grounded product terms with explicit-request phrases in one deterministic advanced query. The application-stage wiring and fallback on model failure are covered by an injected-model test. The actual API generation check succeeded with 96 input and 36 output tokens; it was more than a connectivity check.

Business categorization, capability extraction, explicit-request detection, fit filtering and ranking remain deterministic heuristics. Sample mode does not call Gemini. Source validation deliberately injects the provider and bypasses model generation so it isolates retrieval and adds no model spending. Neither model-powered interpretation nor model-powered lead scoring is claimed.

A completed source job returning usable discussion records with no qualifying fit remains a valid empty result. Unexpected record types or a stopped job with no usable discussions are treated as source failures, not evidence that no matching conversations exist. Partial jobs with usable discussion records can still show only their actually retrieved qualified results.

## Final Reddit-only quality changes

The historical runs above tested the earlier pipeline. The final pipeline uses focused Boolean category/problem queries scoped to verified public communities where known, rather than mandatory request wording. Reddit's [official search documentation](https://support.reddithelp.com/hc/en-us/articles/19696541895316-Available-search-features) confirms plain post searches may match only some words, and supports uppercase AND/OR and parentheses. The actor's [input documentation](https://apify.com/trudax/reddit-scraper-lite/input-schema) supports searches and a year window. Queries, community scope and rationale remain visible in the app. Existing transport results do not prove this revised pipeline.

A single optional Gemini call assesses up to five candidates using original context, exact quotation validation and accept/reject/uncertain decisions. Missing optional features are not a rejection; explicit incompatible constraints and promotions are. Sample mode makes no model calls. Failure preserves keyword matches with a disclosure. Original text/URLs/dates remain unchanged. Fit scores are not buyer probabilities. X has been removed from the public launch.

37 offline tests pass, including unrelated-domain and explicit-constraint exclusions, category requests without every feature, separate problem/request labels, exact model evidence, failure fallback, once-only review persistence, ownership, idempotency, shared caps, and deferred X safeguards. Type checking, lint and production build pass. Final hosted proof and actual reported source charges are appended after verification.

## Hosted useful-result verification, October 11, 2026

The business description was submitted through the production form: an app estimating calories from food photos instead of manually entering ingredients. The hosted Vercel → Neon → Apify → normalization → qualification → Gemini → results path succeeded, retrieving **10 actual posts, retaining three relevant conversations**, with **$0.080 final reported provider charge**. Save and reload persisted in the same browser session. All three original links were opened and their text manually compared to the returned records. These were independently retrieved by the app, not preloaded examples or the earlier web-search benchmarks.

| App-found original                                                                                                                 | Provider publication date (UTC) | Manually verified relevance                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Cafeteria meal estimate](https://www.reddit.com/r/caloriecount/comments/1wtq5x0/calorie_estimate_for_this_cafeteria_meal_before/) | September 29, 2026              | Asks for calorie estimation from before/after food photos. **Problem discussion**, not an app recommendation request.                                                              |
| [Which calorie-counting app?](https://www.reddit.com/r/loseit/comments/1wqo2wc/which_calorie_counting_app_do_u_recommend_yazio/)   | September 26, 2026              | Requests a calorie/nutrient app and discusses the value of photo AI. Review its additional nutrient and usability needs; capabilities not stated by the business are not promised. |
| [Moving on from Fitbit](https://www.reddit.com/r/loseit/comments/1tnuwww/moving_on_from_fitbit_whats_the_next_best_thing/)         | May 26, 2026                    | Food journaling is the author's most important use; asks for a simpler replacement. Older category fit, not a fresh or photo-specific lead. No wearable integrations are promised. |

Gemini actually accepted two of these contexts in this hosted run; the third used the disclosed keyword rules because only the first five candidates are assessed. This is the first useful combined application/source/model proof. The final classification patch distinguishes photo-estimation problems from software requests and recognizes replacement language. RSS transport footers are stripped without changing source words.

The actor encountered repeated Reddit HTTP 429 responses, succeeded in about 131 seconds, and stopped at its explicit $0.08 cap. It returned ten records; this is bounded retrieval, not exhaustive coverage. Historical source charges plus this run total **$0.192**. Additional verification is controlled by a private ledger with at most three $0.08 reservations (**$0.24**, within the latest additional $0.25 authorization). No purchase, upgrade, new provider, automatic outreach or known-ID special case was used.

The final preview returns up to three qualified results plus their actual total/hidden count. Additional titles, text, IDs and original links remain server-side. Decorative locked previews represent only actual additional matches; there is no checkout or unlock action. Pricing, subscriptions and entitlement access remain future work.

The final precision pass was tested against the already-returned real dataset without another paid call. General diet distress, meal ideas and coaching requests no longer qualify as software needs; category replacement requests and direct food-photo estimation questions remain. Final offline suite: 37 passing tests.

## Final release checks

A second hosted photo-calorie scan on the updated classification/preview build returned ten normalized real posts, retained **two**, and finished **partial** after source work hit its limits. Both were assessed by Gemini; their original source text, URLs and dates remained visible. One asks for a free calorie/nutrient/weight-logging app (October 8); price and manual-entry requirements are extra context, not capabilities promised by the photo example. The other is the September 26 photo-AI/app discussion already listed. No nonexistent third result or locked preview was shown. This check reported **$0.080**, so additional source verification cost **$0.160**, below the latest **$0.25** cap; total reported historical/release source charges are **$0.272**. No further paid validation is planned.

The user's final clarification treats ordinary tracking questions and friction as opportunities even without an app recommendation request. “How do you guys track your calories? This is very hard” and “Tracking calories is so tedious” pass with original evidence and the **Problem context** label in the focused acceptance test. The problem query now includes this ordinary wording. This last recall change was checked offline, not with another paid provider/model call. Request language adds a label; it is not a universal acceptance requirement or a buyer-probability signal.

The release has **37 passing offline tests**, **six passing hosted browser checks**, strict type checking, lint and production build, plus earlier Neon persistence/concurrency validation. The final review found no material UI issues. The different-business uptime examples and recorded unrelated source dataset remain offline/negative checks; focused live uptime coverage has not been demonstrated. Useful live proof is the calorie/photo/food-journaling niche.

## Anonymous public release

The pilot-code field, `x-live-access` request header, API authorization check, and production `LIVE_ACCESS_CODE` variable were removed. Production Apify, Gemini and Neon configuration was reused privately; no public credential variables were introduced. Anonymous scans retain the $0.08 per-run and $0.24/hour source reservation caps, now also bounded to $0.24 over a rolling 24 hours. Prior reservations count toward capacity. No budget was increased.

Durable admission limits: 30 creation requests/minute/connection and 90 advancement requests/minute/connection; two live scans/hour/session or connection; one active scan/session; existing 20 total scans/hour/session. Connection identities are server-keyed IP hashes, excluded from public scan bodies. The connecting-IP header follows [Vercel's request-header documentation](https://vercel.com/docs/headers/request-headers); local arbitrary identity headers are ignored. Shared budget, idempotency and advancement leases still prevent duplicate spending. Capacity failures are HTTP 429 with a clear retry message.

New offline tests check code-free anonymous admission with zero network calls, hourly-reset-resistant daily limits, replacing sessions without bypassing connection limits, request-throttle recovery and private fingerprint handling. `scripts/validate-public-limits.ts` verifies PostgreSQL atomic daily reservations, connection limits, idempotency and ownership using temporary simulated records, then cleans them up. No source/model job is started. Browser tests simulate capacity and live responses so they cannot trigger paid retrieval. Earlier real Reddit evidence above remains the live-quality proof.

Public-release checks: 42 offline tests, six local browser checks, strict type checking, lint, production build, durable Neon admission/concurrency checks, and a known-value secret scan across source and generated browser assets all passed. No additional paid retrieval was performed.

## One small free research run

The final user-authorized source ceilings are $1 per rolling hour and $5 per rolling 24 hours, with a hard $0.08 public free-run ceiling. The Reddit actor requests ten candidates, its supported minimum, in one bounded source job. Up to three qualified results are retained; free runs have no collected full-report/blurred expansion. Gemini remains a bounded separate cost. Prior source reservations still count.

A durable `free_usage` ledger consumes one allowance per browser identity immediately before a provider-start attempt. Confirmed rejected/unstarted jobs release the allowance and unused reservation; uncertain starts retain both and are never automatically retried. Idempotent requests and polling reuse the same scan. Saved free results are restored from server state for 24 hours; the usage ledger remains durable after result expiry and the anonymous cookie renews for 30 days. Cookie deletion/new browsers create different identities, so the limit is not one run per human. Ten live creations/hour/connection allows shared Wi-Fi visitors, alongside existing 30 creation and 90 advancement requests/minute and global budgets. No paid entitlement, account, CAPTCHA or checkout was added.

Offline/mock checks cover one free run, retained three-result limit, ten-candidate adapter arguments, saved-result reloads, unknown-start consumption, confirmed rejection release/retry, cookie-identity limitations, client entitlement rejection, and durable PostgreSQL usage/admission. No new provider/model job was run.

Final free-tier checks passed: 46 offline tests, six local browser checks, strict type checking, lint, production build, and durable Neon free-allowance/concurrency/release checks. Real source-validation charges remain $0.272; no new paid source/model experiment was performed.

## Post-launch uptime run and budget headroom

The user's October 11 uptime scan retrieved ten real Reddit posts and stopped at the original $0.08 cap. Recorded Apify status was ABORTED with an explicit maximum-cost message, not a source timeout. Ten normalized posts reached review; no result passed final business-fit review. The displayed generic “finished with gaps” message obscured that the entire small free batch had been reviewed. Read-only source inspection found repeated 429 retries and the explicit cost stop; no new source/model job was started.

The user then authorized changing the easily reached run ceiling. It is now $0.12 per free source run, still exactly ten candidates and up to three retained matches; $1/hour and $5/rolling day remain unchanged. These permit at most eight maximum-cap reservations/hour and 41/day; actual source charges and Gemini cost are separate. A full ten-post batch stopped explicitly at the cost ceiling completes bounded retrieval; shorter batches, timeouts and unexpected aborts stay partial. Empty results now state how many posts were returned and that none passed fit checks. The affected saved scan is corrected without changing results, billing, free usage, or starting another job.

Budget/status fix checks: 47 offline tests, seven local browser checks, strict type checking, lint, production build, and known-value source/browser-asset secret inspection passed. The new status cases distinguish full cost-stopped batches from shorter batches, timeouts, and unexpected aborts. No new paid validation run was performed.
