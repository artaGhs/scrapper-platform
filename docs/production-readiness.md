# Public website review — October 11, 2026

This review covers the home page, research progress/results, saved-result and feedback flows, expired and failed requests, private developer access, metadata, privacy information, and missing-page/error recovery. Existing discovery changes in the workspace were preserved.

## Completed

- Public visitors see live Reddit research only. Sample controls, the fictional landing result, query diagnostics, model labels, and unfinished locked-report previews have been removed from the public experience.
- Sample creation, reads, advancement, and feedback require a signed developer session. This also protects historical sample scans created before the restriction. Developer live scans require authentication for reads and feedback as well as advancement.
- Public descriptions and error messages no longer advertise a prototype, suggest sample mode, expose server budget settings, or ask visitors to configure provider credentials.
- Free-search limits and the 24-hour result window are explicit. Expired results no longer leave a broken restoration button. A used allowance stays used after results expire.
- Non-JSON server failures get a readable message. Requests have a timeout, descriptions remain in the form after failures, and an unavailable connection can resume the existing search without creating a replacement job.
- Feedback buttons actually disable while saving. Missing or invalid discussion dates have a safe fallback.
- The footer links to a factual Privacy & data page explaining descriptions, providers, essential browser state, saved feedback, free-usage records, and current retention behavior.
- Custom 404 and runtime-error recovery pages are present. The developer route has noindex metadata; robots.txt excludes developer and API routes. Security headers disable unused camera, microphone, and geolocation permissions.
- Browser tests start an isolated production server with retrieval/model credentials disabled and their own local database. A configurable TEST_PORT avoids interrupting an existing local server. Lint excludes generated files from nested local worktrees.

## Remaining launch work

1. **Support and operator information:** provide the real operator/business identity and a monitored public support/privacy contact. There is currently no contact address, support form, or deletion-request channel. None was invented during this review.
2. **Terms and privacy decisions:** the new data page describes implementation behavior. A complete terms policy and an operator-approved privacy notice still need the actual business details and decisions about retention, provider processing, and handling requests.
3. **Data lifecycle:** access expires after 24 hours, but research rows are deleted when another search is created. Free-usage records outlive research and currently have no cleanup policy. Choose a retention policy and implement scheduled cleanup and a deletion workflow if required by that policy.
4. **Operations:** application-level error reporting, uptime alerts, and source-balance/capacity alerts are not configured in this codebase. Verify hosted database configuration, provider access, and budgets before release. The checks here did not launch a paid research job.
5. **After the free search:** public visitors get one started search per browser and up to three matches; there is no repeat-search purchase, subscription, or full-report flow. Decide whether the single free search is the intended public product. Cross-device accounts and access beyond 24 hours are also absent.
6. **Release operations:** production releases should stage the build, verify it, and then promote it to the public domain. Confirm source permissions and hosted behavior as part of the release process.

## Validation

54 unit/API tests and 11 browser scenarios passed. The production build, lint, and TypeScript checks passed. Desktop, mobile, and the data page were also reviewed visually.

The durable database update was applied and Neon validation passed for persistence, ownership, idempotency, feedback, shared budgets, source allowances, and advancement leases. Database capacity validation accounts for existing visitor reservations instead of assuming an empty database. Provider calls are simulated in these checks.

- Unit/API checks cover ownership, signed developer access, historical sample protection, bounded spending, source provenance, feedback, idempotency, throttling, and safe public configuration errors.
- Browser checks cover public content and metadata, privacy/404 navigation, layouts at 320/375/768/1440px, keyboard/reduced-motion behavior, sample flows behind developer access, saved feedback, restored free results, partial/empty outcomes, expired/private caches, and malformed server responses.
- Production build, lint, and TypeScript checks are included. Live provider accuracy and hosted infrastructure were not revalidated by spending on new scans.

Run `npm run build` before `npm run test:e2e`. Set `TEST_PORT` if the default 3173 is occupied. To test an existing external server, set `TEST_BASE_URL` and a private `TEST_DEVELOPER_ACCESS_KEY` for the authenticated sample checks; do not commit that key.
