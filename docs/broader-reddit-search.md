# Broader Reddit discovery — October 11, 2026

The previous uptime queries repeated the exact phrase “uptime monitor” inside r/selfhosted. A successful ten-record retrieval could therefore contain promotions and hobbyist discussions without a suitable business need. Zero qualified records in that batch did not establish that Reddit had no relevant conversations.

Known categories now use two Reddit-wide keyword/problem queries and one additional query across preferred communities. Generic businesses use three Reddit-wide keyword queries. The uptime plan covers website outages, noticing downtime and alerts, as well as uptime tools; its focused query covers r/selfhosted, r/webdev and r/sysadmin. Preferred communities are not a restriction on the global queries.

One existing Apify actor job searches both posts and comments, sorted by relevance. It skips crawling all child comments. Comment records preserve their own body, date and direct permalink; parent post titles do not supply evidence for a comment. Post and comment records are checked individually, then ranking retains one qualified opportunity per Reddit thread. First-party outage problems can qualify without literally saying “uptime monitor”; promotions, unrelated contexts and explicit refusals of monitoring remain excluded.

The provider still requests ten total raw records in a free run, retains at most three qualified results and uses the existing public $0.12 source cap. Developer authentication still permits repeated bounded runs. This is a small sample; searching broadly does not make it exhaustive or guarantee a match. Gemini reviews at most five candidates in one request, using up to 2,600 characters of source context and exact source evidence.

## Validation

- 54 offline tests passed, including global/focused query scope, ordinary outage wording, distinct comment identities and URLs, qualification before thread deduplication, incompatible requests, and one-job free allowance behavior.
- Lint and the production build passed in an isolated managed checkout containing the owned changes. Nine local browser checks passed, including a simulated live comment result with its direct original link and Reddit-wide scope.
- One explicitly authorized live validation used the actual provider and Gemini through the application pipeline, with isolated local scan storage and a $0.08 source cap. Source retrieval completed for $0.08: ten records, including four comments, across r/selfhosted, r/australia, r/webhosting, r/buildinpublic, r/ShowMeYourSaaS and r/sysadmin. Four records reached keyword review and one passed Gemini assessment. No additional actor job was started.
- The retained [r/webhosting request](https://www.reddit.com/r/webhosting/comments/1vx79zc/your_favorite_free_uptime_monitoring/) asks for a free uptime monitor for client websites. Its original page was checked against the returned body. It is a relevant request, not evidence of willingness to buy. None of the four returned comments qualified in this validation.
- Vercel reported the production alias ready at release `d678ec844345f118edf693f43b2c045d7aa120a0`. Five targeted browser checks passed against the deployed site: Reddit-wide comment scope/direct links, partial-source provenance, saved free results, truthful empty batches, and repeated developer searches. These browser checks used simulated scan responses and did not start paid source jobs.

Private raw records, scan state, run marker and charge summary are retained in ignored `.data` files. The live validation was an application-pipeline check, not a submitted hosted browser search. Browser fixtures do not trigger paid provider calls.

Provider behavior was checked against the [Apify actor input schema](https://apify.com/trudax/reddit-scraper-lite/input-schema) and [actor documentation](https://apify.com/trudax/reddit-scraper-lite). Reddit-wide post/comment search is described in [Reddit's search features](https://support.reddithelp.com/hc/en-us/articles/19696541895316-Available-search-features).
