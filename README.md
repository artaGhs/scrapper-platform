# Scrapper platform

Research and planning for a simple web app that finds public conversations where someone explicitly asks for a solution a business offers.

**Status: planning only, October 11, 2026.** This repository contains research and an executable MVP specification. No application, authenticated data integration, paid data run, customer interview, prospect outreach, billing system, or deployment has been completed.

## Product idea

Describe your business in a few sentences, press **Run**, see truthful search progress, and receive a short ranked list of linked opportunities. Each result explains what the person needs and why the business fits. The owner opens the original conversation and decides whether to participate transparently.

For example, a food-photo calorie app should find people asking for a way to estimate calories without manually entering every ingredient. A generic post about calories is insufficient evidence of a useful opportunity. This is a discovery aid; result rankings are not purchase probabilities or promises of revenue.

## Read the plan

- [Research](docs/research.md): competitors, public vendor capabilities and prices, data limitations, customer discovery, marketing, proposed pricing, and economics.
- [MVP plan](docs/mvp-plan.md): one-page landing/chat experience, retrieval and ranking pipeline, API and data contracts, truthful animation, a four-hour build schedule, and acceptance criteria.

## Working decisions

| Decision | Rationale |
| --- | --- |
| One input, one source, up to ten strong results | Makes the initial value easy to evaluate and keeps the hackathon scope small. |
| Test Reddit retrieval first | Discussion context suits explicit solution requests; Apify Reddit Lite is a technical candidate, subject to access, rights, and sample-quality checks. |
| Treat X as an alternative after feasibility checks | Public API options exist, but funding, query restrictions, permission, and relevance still need validation. |
| Defer Instagram-wide discovery | Extracting comments from supplied reel URLs does not establish global search for relevant reels. |
| Start with small B2B SaaS or Shopify app founders | Hypothesis: concrete needs, reachable owners, and higher customer value make early validation easier. |
| Keep posting manual | Owners review context and community rules and disclose their affiliation. Never fabricate customer experiences. |
| Consider $49/month after recurring monitoring works | Subscription value depends on fresh useful matches over time; the on-demand prototype should be described as a search beta or audit. |

These are hypotheses and proposed decisions, not validated demand or confirmed provider agreements. Competitors already offer AI filtering and reply assistance, so the test is useful results and simple onboarding, not generic chat novelty.

## Evidence and next gate

Public vendor pages and documentation were reviewed on October 11, 2026. Prices can change and advertised coverage has not been independently tested. Relevant sources are linked next to findings in the research document. Commercial collection, processing, customer display, retention, and deletion rights remain unresolved; third-party API availability alone does not establish permission.

The next implementation gate is a small source-feasibility sample, within explicitly authorized access and budget, followed by three business demonstrations and customer feedback. If live access is unavailable, use a clearly labeled sample dataset for an interface demonstration. This repository does not include that sample or claim live discovery.

Current authorization covers research, planning, GitHub setup, commits, and pushes. App implementation, provider purchases or paid calls, outreach, and deployment require a subsequent instruction.
