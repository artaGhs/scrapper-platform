# Scrapper platform

Describe a business, run a bounded search, and review conversations where someone asks for a relevant solution or discusses the problem you solve. Each match shows the original words and an explanation; you decide whether to participate manually and transparently.

**[Open the deployed MVP](https://scrapper-platform-khaki.vercel.app)**

**Implemented MVP, October 11, 2026.** Reddit-only public launch: one description, a bounded live scan, original text/URLs/dates, source-supported fit, request/problem labels, and persistent Save / Not relevant feedback. Sample examples remain clearly fictional. Vercel uses free Neon Postgres; local development can use SQLite. The hosted calorie-photo example retrieved ten real posts and three manually verified relevant conversations for $0.08; coverage varies by category.

## Codebase requirement

Application logic, API routes, provider adapters, storage integrations and operational scripts use TypeScript with strict type checking. Future AWS integration logic must also be implemented in TypeScript once the exact eligible service is confirmed. Conventional framework/tool configuration files may use JS/MJS.

## Run locally

Node 22.13 or newer is required.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://127.0.0.1:3000. Sample mode works without provider keys. Never overwrite an existing private environment file. Scans belong to an opaque HttpOnly browser session and expire from access after 24 hours; expired rows are removed when another scan starts. Losing the session cookie loses access to saved scans.

## Public live research

Set server-only `APIFY_TOKEN`, optional `GEMINI_API_KEY`, `DATABASE_URL`, and explicit source budgets. Visitors enter only their business description; no access code, account or provider key is required. Production caps each free run at $0.12, with $1 per rolling hour and $5 per rolling 24 hours in shared source reservations (at most eight maximum-cap reservations/hour and 41/day; model cost is separate). The local example disables live search.

Reddit searches posts and comments across Reddit using product and problem keywords. Known categories receive two Reddit-wide queries plus one additional focused query: calorie tracking uses r/caloriecount/r/loseit, Shopify uses r/shopify, and uptime uses r/selfhosted/r/webdev/r/sysadmin. Other categories receive three Reddit-wide keyword queries. Preferred communities never restrict the wider queries. Results use relevance sorting, with a past-year post search and a separate age check for returned dated records. Comments retain their own text, date and direct original URL; qualification runs before retaining one best result per thread. No known example IDs are preloaded.

The public free actor run requests exactly ten raw candidate records (the provider-supported minimum), with a 180-second timeout and an explicit charge cap. Atomic reservations enforce global hourly and rolling daily budgets across sessions. Admission allows 30 creation requests per minute and 90 advancement requests per minute per connection, ten live scans per hour per connection, one active scan per session, and 20 total scans per hour per session. IP identifiers use a server-keyed hash and remain private. Capacity errors include a retry message and HTTP 429 with Retry-After. Failed or uncertain starts are not repeated automatically. Keyword checks reject promotions, unrelated domains and explicit incompatibilities; optional offered features need not appear in an ask. Optional Gemini assesses up to five candidates in one 512-output-token request, accepts only exact source quotations, and removes uncertain/rejected cases. Remaining candidates use keyword rules. A model failure is disclosed and retains the keyword checks. Scores are fit ordering, never purchase probability. The legacy draft helper remains for historical tests; production queries use deterministic category/problem syntax.


**Broader discovery verification:** an authorized $0.08 uptime search returned ten records from six communities, including four comments. Four records reached the keyword candidate stage; Gemini retained one actual request for an uptime monitor for client sites in r/webhosting. This establishes broader retrieval for that example, not guaranteed coverage or willingness to pay. [Query, comment and validation details](docs/broader-reddit-search.md).

Three explicitly authorized Reddit source attempts reported **$0.092 total charges**. The first timed out with one community record; a five-item attempt was rejected without charge. The corrected ten-item attempt succeeded, returning **seven real posts with text, original URLs and publication dates**, all normalized correctly. None qualified for the uptime-monitor business: the returned posts used “monitor” in unrelated contexts, so that historical query did not prove useful search precision. The separate model generation passed with **132 tokens**; estimated paid-tier cost was $0.0001188, not an observed billing charge. See [validation evidence](docs/validation.md). Sample cards are unmistakably fictional and have no invented original links or publication dates.

**Useful hosted proof:** submitting the photo-calorie app through the production form retrieved ten real Reddit posts and retained three relevant conversations, whose original pages and source text were manually checked. They include an app request, a photo-estimation problem, and an older simpler-journaling replacement request. Dates/ages are explicit; none is claimed as a ready-to-buy customer. The first run cost $0.08. A second bounded hosted check retained two actual matches from ten returned posts and honestly showed partial source completion; it also cost $0.08. Total reported historical and release source charges are $0.272. [Evidence and original links](docs/validation.md).

Live research is the default and open to anonymous visitors within shared capacity. Each anonymous browser identity gets one started free search. A durable allowance survives reloads and the 24-hour result expiry; the cookie renews for 30 days. Clearing cookies or changing browsers creates a new identity, so this is not one run per human. A confirmed rejection before provider startup releases the unused allowance/reservation; an uncertain start remains consumed to prevent duplicate charges. The free run retains at most three qualified results and does not collect a full report for blurred previews. Empty/partial runs may return fewer. Previously saved results can be restored for 24 hours. Larger research, payments, subscriptions and trials are future work; client entitlement claims are rejected. Fictional sample mode remains separate.

X is deferred from the public launch and rejected by the public scan-creation API. Its connector and historical tests remain in the repository. Its earlier free-demo check returned ten real posts, zero qualified matches, and cost $0.020; useful X discovery was not proven. Historical Reddit/X source charges before final hosted verification total $0.112. See [historical X validation](docs/x-validation.md).

## Durable Vercel deployment

Connect the project to a free Neon database, provide `DATABASE_URL`, and run:

```sh
npm run db:setup
npm run test:database
npm run build
```

`db/schema.sql` creates an isolated `scrapper` schema with owner-scoped state, transaction-protected creation and feedback, and atomic advancement leases. Vercel never falls back to ephemeral SQLite. Configure provider credentials as private environment variables; configure bounded public admission before enabling any live budget. No paid add-ons are needed for this MVP. `scripts/validate-public-limits.ts` checks durable anonymous throttles and atomic daily limits without any provider/model call.

## Checks

```sh
npm run test
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests default to http://127.0.0.1:3173; use `TEST_BASE_URL` to check another running server. Set `CAPTURE_SCREENSHOTS=1` when intentionally refreshing the committed browser evidence; ordinary checks leave those files untouched. `npm run test:database` uses the configured Neon database, creates temporary validation scans, uses a simulated provider, and removes those scans. It does not make paid source calls. The `scripts/validate-*.ts` live validation scripts require explicit authorization and retain private one-run markers to prevent accidental repeated spending.

## Research and deferred work

[Research](docs/research.md) records competitors, source limitations, customer hypotheses and proposed economics. [MVP plan](docs/mvp-plan.md) is the original implementation specification. Neither validates demand, source rights, or a subscription price.

X, Instagram and TikTok are deferred from this Reddit-only release. YouTube is outside scope. Automatic outreach, scheduled monitoring, customer validation and checkout remain deferred. No Stripe or merchant account was created. Amazon Pay and AWS Marketplace SaaS billing are different options; the exact service required for hackathon AWS-track eligibility has not been confirmed. Vercel hosting is independent of that unresolved payment requirement.

## Private developer mode

Open `/developer` and enter the server-only `DEVELOPER_ACCESS_KEY` (a random secret of at least 32 characters). A signed, HttpOnly, Secure-on-HTTPS cookie binds developer access to this browser's anonymous session for seven days. The private production key is available to the operator in the ignored `.data/developer-access.txt`; it is never included in deployed pages, URLs or browser bundles. Rotate the environment variable and redeploy to revoke existing developer sessions. Use **Leave developer mode** to return to public limits.

Authenticated developer runs bypass the free-usage ledger, request and session/connection quotas, and shared hourly/daily reservations. Developer reservations are excluded from visitor capacity while retaining private cost records. A new run key allows immediate repeat searches for the same description; retries with the same key remain idempotent. Anonymous/client-supplied developer flags never grant access, and advancement of a developer scan requires current developer authentication. Each live test still uses the ten-candidate batch, three-result view, per-job source cap and timeout; this is unlimited repeat access, not an unbounded individual crawl. Source/model account balances and hosting limits still apply.
