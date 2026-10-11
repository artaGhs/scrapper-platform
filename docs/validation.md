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
