#### Ripple Research Sources And Workspace Report

- NOTE: Consolidated on **18 September 2026** from the social API, public-record, OSINT, app-store, and workspace research. Published prices and access rules can change before launch.
- **Recommendation:** Make Ripple a **source-linked research and analysis product**. Build a private evidence workspace on the public records Ripple already reads; expand official records; use news and social posts to discover leads; publish only reviewed, clearly attributed Ripple analysis.
- **Reason:** Public records give Ripple verifiable differentiation at low source cost. Broad social ingestion is much harder to license, moderate, keep current, and display in a consumer app.

#### Ripple's Starting Point

- Ripple currently shows **House periodic transaction report filings**, **SEC Form 4 insider filings**, **Federal Register policy documents**, and stock-price context in one timeline. The first three are public-record sources; the current stock feed uses Yahoo public endpoints. [Project source overview](../README.md)
- The keyless House route identifies a filing but does **not** read ticker, amount, or direction from many filed PDFs. It links to the document instead of inventing details. The Senate is not covered by that keyless path. [Project source overview](../README.md)
- NOTE: Stock-price context is useful, but an unofficial public endpoint should not be treated as a guaranteed commercial market-data licence or service-level commitment. Validate a production market-data source separately.

#### Terms And Decision Rule

- DEF: **API access** means a technical way to request data. It does not by itself grant storage, analysis, public display, or redistribution rights.
- DEF: **Primary record** means the original filing, government record, issuer release, or other authoritative document that directly supports a fact.
- DEF: **Lead** means a post, headline, automated match, or claim that warrants checking. A lead is not a verified finding.
- DEF: **Provenance** means the source ID and URL, publisher, source and retrieval times, method of verification, and later corrections or removals.
- **Publication rule:** A consequential claim moves from lead to public Ripple card only after a reviewer can point to supporting primary evidence, state what remains uncertain, and distinguish correlation from causation.

#### Recommended Investment Order

| Rank | Investment | Indicative incremental price | Reason and release gate |
|---|---|---|---|
| **1** | Private, source-linked research workspace using current records | **US$0 new source licences** for a local prototype; development time remains | Makes findings reproducible before adding feeds. Save cases, evidence, dates, uncertainty, and corrections. |
| **2** | More official records: SEC issuer filings and government contracts | No published per-call source fee for the cited official routes | Adds evidence for company and policy events. Check agency limits and entity matching. [SEC](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) · [USAspending](https://api.usaspending.gov/docs/endpoints) |
| **3** | News and open social discovery: GDELT, Bluesky, Mastodon | GDELT is **free/open**; cited social API documents publish no read fee | Broadens discovery at low source cost. Keep leads separate from verified facts. [GDELT](https://gdeltproject.org/data.html) · [Bluesky](https://docs.bsky.app/docs/api/app-bsky-feed-get-feed) · [Mastodon](https://docs.joinmastodon.org/client/public/) |
| **4** | Narrow official X watchlist | **US$0.005 per Post read** and **US$0.010 per User read** | Best paid social pilot for Ripple. Obtain approval for the described analysis and display use case, cap spend, and handle edits and removals. [X pricing](https://docs.x.com/x-api/getting-started/pricing) · [X agreement](https://docs.x.com/developer-terms/agreement) |
| **5** | Instagram known-post display and a verified Weibo trial | Instagram has no general published per-call price; Weibo Credit packs start at **¥69**, with endpoint costs inside the verified service | Use for specific research questions. Confirm eligible content, retention, and consumer display before rollout. [Instagram API](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api) · [Weibo](https://open.weibo.com/cli/quickstart) |
| **6** | Enterprise social listening contract | **Custom quote** | Consider only when cross-platform coverage and explicit downstream app rights justify the spend. |
| **7** | Direct Truth Social, RED, or general Taobao-post ingestion | Truth has no official rate card; a reported institutional range is **US$60,000–$100,000/month**. RED and general Taobao-post prices are unavailable. | Defer pending a high-value use case and an express source licence. [Truth API](https://www.globenewswire.com/news-release/2026/07/16/3328489/0/en/Trump-Media-and-Technology-Group-Launches-Truth-API-a-New-Licensed-Data-Service-for-Financial-Services-Partners-That-Provides-the-Fastest-Access-to-Truth-Social-s-Most-Influential-.html) · [Reported price](https://www.axios.com/2026/08/04/trump-truth-social-feed-trades) |

#### Public-Record And OSINT Source Shortlist

| Source | Access and price | Best Ripple use | Important limit |
|---|---|---|---|
| [SEC EDGAR submissions and Company Facts](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | No API key or published per-call fee | Add 8-K, 10-K, 10-Q, and XBRL facts alongside existing Form 4 data | Respect the SEC's [10 requests/second fair-access guideline](https://www.sec.gov/about/developer-resources); preserve filing date and accession ID. |
| [Federal Register API](https://www.federalregister.gov/developers/documentation/api/v1) | Ripple's current keyless source | Follow policy topics, orders, rules, and notices | A proposal, final rule, and effective date are different events. |
| [USAspending API](https://api.usaspending.gov/docs/endpoints) | Endpoints currently require no authorization | Connect firms and sectors to federal awards and grants | Distinguish award amount from actual spending and later amendments. |
| [AusTender contract notices](https://data.gov.au/data/en/dataset/historical-australian-government-contract-data/resource/a7f471ad-e085-49b5-bd6b-1b270ea46e99) | Open API data; no per-call price shown on the cited page | Australian procurement context | Match suppliers by identifier and review contract changes. |
| [ABN Lookup](https://abr.business.gov.au/Tools/WebServices) | Free web services with registration and an authentication GUID | Resolve Australian organization identities | Follow its web-services agreement; an ABN match alone does not prove two records concern the same event. |
| [UK Companies House](https://developer.company-information.service.gov.uk/get-started) | Authenticated API; verify any product-specific charge | UK company profiles, officers, and filings | Respect its [600-requests-per-five-minutes limit](https://developer-specs.company-information.service.gov.uk/guides/rateLimiting). |
| [GDELT](https://gdeltproject.org/data.html) | Free/open database | Discover international news and topic changes | It indexes media coverage; check the underlying story and primary record. |
| [OpenFEC](https://api.open.fec.gov/developers/) | API key and published call limits | Defined US campaign-finance research | Contributor lists have commercial-use restrictions; do not build person-level donor dossiers. |
| [ASIC company extracts](https://www.asic.gov.au/online-services/search-asic-registers/company-and-organisation-registers) | Current company extract listed at **A$10** | A specific Australian company investigation | Purchase selectively; free registry details may answer simpler questions. |
| [OFAC Sanctions List Service](https://ofac.treasury.gov/sanctions-list-service) | Downloadable official lists; no price stated on the cited page | Narrow, documented entity checks when relevant | A fuzzy name match is not a confirmed identity or allegation. Require human review. |

- **OSINT workflow:** Search official records first, normalize names and identifiers, compare dates and document versions, preserve the original URL, and record why a match was accepted or rejected. Do not infer intent or wrongdoing from proximity in a graph.
- **Useful analyst tools:** [OpenRefine](https://openrefine.org/) is free and open source for cleaning and reconciling messy names; its reconciliation still needs human judgment. [Datasette](https://docs.datasette.io/en/latest/) is an open-source way to explore structured local datasets. They can support an internal workflow without becoming Ripple's consumer interface.

#### Social Platforms: Access, Price, And Use

| Platform | Official route and price | Recommended treatment |
|---|---|---|
| **X / Twitter** | Pay per use: **US$0.005/Post read**, **US$0.010/User read**, and a 3 million monthly Post-read pay-per-use cap. [Pricing](https://docs.x.com/x-api/getting-started/pricing) | Curated watchlist only after X approves the use case. Its agreement allows a reasonable, attributed display but restricts derivatives, redistribution, substitute clients, and unapproved analysis. Keep displayed Posts current. [Agreement](https://docs.x.com/developer-terms/agreement) · [Display requirements](https://docs.x.com/developer-terms/display-requirements) |
| **Instagram** | No general per-call rate published. The Graph route focuses on authorized Professional accounts; official embedding can render a known eligible public URL. [API](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api) · [Embed implementation](https://github.com/facebook/meta-embeds-for-wordpress) | Use known-post display or authorized accounts, not an assumed arbitrary-public-post corpus or copied media library. [Meta terms](https://developers.facebook.com/terms/) |
| **Weibo** | Developer verification; a limited seven-day trial; Credit packs from **¥69**, expiring after 365 days. Endpoint Credit charges require service-list access. [Quick start](https://open.weibo.com/cli/quickstart) | Pilot if China coverage is important. Obtain explicit public display, cache, and media rights. |
| **Truth Social** | Licensed institutional **Truth API**; no official public rate card. Reported **US$60,000–$100,000/month** is not an offer to Ripple. [Launch](https://www.globenewswire.com/news-release/2026/07/16/3328489/0/en/Trump-Media-and-Technology-Group-Launches-Truth-API-a-New-Licensed-Data-Service-for-Financial-Services-Partners-That-Provides-the-Fastest-Access-to-Truth-Social-s-Most-Influential-.html) · [Reported range](https://www.axios.com/2026/08/04/trump-truth-social-feed-trades) | Defer direct API. A listening vendor may be more practical for internal research, but consumer-app display must be licensed separately. [Consumer terms](https://help.truthsocial.com/legal/terms-of-service/) |
| **Xiaohongshu / RED** | Official scopes reviewed do not provide a general public Note-reading API or price. [Scopes](https://openaccount.xiaohongshu.com/docs/scope) | Manual, linked research or an explicit partnership; no default automated Note feed. |
| **Taobao** | No general public social-post feed established. Seller-authorized review search covers that seller's recent reviews. [Review endpoint](https://developer.alibaba.com/docs/api.htm?apiId=55) | Treat reviews, merchant content, and livestreams as separate possible products. The published value-added technical fee is **¥0.06/100 calls inside Jushita** or **¥0.60/100 outside**, and outside calls need permission; that fee is not a general-post licence. [Fee rules](https://developer.alibaba.com/docs/doc.htm?articleId=104559&docType=1&treeId=713) |
| **Bluesky / Mastodon** | Documented public-read APIs; no platform read fee stated in the cited documents. [Bluesky](https://docs.bsky.app/docs/api/app-bsky-feed-get-feed) · [Mastodon](https://docs.joinmastodon.org/client/public/) | Good optional social context; review rate limits, server rules, and display behavior before production. |

#### Commercial Providers And Collection Alternatives

| Option | Price | When it helps | Boundary |
|---|---|---|---|
| [Meltwater](https://www.meltwater.com/en/products/social-media-monitoring) | [Custom quote](https://www.meltwater.com/en/pricing) | Broad social and media monitoring | Confirm exact X, Instagram, Weibo, and RED coverage, API/export, and consumer display rights in the contract. |
| [Talkwalker / Hootsuite Listening](https://www.hootsuite.com/whats-new/truth-social-data-now-available-in-talkwalker-listening) | Enterprise quote | Official Truth Social listening alongside other networks | Listening inside its dashboard does not establish permission to republish into Ripple. |
| [Brandwatch](https://www.brandwatch.com/datanetworks/) | [Sales quote](https://www.brandwatch.com/plans/) | Compare network and regional coverage | Ask for source-by-source fields, retention, API access, and downstream rights. |
| [Bright Data](https://brightdata.com/pricing/web-scraper) | **5,000 free records/month**; **US$1.50/1,000 delivered records** pay as you go | Collection feasibility tests where permitted | Extraction price is not a source-platform display or derivative-use licence. |
| [Apify](https://apify.com/pricing) | **US$5 monthly free usage**; **US$19/month Starter** plus Actor/usage costs | Site-specific collection experiments where permitted | Actor quality and source rights vary. Do not use it to evade platform access rules. |

- NOTE: For a licensed vendor, ask whether Ripple may **display to paying end users**, summarize, send content to an external model, cache it, export it, include media, and retain it after edits or deletion. Get each answer per platform and region.

#### What May Appear In The App

- **Official public-record card:** Present Ripple's own factual summary and interpretation with the filing or agency link, document date, retrieval date where relevant, and a correction path.
- **Displayed social post:** Use only a platform route or licence that permits Ripple's specific display. Preserve the required attribution, post text, dates, links, branding, and deletion behavior. An API response alone is insufficient permission.
- **Ripple editorial analysis of a social lead:** Verify the underlying fact with an issuer release, filing, or other primary record. Label the card as Ripple's analysis and retain the source link when permitted. Do not style a paraphrase as though it were an original post.
- **Paraphrasing:** Facts and ideas can be reported in original words, but close rewriting may still copy protected expression. It does not cure an unapproved API use or collection method. X expressly includes derivatives in X Content and requires its explicit approval for API analysis. [Australian copyright basics](https://www.ag.gov.au/rights-and-protections/copyright/copyright-basics) · [X agreement](https://docs.x.com/developer-terms/agreement)
- EX: A social post flags a possible buyback. The workspace records the post as a lead, finds the issuer announcement or filing, checks the timing and amount, and publishes a Ripple card citing that primary record. The post remains linked or displayed only as its licence allows.

#### Research Workspace: Minimum Useful Design

- **Case:** A company, policy topic, or event with a question, owner, status, and last-reviewed time.
- **Evidence item:** Source type, stable native ID, original URL, publisher, author or filing entity, event time, publication time, retrieval time, permitted excerpt, and retention/deletion rule.
- **Claim:** A concise statement linked to supporting and conflicting evidence, with a status such as *lead*, *corroborated*, *disputed*, or *withdrawn*. Record who changed the status and why.
- **Entity:** Keep CIK, ticker, ABN/ACN, company number, and known aliases separately. Propose matches automatically if useful; require review before joining records across people or firms.
- **Research view:** Cross-source search, a shared timeline, side-by-side documents, saved queries, alerts, and an exportable cited brief. A public Ripple card is a reviewed output from the case, not a raw feed item.
- **First prototype:** Local-only cases and evidence links using current sources. Add shared sync and accounts when collaboration has a clear need. [Supabase](https://supabase.com/pricing) currently advertises **US$0/month Free** for experiments and **from US$25/month Pro** for a production backend; storage, traffic, compute, backups, and other services may add cost.

#### OPSEC, Accuracy, And Privacy Controls

- **Credentials:** Ripple currently describes optional publicly prefixed Expo tokens. Expo says such values are visible in the compiled app. Put new paid social and registered government API credentials server-side, with scoped access, rotation, spend caps, and usage monitoring. [Expo guidance](https://docs.expo.dev/guides/environment-variables/)
- **Source hygiene:** Prefer read-only API scopes. Track the permitted cache window and propagate edits, withdrawals, deleted posts, and corrections. Avoid indefinite raw-post archives.
- **Evidence hygiene:** Preserve original timestamps and document versions. Separate a transaction date from its disclosure date, and a market move from an asserted cause. Show unresolved OCR or identity matches as uncertain.
- **Workspace access:** Use least-privilege roles, audit logs, encrypted transport/storage, limited retention, and a way to correct or remove an item. Do not upload licensed posts to external AI services without contractual permission.
- **Person-level limits:** Center research on public events and organizations. Avoid dossiers, sensitive inferences, political profiling, or surveillance-style alerts. A sanctions or donor name match needs manual identity verification and context. [X restricted-use rules](https://docs.x.com/developer-terms/restricted-use-cases) · [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/)

#### iOS And Android Store Implications

- **Third-party content:** Apple expects Ripple to have permission under a third-party service's terms to access and display that service's content; it may ask for evidence. Both stores enforce intellectual-property rules. [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Google IP policy](https://support.google.com/googleplay/android-developer/answer/9888072?hl=en)
- **Product value:** An app primarily serving links or copied posts faces Apple's content-aggregator concern. The reviewed connection between a statement, a primary record, and market context is Ripple's own value. [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **UGC moderation:** Imported public posts, comments, or links to user-generated content can trigger filtering, reporting, blocking/hiding, timely response, and support obligations. A feed consisting only of Ripple's own editorial cards may be assessed differently; the specific feature design matters. [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Google UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en)
- **Privacy disclosures:** Ripple's existing compliance baseline assumes no accounts, analytics, or backend-held user history. A shared workspace, saved research, alerts, provider logs, or new accounts require updated privacy and store Data Safety answers. [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Google user-data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)
- **Financial positioning:** Keep the app's read-only research purpose accurate. Trade execution, account management, or personalized investment advice would require a new store and legal review. [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Google financial-features policy](https://support.google.com/googleplay/android-developer/answer/13849271?hl=en)

#### Illustrative Monthly Budget

| Scenario | Published source/platform charges | What the number excludes |
|---|---|---|
| **Local research prototype** | **US$0 new source licences** using current keyless records, GDELT, and local cases | Development time, device testing, document processing, market-data validation. |
| **Small connected X pilot** | **About US$40** = 3,000 distinct X Post reads at US$15 plus a Supabase Pro starting price of US$25 | X User reads, extra API operations, backend overages, alerts, processing, staffing, and any required higher X tier. [X](https://docs.x.com/x-api/getting-started/pricing) · [Supabase](https://supabase.com/pricing) |
| **Larger X pilot** | **About US$175** = 30,000 distinct X Post reads at US$150 plus the same US$25 backend starting price | The same exclusions; the actual response mix and X approval determine feasibility. |
| **Multi-platform enterprise coverage** | **Quote required** from listening vendors; direct Truth pricing is unpublished | Consumer-app display, seats, API/export, historical access, territories, volume, and licensed model processing may materially change the contract. |

- NOTE: These are **illustrations, not production quotes**. Pay-per-use X is designed for prototyping and limited-user integrations; a larger commercial app may need Enterprise even below the numerical read cap. [X agreement](https://docs.x.com/developer-terms/agreement)

#### Decisions Before Buying Or Publishing

- Q: Which exact platforms, account lists, countries, languages, and historical windows does Ripple need?
- Q: Will the vendor or platform permit consumer-app display, excerpts, analysis, model processing, and push alerts?
- Q: How long may Ripple cache text and media, and how quickly must corrections and deletions propagate?
- Q: What are the real monthly minimum, per-record, seat, API/export, overage, and regional costs?
- Q: Which primary record will support each public claim, and who can approve or withdraw a card?
- Q: Does the research workspace need single-device privacy, shared collaboration, or public user accounts?
