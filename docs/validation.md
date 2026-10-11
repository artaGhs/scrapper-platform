# MVP validation — October 11, 2026

## Paid validation boundary

The user authorized one tiny source/model validation, no top-ups, using existing credit and a combined maximum of $1. Exactly one Apify source job and one Gemini generation request were made. Provider status and dataset were inspected read-only afterward; no second source job was started.

| Check                  | Observed result                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| Apify Reddit Lite      | Requested maximum 15 records, $0.08 source charge cap, 180-second timeout                  |
| Source terminal state  | TIMED-OUT                                                                                  |
| Reported source charge | $0.024                                                                                     |
| Returned dataset       | One community record; no discussion-qualified items                                        |
| Qualified matches      | 0; no original opportunity links to report                                                 |
| Gemini 3.5 Flash-Lite  | Grounded query-drafting validation passed                                                  |
| Model usage            | 96 input tokens, 36 output tokens; total 132                                               |
| Model cost estimate    | $0.0001188 at published standard paid-tier rates; actual billing tier/charge not inspected |
| Combined estimate      | $0.0241188, below the authorized $1 maximum                                                |

Model pricing estimate uses [Google's official pricing](https://ai.google.dev/gemini-api/docs/pricing): $0.30 per million input tokens and $2.50 per million output tokens. No search-grounding tools were enabled. This is an estimate, not a provider billing receipt.

The [actor input schema](https://apify.com/trudax/reddit-scraper-lite/input-schema) documents `skipCommunity` independently of `searchCommunities`. The implementation now explicitly skips community records and user posts in addition to comments. This correction is covered by the adapter test but has not been confirmed with another paid job. The original validation is retained privately, including its job identifiers, under ignored `.data/` files.

## Functional evidence

- 14 unit tests cover request-and-fit matching, explicit capabilities, provenance URLs, duplicate/stale filtering, unknown dates, promotional rejection, bounded model output, session ownership, persistence, idempotency, concurrent paid-job prevention, uncertain starts, global source reservations and partial results.
- A real Neon validation passed persistence across store instances, ownership isolation, idempotent creation, feedback, concurrent global budget reservations and ten concurrent advances with exactly one **simulated** source start.
- Browser checks cover description → actual progress → results, saving, feedback, reload persistence, honest sample/empty states, mobile keyboard use, reduced motion, overflow, HTTP ownership, idempotency, read-only GET, cross-origin rejection and input limits.
- Production build, lint and TypeScript checks are part of deployment verification.

This establishes the prototype's mechanics. It does not establish useful live retrieval, commercial data permission, buying intent, customer demand or hackathon AWS payment eligibility. The public demonstration should use sample mode until those separate checks are resolved.

## Deployment verification

The Vercel production build completed and all four browser checks passed against the deployed application backed by Neon, including save/reload persistence and rejection of live requests without pilot access. The public URL is https://scrapper-platform-khaki.vercel.app. Deployment uploads explicitly exclude local environment files, private validation state and SQLite files; production credentials are configured through Vercel's private environment handling.

## Dependency and secret checks

`npm audit --omit=dev` reported **zero runtime vulnerabilities**. The full audit reported five high-severity dependency entries, all cascading from `braces` 3.0.3 through `micromatch` → `fast-glob` → `@next/eslint-plugin-next` → development-only `eslint-config-next`. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) describes stack exhaustion with deeply nested brace patterns and lists no patched version. npm also reports 3.0.3 as the latest braces release. Lint uses fixed repository patterns; user descriptions do not reach this dependency. No forced framework downgrade was applied. This development-tooling limitation remains open.

Known configured private values were checked without displaying them: no matches in tracked or proposed repository files, the deployed homepage, or its nine referenced public static assets. The deployed `/.env`, `/.env.local` and `/.data/pilot-access-code` paths all returned 404. This is a targeted check of known values and referenced assets, not a claim of an exhaustive security audit. The initial deployment that loaded a local environment file was replaced with an explicitly excluded upload and removed; there was no evidence of public secret exposure.
