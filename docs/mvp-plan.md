# Executable MVP specification

Planning date: **October 11, 2026**. Target: approximately four hours of future implementation by an experienced builder with a ready environment and feasible source. This is an estimate, not a delivery promise. Current authorization is research/planning and GitHub setup; the steps below have not been implemented.

## 1. Outcome and scope

A business owner describes a product in a few sentences, presses **Run**, sees real search stages, and receives up to ten genuinely strong opportunities with original links and concise reasons. A result is a conversation to review, not a guaranteed buyer.

Use Next.js/React, one simple landing/chat page, one working source, server-mediated retrieval, bounded AI ranking, and lightweight persistent scan/results state. Provider jobs handle long-running retrieval. No custom crawler, elaborate agent system, separate queue, or multi-service infrastructure is required for the prototype.

Deferred: accounts and billing, daily monitoring and email digests, multiple businesses/sources, teams, agency workflows, Instagram-wide discovery, and automatic posting. Editable reply drafts are optional only after the essential flow works. A future monitoring product requires a provider that actually permits recurring retrieval; Tweet Scraper V2's restrictions make that a separate provider decision. [Provider research](research.md).

## 2. Single-page experience

Suggested hero: **“Find people asking for what your business offers.”** Short supporting text explains that the tool finds public conversations the owner can review and join. The same page contains the business input and result area; avoid a dashboard setup wizard.

Input placeholder: “We estimate calories from food photos so people don't have to log every ingredient. Our audience is people who want simpler daily food tracking.” Optional audience and capability hints should remain lightweight. Do not add required questionnaires.

Show the actual enabled source. Until multiple integrations work, do not advertise simultaneous Reddit/X/Instagram search. After interpretation, show a compact editable summary of audience and need; allow correction without turning the page into a long onboarding flow.

| State | Visible behavior | Transition |
| --- | --- | --- |
| Input | Description and Run button; concise source/scope statement | Valid input creates or resumes one scan |
| Interpretation | “Understanding your business”; then audience/problem summary | Prepare three to five phrases |
| Search | Actual source name and indeterminate progress while provider is pending | Poll actual provider job through server |
| Review/rank | Real returned-item count, only if available; review/ranking stage | Normalize, filter and score once |
| Results | Up to ten useful linked cards, with Save and Not relevant | Open original or refine input |
| Empty | Honest explanation that no strong matches were found in this bounded search | Edit description/phrases and explicitly rerun |
| Partial | Actual available results plus a short explanation of incomplete retrieval | User decides whether to retry remaining work |
| Failure | Clear actionable message and retry where appropriate | Bounded recovery; preserve input |

The cool searching animation should visually connect interpretation, query preparation, source search, review, and ranking. Animate only transitions grounded in job state. Do not invent percentages, results, counts, elapsed-work claims, or networks searched. Use an indeterminate animation when completion is unknown; slow provider response is preferable to false progress. Respect reduced-motion preferences and announce stage changes accessibly.

### Result card contract

Each card includes:

- Original title/text or a permitted excerpt, visually separated from the app's explanation.
- Actual platform, community if available, and publication time; show “time unknown” when absent.
- A label such as solution request or alternative request, grounded in the original content.
- One sentence explaining the fit, including any material uncertainty.
- The original provider-supplied link; Open, Save, and Not relevant actions.

Prefer reasons over a decorative confidence percentage. If a score is exposed, label it a relevance heuristic. Do not display it as purchase probability. Show fewer than ten when fewer pass qualification.

“Open” launches the original conversation. It must not mark it replied, contacted, converted, or paid. A human checks original context and community rules and may transparently reply as the owner. No fabricated customer experience or automated outreach.

## 3. Retrieval and ranking pipeline

1. **Interpret input.** Structure business category, audience, problem, confirmed capabilities, and three to five phrases. Use only stated capabilities; missing details remain unknown. Keep the description editable.
2. **Compile queries.** Translate phrases into the selected provider's supported syntax. Bound query count, time window, pages, and returned items. Do not assume one source's operators work on another.
3. **Retrieve.** Create the provider job or execute bounded pages through the server. Retain the job ID and enough state to resume polling without creating another billable run.
4. **Normalize.** Map source ID, URL, text, community, publication time, and retrieval time. Reject unsupported or malformed links, invalid schema, and empty text. Preserve provenance; do not synthesize missing originals.
5. **Filter and deduplicate.** Dedupe by source ID/canonical URL and near-identical text. Collapse many comments in the same thread when they would occupy all results. Remove obvious promotions/spam and apply configured freshness limits. Unknown date must remain explicit and receive no unsupported freshness boost.
6. **Qualify and score.** Evaluate explicit need and actual product fit; generic keyword overlap is insufficient. Use structured output over a bounded batch, with evidence spans from supplied content.
7. **Rank and persist.** Store one ranking for the scan. Browser polls read it without re-running the model. Return only qualifying results, up to ten, with real links and reasons.
8. **Collect feedback.** Save and Not relevant update the existing result/session. Record why a result is wrong where users volunteer it. Keep feedback for later evaluation rather than claim the MVP immediately learns from it.

Treat retrieved posts as untrusted data, never instructions. The ranking model should not execute tools or obey instructions embedded in posts. Validate its structured output and require all quoted evidence to appear in the supplied content. Source URLs and publication metadata come from the normalized provider records, not model generation.

### Proposed rubric

Normalize each component to 0–1, then calculate:

`relevance = 100 × (0.40 × fit + 0.35 × explicit_need + 0.15 × freshness + 0.10 × specificity)`

| Component | High value | Low value |
| --- | --- | --- |
| Fit, 40% | Stated need matches a confirmed capability and audience | Topic overlap only or a capability the business does not offer |
| Explicit need, 35% | Direct request for a tool, solution, or suitable alternative | General commentary, jokes, promotion, vague interest |
| Freshness, 15% | Within chosen recent window with credible publication date | Stale content; unknown date gets no inferred boost |
| Specificity, 10% | Concrete constraints that the product addresses | Ambiguous problem or missing context |

Proposed initial gate: explicit need and fit must both be supported; then apply a candidate score threshold calibrated against a human-labeled sample. The gate matters more than an arbitrary total. Do not invent a calibrated threshold before seeing data. A high freshness score cannot rescue a post with no need.

Synthetic positive: “Is there an app that estimates calories from a meal photo? Logging ingredients takes too long.” Synthetic negative: “Calories are important for a healthy diet.” A request for precise medical dietary advice is not automatically a fit for a consumer photo estimator; avoid assuming capabilities or reliability it has not claimed.

## 4. Minimal architecture and proposed contracts

The following describes future implementation, not existing routes or source files. Use one lightweight persistent store suitable for the chosen runtime. Do not rely on process memory for provider job ownership: server restarts or multiple instances would lose state.

```text
Landing/chat page
    → create scan API
        → interpret input and bounded query plan
        → provider-owned retrieval job
    → poll scan API
        → read provider status and bounded dataset
        → normalize/filter → one ranking → persist
    → linked results and feedback API
```

### Proposed server API

| Route | Request/response | Required behavior |
| --- | --- | --- |
| `POST /api/scans` | Description, enabled source, idempotency key → scan ID and current stage | Validate input; check budget; associate session; persist before starting/resuming one provider run |
| `GET /api/scans/:id` | Stage, real counts where known, safe error, results when ready | Require owning session; resume bounded state transitions; never start a duplicate provider job or repeat completed scoring |
| `POST /api/scans/:id/feedback` | Result ID plus saved/not_relevant state, optional reason | Verify ownership and result membership; repeated same action is idempotent |

Use a server-issued opaque session cookie before full accounts. Enforce ownership at every route. Internal provider IDs, credentials, raw errors, and other users' scans are not exposed in browser responses.

Proposed stages: `created`, `interpreting`, `preparing`, `searching`, `reviewing`, `ranking`, `complete`, `empty`, `partial`, `failed`. Terminal states persist. Use atomic claims for provider creation and ranking so simultaneous polls cannot repeat work. Do not retry ambiguous provider creation blindly: reconcile using a persisted ID or provider-supported identifier first; otherwise report failure rather than risk a second charge.

### Minimal stored records

| Record | Proposed fields |
| --- | --- |
| Scan | ID, session owner, description, structured business, source, queries, stage, created/updated time, idempotency key, provider run/dataset IDs, result/page limits, deadline, reserved/actual cost, safe error |
| Opportunity | Scan ID, source record ID, canonical original URL, text/excerpt, platform/community, nullable publication time, retrieval time, need type, evidence, fit reason, rubric components, rank |
| Feedback | Session, scan/result IDs, saved/not_relevant state, optional reason, timestamp |

Select content retention and excerpt storage according to permitted use. Do not add author profiles, inferred contact details, or raw provider exports by default. Handle deleted/unavailable originals and retention expiry; a stored excerpt must not be treated as permanently authorized simply because it was once public.

### Provider adapter

Keep a small adapter with `start`, `poll`, `readItems` and normalized output. Exact names are illustrative. With Apify, follow documented [run creation](https://docs.apify.com/api/v2/actors-runs-post), [status](https://docs.apify.com/api/v2/actor-run-get), and [dataset items](https://docs.apify.com/api/v2/dataset-items-get) endpoints. Check status enum and input schema before implementation; do not guess the actor configuration from this plan.

For a paginated search provider, persist cursor, retrieved count, and deadline. A future second adapter should reuse normalized records and qualification logic, but do not implement multiple sources in the first four-hour build.

### Proposed operational defaults to validate

- One source and at most five queries per scan.
- Start with at most 100–200 total returned records, adjusted for provider billing semantics and minimums.
- Return at most ten qualifying results; the eventual free scan may expose at most five.
- Limit description length, requests per session, active scans, model tokens, and total provider spend before making requests.
- Poll at a modest interval with backoff; use a scan-level deadline and a small bounded retry allowance.
- Retry only transient reads or clearly safe operations within remaining budget. Do not blindly retry authentication/payment/permission failures.
- Provider/model keys remain server-only, with secret-bearing logs redacted. Validate source URLs and escape original text when rendering.

The exact dollar cap, retention window, timeout and poll interval are unresolved until the provider sample and runtime constraints are known. Choose them explicitly before future live runs. If result quality requires thousands of records, revisit the schedule and cost rather than silently exceed limits.

## 5. Four-hour future build schedule

| Minutes | Deliverable | Exit condition |
| --- | --- | --- |
| 0–25 | Authorized source sample, schema mapping and feasibility check | Real links/text/dates available, cost bounded, permitted intended use addressed; otherwise labeled demo mode |
| 25–70 | Single landing/chat and all basic UI states | Input to empty/error/results flow visible; source and sample/live mode truthful |
| 70–130 | Create/poll scan routes, provider adapter, persistence and normalization | One bounded run resumes across polls without duplication |
| 130–180 | Qualification, scoring, reasons, dedupe and limits | Strong requests rank above generic overlap; no invented metadata |
| 180–215 | Truthful animation, Save and Not relevant | Real stages/counts; persistent session feedback |
| 215–240 | Success/failure/repeated-click checks and three-business demos | Evidence and remaining limits recorded |

Assumptions: ready developer environment, provider access and any permitted budget, available model access, and one deployable/runtime-compatible persistent store. The sample gate may consume the window if access is blocked. In that case, use clearly labeled fixtures for an interface demo and stop claiming live discovery. No actual sample dataset has been created as part of this planning work.

If time is short, cut reply drafts first, then optional polish. Preserve real source links, truthful state, relevant results, no duplicate charges, and bounded spend. Authentication for full accounts, Stripe subscriptions, scheduler/digest delivery, teams, and broader data coverage are separate milestones.

## 6. Acceptance and verification plan

Future checks should verify observable behavior and material risks, not duplicate internal implementation. No application tests can run now because no app exists.

| Scenario | Required observable result |
| --- | --- |
| Valid description and available source | Real bounded retrieval returns correctly linked results with grounded explanations |
| Generic topic match | Does not pass solely because it mentions a keyword |
| No qualifying posts | Honest empty state; no fabricated cards or automatic widening/spend |
| Missing/invalid publication time | Time unknown; no invented recency |
| Duplicate post/comment/thread | Repeated content does not dominate results |
| Slow job | Indeterminate source-specific animation, input preserved, deadline enforced |
| Provider auth/payment/permission error | Clear failure; no unbounded retries or secrets in UI/logs |
| Partial source failure | Only actual retrieved/qualified results shown, with incomplete status |
| Repeated clicks, concurrent polls, page reload | Same scan resumes; no duplicate run or model scoring |
| Different session requests scan/result | Access denied without leaking content |
| Prompt injection in source text | Treated as text; ranking stays within original task and produces validated evidence |
| Save / Not relevant / Open | Feedback persists; Open is tracked only as an open |
| Sample mode | Prominent sample label; never represented as live or fresh discovery |
| Budget/item/page cap | Stops within configured limits and reports actual status |
| Keyboard and reduced motion | Usable form/actions, sensible focus and readable stage changes |

Demonstrate the food-photo example and two chosen commercial categories. Evaluate relevance against a small human-labeled sample, recording actual denominators and false positives. Proposed commercial gates—useful top results, fresh supply across days, owner participation interest, paid pilot acceptance, and measured costs—are detailed in [research](research.md#7-economics-and-measurement).

## 7. Later milestones, only after validation

1. **Search beta:** one real permitted source and repeated useful results; collect feedback and measure costs.
2. **Assisted paid pilot:** validate price and the owner's participation workflow. Any outreach and charging require separate authorization.
3. **Monitoring product:** saved strategy, recurring fresh checks, dedupe across days, digest delivery, accounts, clear usage allowances, cancellation, retention and deletion handling.
4. **Additional sources:** prove each adapter's coverage and economics separately. For Instagram, first test comments on supplied URLs; global reel discovery remains a different problem.
5. **Growth:** permissioned factual case studies, niche content, referrals and partners after real usage; broad launch/ads after evidence supports acquisition spending.

Current repository deliverable is the specification and research. No source integration, app code, subscription, outreach, or deployment is implied by completion of these documents.
