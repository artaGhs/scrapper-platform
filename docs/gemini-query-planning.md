# Gemini business-to-Reddit query planning

October 11, 2026. This replaces the earlier release's category query templates in production.

## Behavior

A live Reddit scan sends its business description to Gemini in the interpreting stage. The request does not include the app's preset queries or community lists. Gemini infers a category, relevant product/problem vocabulary, explicitly described features and three diverse search plans. This applies to new business categories as well as the initial food, Shopify and uptime examples.

Gemini chooses two or three keyword concept groups per query and one to four synonyms per group. The server adds OR between synonyms, AND between concepts, and short-phrase quoting. This is syntax compilation, not category-specific query content. The first two queries are Reddit-wide. The third may use a distinct angle or add model-selected communities. All queries share the existing single bounded post/comment actor job.

The planner uses one server-authenticated Gemini request, with a 20-second timeout and a 1,400-output-token cap. Its structured output is validated for query count, scope, bounded groups, supported keyword characters, distinct queries and exact feature text from the supplied description. Syntax validation cannot guarantee semantic relevance or the existence of a proposed community. Preferred community queries supplement the global searches.

Missing credentials, a model failure or an invalid plan stops the scan before Reddit source startup. The scan does not use a predefined query fallback. An unused public free allowance and its source reservation are released. The model request itself may consume model tokens. The private developer repeat-run behavior and source charge caps remain in place.

After retrieval, keyword/context checks still identify candidates, and Gemini reviews at most five of those candidates using exact source evidence. Existing known-category fit checks remain; generic categories use the model's vocabulary. This change replaces search query selection; it does not establish exhaustive discovery or willingness to buy.

## Research informing the implementation

- [Redreach onboarding](https://help.redreach.ai/getting-started/44NmqDS5g8BARncLuKPdo1/getting-started-with-redreach-complete-setup-guide/44NmqDS5g848CqTFqn9CHM) describes using a company description and optional competitors to find relevant Reddit conversations. Its [API page](https://redreach.ai/reddit-api) documents keyword opportunities, fresh conversations scored for business relevance, and explanations. This supports separating business interpretation from relevance assessment; it does not reveal their private prompts or establish that they use Apify.
- [Apify's AI-agent Reddit case study](https://blog.apify.com/reddit-actor-ai-agent-input-schema/) shows that successful scraping can return irrelevant records. It discusses query phrasing, quoted phrases, shared batch limits and actor-specific time/sort behavior. It uses a different actor from this app, so its parameter interactions and cost figures must not be transferred to ours. Our application continues using the already-verified Reddit Lite adapter and its limits.
- [Apify's Reddit monitoring walkthrough](https://blog.apify.com/how-to-build-brand-monitoring-tool/) documents scraping, duplicate filtering and structured LLM analysis of actual records. Its sentiment-monitoring use case differs from business-fit discovery, but supports keeping model judgments tied to retrieved material.
- [Google structured-output documentation](https://ai.google.dev/gemini-api/docs/structured-output) describes schema-shaped responses and supported schema limitations. Local validation remains necessary; a schema-conforming response can still have unsuitable meaning.

The design inference is: interpret the business with an LLM, produce source-compatible searches, retrieve actual records, then evaluate business fit independently. This research does not prove any competitor's conversions or guarantee that a ten-record batch will contain a match. No new scraper, subscription, outreach workflow or automatic paid retry was introduced.

## Verification

- 56 offline tests passed, including a production-default planning call without an injected draft helper, persisted model queries, concurrent advancement making only one planning call, novel dental-business terms, unsupported/invalid plans, and planner failure preserving the free allowance before any source startup.
- The production adapter test observes one simulated Gemini planning request, one source job, one relevance-review request, and the existing ten-record source limit. Authentication and historical dual-source budget checks use simulated model responses; no offline check makes a paid provider call.
- Lint, production build and nine local browser checks passed in an isolated managed checkout.
- Real Gemini requests produced accepted structured concept plans for uptime monitoring, dental appointment reminders and food-photo calorie estimation. An earlier uptime concept plan was rejected by validation; a separate bounded model-only check returned a valid plan. Exploratory raw-string plans revealed loose natural-language syntax and were replaced by the concept-group format. Private responses and usage metadata are retained in ignored `.data` files.
- These model-only checks did not start Apify jobs. The prior broader-search validation found one relevant uptime request, but used deterministic queries and therefore is not evidence of retrieval quality for the new Gemini plans.
