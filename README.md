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

## Live pilot

Set server-only `APIFY_TOKEN`, `LIVE_SCAN_BUDGET_USD` ($0.04–$1), `LIVE_HOURLY_BUDGET_USD` (at most $10), and `LIVE_ACCESS_CODE`. The example disables live search. The operator code is stored only in ignored `.data/pilot-access-code`; the form never keeps it in browser storage. This controlled verification reserves at most $0.08 per scan and $0.24 across three scans, below the additional $0.25 authorization.

Reddit uses up to three category/problem searches, explicit Boolean syntax, and a small curated community set where available: calorie tracking uses r/caloriecount/r/loseit, Shopify uses r/shopify, uptime uses r/selfhosted. These community pages and Reddit's search syntax were checked; membership does not establish fit. Other categories use broader Reddit and disclose that scope. The past-year search shows actual dates and age rather than calling old posts fresh leads. No known example IDs are preloaded.

The actor requests at most 50 items, with a 180-second timeout and an explicit charge cap. Atomic reservations enforce the global hourly budget across sessions. Failed or uncertain starts are not repeated automatically. Keyword checks reject promotions, unrelated domains and explicit incompatibilities; optional offered features need not appear in an ask. Optional Gemini assesses up to five candidates in one 512-output-token request, accepts only exact source quotations, and removes uncertain/rejected cases. Remaining candidates use keyword rules. A model failure is disclosed and retains the keyword checks. Scores are fit ordering, never purchase probability. The legacy draft helper remains for historical tests; production queries use deterministic category/problem syntax.

Three explicitly authorized Reddit source attempts reported **$0.092 total charges**. The first timed out with one community record; a five-item attempt was rejected without charge. The corrected ten-item attempt succeeded, returning **seven real posts with text, original URLs and publication dates**, all normalized correctly. None qualified for the uptime-monitor business: the returned posts used “monitor” in unrelated contexts, so that historical query did not prove useful search precision. The separate model generation passed with **132 tokens**; estimated paid-tier cost was $0.0001188, not an observed billing charge. See [validation evidence](docs/validation.md). Sample cards are unmistakably fictional and have no invented original links or publication dates.

**Useful hosted proof:** submitting the photo-calorie app through the production form retrieved ten real Reddit posts and retained three relevant conversations, whose original pages and source text were manually checked. They include an app request, a photo-estimation problem, and an older simpler-journaling replacement request. Dates/ages are explicit; none is claimed as a ready-to-buy customer. This run cost $0.08, taking historical source charges to $0.192 before final verification. [Evidence and original links](docs/validation.md).

The first three matches are visible. If more actual matches exist, the API returns their real count and an informational locked preview; hidden titles/text/links stay on the server. There is no checkout, subscription, trial or working unlock action. Future paid access is documented rather than simulated.

X is deferred from the public launch and rejected by the public scan-creation API. Its connector and historical tests remain in the repository. Its earlier free-demo check returned ten real posts, zero qualified matches, and cost $0.020; useful X discovery was not proven. Historical Reddit/X source charges before final hosted verification total $0.112. See [historical X validation](docs/x-validation.md).

## Durable Vercel deployment

Connect the project to a free Neon database, provide `DATABASE_URL`, and run:

```sh
npm run db:setup
npm run test:database
npm run build
```

`db/schema.sql` creates an isolated `scrapper` schema with owner-scoped state, transaction-protected creation and feedback, and atomic advancement leases. Vercel never falls back to ephemeral SQLite. Configure provider credentials as private environment variables; require pilot access before enabling any live budget. No paid add-ons are needed for this MVP.

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
