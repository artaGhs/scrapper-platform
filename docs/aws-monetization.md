# ThreadFinder payments

The current setup uses AWS project `826674371115`. Application resources and Cognito are in `us-east-2`; the user authorized the installed AWS App Monetization SDK's billing endpoint in `us-west-2`. Seller onboarding is **ACTIVE**. Paid plans are **drafts**, and production payments remain disabled pending the explicit publish/go-live confirmation required by the Monetize skill.

| Offer | Monthly price | Searches |
| --- | --- | --- |
| Trial | Free for seven days | One full search, once per verified account |
| Starter | $10 | 10 per billing month |
| Pro | $24 | 30 per billing month |

Overage is blocked. The trial requires no card and does not automatically convert into a paid subscription. The originally authored recurring free trial plan was archived; the application enforces the timed trial through a durable database allowance.

## Current resources

| Resource | Identifier |
| --- | --- |
| Billing app | `01a12d00146379069539c5647a289177` |
| Completed searches metric | `01a12d0118427d32afe0a01c18230868` |
| Starter plan | `01a12d0274d17c83a9ae1ad1d804cc1b` |
| Pro plan | `01a12d027809780d95b4b0b967e7091f` |
| Cognito pool | `us-east-2_s8FyYC1Ym` |
| Billing execution role | `ThreadFinderBilling-01a12d00` |

The metric counts `search_completed` events grouped by `user_id`. Monthly entitlement enforcement is delegated to AWS. Usage aggregation is asynchronous, so immediately successive requests can see an earlier usage count; existing application concurrency and provider spending limits also apply. This is not a hard synchronous distributed quota counter.

## Customer flow

Customers sign in through Cognito managed login using email verification and mandatory authenticator MFA. OAuth uses authorization code exchange, PKCE, nonce and signed state. The server verifies the identity token's signature, issuer, audience and expiry. A hash of issuer and subject becomes the durable customer identity; browser-provided identities cannot override it. The identity token is held in an HttpOnly cookie and expires after its token lifetime; the customer signs in again through Cognito rather than storing a refresh token in the app.

The staged deployment uses `DATABASE_SCHEMA=scrapper` to preserve the existing live database namespace during the branding rollout. It does not rename tables used by the current public app. Remove that override when applying the coordinated namespace migration in `db/schema.sql`. A real database read and repeated trial lookup verified this compatibility configuration.

The database records the trial start once and retains its consumed allowance across cookies, browsers and result expiry. Trial and paid searches expose up to ten collected qualified results. Trial expiry and paid entitlement checks happen before provider work. Failed and fictional sample searches are not metered; completed, empty and partial paid searches submit an idempotent usage event using the scan ID. Billing transport errors fail closed.

`/billing` links to account sign-in, AWS-hosted plan selection and subscription management. Each checkout or portal button mints a fresh hosted session through a same-origin POST. Return URLs and the customer identity are server controlled, requests are throttled, and responses use `Cache-Control: no-store`. The bootstrap session endpoint performs no remote billing calls. Local AWS checkout evaluation requires `localhost`; the beta request filter rejects `127.0.0.1` return URLs.

## Runtime credentials

Hosting uses Vercel OIDC to assume the dedicated execution role. Its trust is restricted to the exact Vercel team, project and allowed environments. The application feeds a renewable OIDC token file into the billing SDK's default AWS credential chain; no root credentials or static AWS keys are deployed. Local private configuration and registry credentials are excluded from function traces.

The [runtime policy](aws-billing-runtime-policy.json) grants only five billing runtime actions. Real service calls rejected app-specific resource ARNs and also rejected a RequestedRegion condition. The private beta currently works with `Resource: "*"` for these actions. This policy therefore scopes **actions and trusted execution identity**, not individual billing apps. It grants no app/plan authoring, publishing, merchant management or AWS infrastructure administration. Revisit resource scoping when the beta supports it. IAM Policy Autopilot was attempted but does not recognize the private beta service namespace.

## Verification and activation

The current role passed a real OIDC exchange, caller identity check, hosted pricing-session creation and absent-subscription lookup. The application's actual default credential chain was independently exercised using that role. Seller status was read as ACTIVE. Current automated checks cover token validation, state tampering, durable trial consumption/expiry, paid entitlement denial, identity isolation, session creation and usage idempotency. 80 automated tests, 17 browser tests, lint, strict type checking and the production build passed. The staged deployment passed its session bootstrap, billing-page render and Cognito redirect checks, including PKCE and the protected state cookie. It remains unpromoted to the primary domain with payments disabled. No live card purchase has been made.

The deleted earlier test app was separately verified end to end: sandbox checkout activated a paid subscription, usage events were accepted, replay did not increase usage, and eventual quota denial was observed. Those results demonstrate the SDK workflow but do not substitute for a current live customer purchase. The old app `01a12cee8488781eb0ad04dc5602115b` was deleted at the user's request and must not be reused.

After explicit go-live confirmation, publish the current app through the skill's signing script, set `MONETIZATION_ENABLED=true` and `MONETIZATION_LIVE_APPROVED=true`, and deploy the live ARN. The code rejects sandbox billing on production hosting and live billing without activation approval. A human should complete the first real customer sign-in and paid checkout before claiming live purchase verification.

Private setup bodies, seller details, tokens and verification evidence remain in ignored `.monetize/` and `.env.monetization`. Resolve the existing app from its configuration and run preflight before further authoring; do not discover it by matching names. The AWS MCP connection still targets the old project and must not provision resources in this one.
