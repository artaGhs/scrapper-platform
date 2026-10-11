# Scrapper platform

Describe a business, run a bounded search, and review conversations where someone explicitly asks for a solution you offer. Each match shows the original words and an explanation; you decide whether to participate manually and transparently.

**[Open the deployed MVP](https://scrapper-platform-khaki.vercel.app)**

**Implemented MVP, October 11, 2026.** A Next.js app with sample demonstrations, a gated Reddit connector, optional Gemini search-phrase drafting, truthful progress, up to ten ranked results, and persistent Save / Not relevant feedback. Vercel uses free Neon Postgres; local development can use SQLite. Commercial source permissions and useful live coverage remain unresolved.

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

Set server-only `APIFY_TOKEN`, `LIVE_SCAN_BUDGET_USD` between $0.04 and $1, and `LIVE_HOURLY_BUDGET_USD` (at most $10). The shipped example disables live search. Set `LIVE_ACCESS_CODE` for a deployed pilot and enter it in the form. The code is never kept in browser storage. For this deployment the operator code is saved in ignored `.data/pilot-access-code`; configured source caps are $0.08 per run and $0.08 in hourly reservations. Optional `GEMINI_API_KEY` enables one grounded search-phrase draft per live scan; model failure falls back to the stated-keyword strategy. Matching and ranking use a disclosed conservative request-and-fit rubric, not model-generated buying intent.

Source jobs request between 10 and 50 records (the actor rejects lower limits), three phrases, a 180-second provider timeout, and an explicit source charge cap. Failed or uncertain job starts are not automatically repeated. Atomic reservations enforce the server's hourly source budget across sessions; model fees are separate and bounded by one request with a 512-token output cap. A $0 budget disables provider and model calls. Credentials stay server-side; public scan responses exclude source job IDs and owner secrets.

Three explicitly authorized source attempts reported **$0.092 total charges**. The first timed out with one community record; a five-item attempt was rejected without charge. The corrected ten-item attempt succeeded, returning **seven real posts with text, original URLs and publication dates**, all normalized correctly. None qualified for the uptime-monitor business: the returned posts used “monitor” in unrelated contexts, so useful search precision remains unproven. The separate model generation passed with **132 tokens**; estimated paid-tier cost was $0.0001188, not an observed billing charge. See [validation evidence](docs/validation.md). Sample cards are unmistakably fictional and have no invented original links or publication dates.

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

Instagram-wide discovery, automatic outreach, scheduled monitoring, customer validation and checkout are deferred. No Stripe or merchant account was created. Amazon Pay and AWS Marketplace SaaS billing are different options; the exact service required for hackathon AWS-track eligibility has not been confirmed. Vercel hosting is independent of that unresolved payment requirement.
