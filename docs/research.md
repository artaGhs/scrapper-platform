# Research and commercial plan

> Implementation update (October 11, 2026): the MVP is now built with Vercel/Neon storage and a gated source connector. See [README](../README.md) and [observed validation](validation.md). The original hypotheses and unresolved rights below remain research, not validated outcomes.

Research date: **October 11, 2026**. Scope: public vendor pages and documentation, plus product and validation hypotheses. No authenticated integration tests, purchased data, interviews, verified customer revenue, or independently measured coverage. Currency is USD unless indicated otherwise. Listed prices describe public pages, not negotiated rates or all-in costs.

## 1. Problem and value proposition

Founders can miss conversations where people are already seeking the capability their product provides. Manual community search is repetitive and keyword matches often lack intent or product fit. The proposed product converts a short business description into a bounded search and a small set of explainable, linked opportunities.

The first question is whether a user would actually join the returned conversations. The second is whether new useful conversations recur often enough to support continued use. A polished interface alone cannot answer either question.

Example business: an app estimates calories from food photos, reducing manual ingredient entry. Strong evidence would be an explicit request for photo-based logging or frustration with logging ingredients. Generic fitness discussion, calorie facts, promotions for another app, and old inactive discussions are weaker matches. Examples throughout this plan are synthetic illustrations, not discovered prospects.

## 2. Competitor landscape

The table records advertised behavior. It does not verify customer outcomes, recall, precision, service uptime, or internal suppliers.

| Product and primary source | Public offer | Advertised capabilities and implication |
| --- | --- | --- |
| [F5Bot tiers](https://f5bot.com/tiers) | Free marked personal-use only; Silver $9.99/month; Gold $49.99/month | Reddit, Hacker News, and Lobsters keyword alerts; paid filtering and integrations. Gold advertises AI filtering. Low-cost keyword monitoring is already available. |
| [Syften](https://syften.com/) | Entry $29.95/month, Standard $49.95/month, Pro $119.95/month; X add-on $40/month on eligible plans; 14-day no-card trial | Community and web monitoring, archive matches, AI filtering, API and alerts. Pro offers webhooks/MCP; custom integration arrangements are advertised. Guided setup alone is not a durable advantage. |
| [KWatch](https://kwatch.io/) | Free; Essential $19/month; Business $79/month | Keyword and selected-conversation tracking, paid AI analysis and integrations. FAQ says Instagram is not monitored. Source claims must be compared individually. |
| [ReplyGuy](https://replyguy.com/) | Analyst monitoring $39/month; Pro $49/month | Finds discussions, supplies reply assistance, and advertises automated replies on Pro. This plan keeps posting manual. |
| [Redreach](https://redreach.ai/) | Exact price not reliably retrievable from reviewed page; do not infer one | Direct Reddit discovery competitor: relevance, brand monitoring, AI-guided replies, and Google-ranking thread opportunities. Its public marketing is not evidence that our product will convert. |
| [Buska pricing](https://www.buska.io/pricing) | Starter $49/month, Growth $99/month, Scale $249/month; 7-day no-card trial | Multi-source buying signals, customer-fit profiles, reply tools, and paid integrations. The proposed $49 plan competes with an existing offer at the same headline price. |
| [Octolens pricing](https://octolens.com/pricing) | Pro $159/month and Scale $499/month, **both billed annually**; 7-day trial | AI-filtered social listening, API and webhooks. These annual-billing equivalents should not be presented as cancel-anytime monthly prices. |
| [GummySearch closure announcement](https://gummysearch.com/docs/gummysearch-is-now-closed-6533h) | New accounts/purchases/renewals stopped after November 30, 2025; existing service winds down; final closure December 1, 2026 | Vendor attributes closure to inability to reach a suitable commercial Reddit Data API agreement. A practical warning about source dependency, not evidence of a free market gap. |

**Inference:** this is a crowded category. AI filtering, generated replies, monitoring, and natural-language setup are already offered. Test a narrowly defined customer, a fast first useful result, clear reasons for relevance, and useful fresh matches. Do not position generic chat as the invention.

Competitors publicly describe a pattern of keyword/strategy setup, collection, filtering, alerts, and reply help. Their complete stacks and private data agreements are unknown. Public product features do not identify which scraper, database, model, or private supplier each uses.

## 3. Source and provider options

These are candidates for future testing. None was invoked or funded during research. Advertised pricing excludes plan minimums, runtime charges where applicable, model use, storage, payments, support, and retries.

| Option and primary source | Public retrieval price | Fit and blockers |
| --- | --- | --- |
| [Apify Reddit Lite](https://apify.com/trudax/reddit-scraper-lite) | From $3.40/1,000 stored results | Community-maintained actor; keywords or URLs, posts/comments, links and timestamps. First technical candidate to sample; neither coverage nor commercial permission is confirmed. Check the actual actor input schema and result types. |
| [SocialData pricing](https://docs.socialdata.tools/getting-started/pricing/) and [search API](https://docs.socialdata.tools/reference/get-search-results/) | $0.0002/post, or $0.20/1,000 | Authenticated X search, Latest/Top, cursor pagination, roughly 20 results/page. Positive funded balance required. Intended customer display and processing rights remain unverified. |
| [Apify Tweet Scraper V2](https://apify.com/apidojo/tweet-scraper) | From $0.40/1,000 tweets | At least 50 results per query; restricted free runs; no single-post/thread extraction. Documentation also prohibits repeated short-interval monitoring. Narrow low-volume searches and recurring subscription use may need a different actor/provider. |
| [Apify Instagram Comments Scraper](https://apify.com/apify/instagram-comment-scraper) | From $1.90/1,000 comments | Requires post/reel URLs; captures comments visible to logged-out visitors, with variable results. Analyze supplied URLs later. This does not solve discovery of relevant reels across Instagram. |
| [Bright Data social scraping catalog](https://brightdata.com/products/web-scraper/social-media-scrape) | Exact current price unresolved | Catalog includes Reddit keyword discovery and social scrapers, with a free-record offer. Earlier research notes listed $1.50/1,000, but the reopened page did not expose that price in readable text. Confirm scraper-specific schema, rate, minimums, and eligibility before using the number. |
| [Official X search](https://docs.x.com/x-api/posts/search/introduction) and [pricing](https://docs.x.com/x-api/getting-started/pricing) | Post reads listed at $0.005/resource, or $5/1,000 | Recent search covers seven days. Developer access, authentication, billing and applicable terms needed; current console rates are authoritative. Official access does not remove use-case restrictions. |
| [Official Reddit Data API terms](https://redditinc.com/policies/data-api-terms) | Separate agreement required for commercial API use; no quoted rate here | Discuss the intended commercial use and approval conditions before selecting this route. No commercial agreement or access has been established. |

### Retrieval is distinct from commercial permission

The Reddit Data API terms require a separate agreement for commercial API use. Do not infer that the same agreement language automatically settles every third-party scraping scenario; assess the intended route and applicable provider/platform terms. Successful third-party retrieval also does not establish permission for our use. The open questions are collection, model processing, customer display, resale/redistribution, retention, and deletions. This document records unresolved dependencies and makes no legal-clearance claim. [Reddit Data API terms](https://redditinc.com/policies/data-api-terms).

An incumbent subscription is not automatically a resellable backend. Buska prohibits resale, sublicensing, or redistribution of service access without written authorization. Syften publicly advertises custom integration arrangements; those arrangements have not been obtained. [Buska terms](https://www.buska.io/terms), [Syften](https://syften.com/).

Before launch, record evidence of the chosen permitted use, content/excerpt rules, model-processing conditions, required attribution, deletion handling, and retention limits. Minimize stored author information; the product needs a conversation and original link, not a dossier on its author.

### Technical starting point

Use a hosted provider rather than build a custom crawler for the hackathon. Apify documents an asynchronous flow:

1. [Start an actor run](https://docs.apify.com/api/v2/actors-runs-post): `POST /v2/actors/:actorId/runs`; retain the returned run ID and dataset ID.
2. [Read run status](https://docs.apify.com/api/v2/actor-run-get): `GET /v2/actor-runs/:runId` until a terminal state or bounded timeout.
3. [Read dataset items](https://docs.apify.com/api/v2/dataset-items-get): `GET /v2/datasets/:datasetId/items`, within item and paging limits.

Our server mediates requests and holds credentials. The browser polls our scan status. This avoids a long browser request and maps to truthful animated progress. Exact schema and timing still require a small authorized sample.

For SocialData, the documented search route is `GET https://api.socialdata.tools/twitter/search?query={query}` with bearer authentication, `type=Latest` or `Top`, and an optional cursor. Stop when the cursor ends, the budget is reached, or the deadline expires. Query syntax and result quality need testing. [SocialData search documentation](https://docs.socialdata.tools/reference/get-search-results/).

### Future feasibility experiment

After implementation and any required spending are authorized, select one provider and sample three business descriptions: the food-photo app, a narrow B2B SaaS, and a Shopify app. Choose three to five phrases per business and fixed retrieval limits. Record canonical link validity, actual publication dates, source/community, duplicates, promotional content, latency, billed units, failures, and a human usefulness label. Do not treat provider timestamps as publication dates without checking field meaning.

Proceed only if the result schema supplies usable links/text and enough plausible requests to evaluate. If access is unavailable or the route cannot support the intended use, demonstrate the interface with a labeled sample and report the live dependency. Avoid an expensive provider migration during the four-hour window.

## 4. First customer hypothesis

| Segment | Reason to test | Main risk |
| --- | --- | --- |
| Small B2B SaaS founders with paying customers | Concrete product category, meaningful customer value, founder often participates in communities | Low conversation volume or existing satisfactory acquisition process |
| Shopify app founders | Narrow problems and reachable public owners; recurring merchant needs | Fit depends on merchant/community context and promotional rules |
| Developer-tool founders | Public technical questions and specific feature requirements | Technical accuracy and credibility of replies matter |
| Consumer app founders | Food-photo app is a clear demonstration | Lower customer value may make manual participation less economical |
| Agencies | Potential demand across clients | Multiple businesses, permissions and reporting exceed MVP scope |
| Local businesses | Some clear location-specific demand | Geography and low volume complicate retrieval; defer |

Start with one narrow SaaS or Shopify app niche. These are selection hypotheses, not a validated market or prospect list.

Vendor anecdotes suggest why this workflow might help but do not establish a conversion rate. Syften describes Personal Discount's founder providing useful community answers and occasionally recommending the product. A separate **2020** article reports three paying customers from one comment; it is a stale, vendor-published anecdote, not a current benchmark. [Personal Discount case study](https://syften.com/blog/shopify-app-social-listening-case-study/), [2020 competitor-monitoring case study](https://syften.com/blog/competitor-monitoring-case-study/).

### Prospect discovery plan, not completed outreach

Find 30 candidate companies and shortlist ten using public company information on [Product Hunt](https://www.producthunt.com/), [Shopify's marketing and conversion app directory](https://apps.shopify.com/categories/marketing-and-conversion), public founder acquisition discussions, permitted founder communities, and hackathon contacts. These are starting directories, not verified buyers.

For each candidate, record website, category, a publicly identified owner/marketer, paid offering, recent relevant conversations, and evidence of the current acquisition problem. Prioritize actual discussion fit over follower count. No shortlist or outreach has been completed.

Before a personalized demonstration, prepare three to five verified opportunities for that product and check links, dates, product capabilities, and conversation context. Ask:

- When did community participation last bring you a customer? What happened?
- How do you find these conversations now, and how much effort does it take?
- Which of these results would you join, and which are irrelevant? Why?
- What would make the next week's results valuable enough to return?
- After seeing evidence, would you accept a specific paid pilot with clear limits?

Record behavior and objections, not compliments. A future outreach draft, only after verifying the stated evidence and receiving outreach authorization:

> I'm building a tool to find public discussions where people ask for what your product does. I found three recent threads that appear relevant to [product]. Would you like to review them and tell me which are useful?

Do not send this unless three suitable threads actually exist. Identify the builder honestly, avoid fabricated proof, and participate only where welcome.

## 5. Marketing sequence

| Stage | Proposed work | Evidence sought |
| --- | --- | --- |
| Hackathon | Three to five interviews and a real screen demonstration, or explicitly labeled sample demo | Understands value; identifies useful and irrelevant results |
| First week after authorization | One niche, ten personalized demonstrations | Repeat pain, useful opportunities, willingness to accept a paid pilot |
| Assisted pilot | Help users evaluate fresh results over several days | Return behavior, real participation, costs and early retention |
| After real paid usage | Publish a permissioned factual case study | Separate source opens, actual replies, signups, and paid customers |
| After repeated value | Niche educational content, referrals and partners | Repeatable acquisition and retention |
| Later | Broad launch and ads | Measured economics justify spending |

The initial sales asset is a relevant set of real conversations. Claims such as guaranteed customers, broad platform coverage, or a proven conversion rate are unsupported. Customer stories need permission and factual attribution; one successful comment is not a recurring-revenue forecast.

## 6. Proposed offer and trial

Hypothesis: one **$49/month** plan once ongoing monitoring exists. Include one business, a saved search strategy, recurring fresh checks/digest, saved matches, relevance feedback, optional editable drafts, clear usage limits, and easy cancellation. Billing and monitoring are later work, not features of the four-hour search prototype.

Proposed funnel: a first bounded scan shows up to five strong matches; sign up to save results or enable monitoring. Later, a seven-day no-card monitoring trial can demonstrate repeat value with strict provider and model limits. There must be no unexpected automatic charge. A low-volume niche may need a longer assisted pilot to evaluate fresh supply.

For the initial on-demand prototype, use “search beta” or a one-time opportunity audit. Do not describe it as a working ongoing subscription service. Exact scan allowances and digest frequency require measured cost and conversation volume; unlimited scans are not proposed.

## 7. Economics and measurement

Raw retrieval price is only one cost component. Model calls, runtime/platform minimums, repeated retrieval, failures, storage, payments, and support can materially change the result. The following is illustrative arithmetic using listed unit rates, not a quote or measured bill.

| Source | Retrieval units | Illustrative retrieval cost |
| --- | --- | --- |
| Reddit Lite | 1,000 stored results | From $3.40 |
| SocialData X search | 1,000 returned posts | $0.20 |
| Tweet Scraper V2 | 1,000 tweets | From $0.40, subject to query restrictions |
| Instagram Comments Scraper | 1,000 comments | From $1.90; reel discovery excluded |
| Official X post reads | 1,000 resources | $5.00 at documented headline rate |
| Bright Data | 1,000 records | Unconfirmed; obtain actual scraper pricing |

These units are not equivalent useful opportunities. At a hypothetical 1% useful yield, 1,000 raw items produce ten useful matches; at 10%, they produce 100. Neither yield has been measured. For $3.40 retrieval alone, that would be $0.34 versus $0.034 per useful match before other costs.

Track:

`cost per useful opportunity = total scan variable cost / human-accepted useful results`

If there are zero useful results, report the spent amount and zero yield; do not manufacture a finite ratio. Track provider units, repeated items, model input/output tokens, compute and failures per scan. Reserve a budget before starting a run, stop at the cap, and rate-limit repeat runs.

Illustrative contribution: $49 revenue minus $10 variable cost leaves $39, about 80%, **before fixed costs and acquisition**. This is not a forecast or measured margin. Price/limits should change if repeat use, support load, or retrieval costs invalidate it.

### Proposed validation targets

The targets below are decision hypotheses, not industry benchmarks:

- Most of the first ten ranked results are judged useful by the business owner.
- At least three conversations are ones the owner would actually join.
- New useful results appear across several days; repeated historical matches alone are insufficient.
- Users return or use the digest once it exists.
- Three of ten personalized demonstrations accept a concrete proposed paid pilot.
- Measured variable costs fit an explicit per-user budget.

For scans with fewer than ten results, report the actual denominator. Record raw retrieved, unique, qualified, shown, opened, saved, marked irrelevant, returned, and payment events separately. Opening a source is neither a reply nor a sale. Track actual replies and attributable signups/customers only through user confirmation or a valid later measurement method.

## 8. Decisions and unresolved questions

| Question | Current position | Evidence needed |
| --- | --- | --- |
| Does a narrow business description yield useful conversations? | Plausible, untested | Authorized sample and owner labels |
| Which source works first? | Reddit Lite technical candidate; X alternative | Actual schema, availability, latency, cost and permitted use |
| Can the source support commercial customer display and model processing? | Unresolved | Provider/platform conditions and applicable agreement |
| Is Instagram-wide discovery feasible? | Not established by comments extraction | Separate discovery source and coverage test |
| Can repeated fresh results sustain a subscription? | Unvalidated | Several-day pilot and return/payment behavior |
| Is $49 the right price? | Hypothesis informed by competitor offers | Demonstrations, paid pilots and actual costs |
| Can the prototype be built in four hours? | Estimate for experienced builder with ready setup | Feasible source, bounded scope and actual build timing |

Next work is source feasibility and customer validation after authorization. Implementation details are specified in [the MVP plan](mvp-plan.md); no app implementation is included in this repository.
