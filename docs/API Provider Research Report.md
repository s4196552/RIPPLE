# Ripple API provider research report

**Research date:** 3 October 2026, Australia/Sydney. Prices below are US dollars, before taxes, unless stated otherwise.

## Recommendation

For a public Ripple launch, shortlist **Quiver Commercial for parsed congressional trades + Tiingo's startup display-redistribution package for daily stock history**, while retaining **SEC EDGAR for insider filings** and **Federal Register for policy documents**. This is an architectural and procurement recommendation, conditional on endpoint trials and written confirmation that the licenses cover Ripple's screens, derived returns, caching, and audience.

Tiingo publishes **$250/month for startup EOD + IEX display redistribution**; Quiver's commercial price requires a quote. Therefore, the defensible planning figure is **$250/month + Quiver's commercial quote + infrastructure**, subject to startup eligibility and contract scope. It is not a complete launch quote. [Tiingo EOD product and pricing](https://www.tiingo.com/products/end-of-day-stock-price-data) · [Quiver API plans](https://api.quiverquant.com/pricing/)

Also request an **FMP commercial bundle quote** covering Congress and daily prices. It could simplify the stack, but its exact congressional endpoint entitlement and commercial price remain unverified. Evaluate **Twelve Data Business** if broader market coverage becomes a requirement. The current app primarily needs daily historical prices and volume; paying for comprehensive real-time feeds is not yet justified by its implemented behavior.

## Scope and evidence

This report covers Ripple's four implemented source categories: congressional disclosures, corporate insider filings, policy documents, and stock prices. It compares existing key integrations with alternatives, costs, access restrictions, and implementation implications. Social and crypto-wallet expansion are outside this report.

Evidence comes from the current working tree, a values-withheld local configuration inspection, and official vendor/government documentation. Finnhub's dynamic documentation was inspected in a rendered browser. No accounts were created, plans purchased, credentials generated, or authenticated data requests made. Vendor quality, latency, account entitlements, and deployed configuration have not been independently tested.

The working tree contains existing modifications. Findings describe the files inspected during this research, not necessarily a released build. No app code or configuration was changed for this report.

## 1. Current keys and integrations

All three supported credential fields are **empty in the local `.env`**, and all three are **unset in the inspection process environment**. No additional root `.env` variants were found beyond `.env.example`. This establishes local configuration only; it does not establish whether EAS, CI, production builds, or vendor accounts hold other keys.

| Existing variable | Current implementation | Local status | What obtaining a key would do |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_QUIVER_API_TOKEN` | Bearer token for `/beta/live/congresstrading` | Empty | Enables the preferred parsed congressional-trade path, if entitled |
| `EXPO_PUBLIC_FMP_API_KEY` | Query parameter for `/stable/house-latest` and `/stable/senate-latest` | Empty | Enables the alternative congressional-trade path; does not currently supply stock prices |
| `EXPO_PUBLIC_FINNHUB_API_KEY` | Query parameter for `/search` and `/stock/candle` | Empty | Switches symbol search and price history to Finnhub; candle entitlement is essential |

Configuration evidence: the inspected local `.env` and process environment. Integration evidence: [Congress provider](<A:/M. PROJECTS/RIPPLE/src/providers/congress/CongressProvider.ts:114>) and [Stocks provider](<A:/M. PROJECTS/RIPPLE/src/providers/stocks/StocksProvider.ts:43>).

| Source | Default route with the inspected configuration | What Ripple obtains | Principal limitation |
| --- | --- | --- | --- |
| Congress | House Clerk annual filing indexes and linked PDFs | Filer, filing date, document link | Current keyless parser does not extract PDF trade rows or supply Senate discovery |
| Insiders | SEC submissions and Form 4 files | Parsed insider transactions | Client performs discovery, downloads, and parsing; requires fair-access controls |
| Policy | Federal Register documents API | Presidential documents and keyword matches | Publication feed, not every speech or announcement at the moment it happens |
| Stocks | Yahoo search and chart endpoints | Symbol matches and daily close/volume history | Undocumented dependency identified by the code; browser CORS and throttling limitations are documented locally |

See [Congress implementation](<A:/M. PROJECTS/RIPPLE/src/providers/congress/CongressProvider.ts:126>), [SEC implementation](<A:/M. PROJECTS/RIPPLE/src/providers/insider/InsiderProvider.ts:64>), [policy implementation](<A:/M. PROJECTS/RIPPLE/src/providers/policy/PolicyProvider.ts:37>), and [stock endpoints](<A:/M. PROJECTS/RIPPLE/src/providers/stocks/StocksProvider.ts:58>). Availability of these routes was not smoke-tested during this research.

## 2. Existing paid-provider options

### Quiver: strongest direct fit for congressional data

The API Hobbyist plan is **$30/month**, or **$300/year** ($25/month equivalent). It includes congressional trading. Trader is **$75/month**, or **$750/year**, and adds datasets including insider trading. Both explicitly exclude commercial use. Commercial includes commercial rights and is quote-based. These are API prices, not a substitute subscription to the consumer website. [Official API pricing](https://api.quiverquant.com/pricing/)

**Assessment:** prioritize a commercial sample and quote. The adapter already exists, so the main work is backend migration, historical coverage, identity handling, and validation. Ask whether the license also includes usable daily equity history before commissioning a second provider; the API homepage lists that dataset, but its suitability for Ripple's benchmark calculations and plan inclusion were not established. [Quiver dataset overview](https://api.quiverquant.com/)

A working token proves authentication. It does not by itself prove full history, both-chamber completeness, or permission to publish the data.

### Financial Modeling Prep: possible combined supplier

FMP lists Basic at **250 calls/day free**, and personal Starter/Premium/Ultimate at **$19/$49/$99 per month billed annually**, with **300/750/3,000 calls per minute** respectively. It separately requires a **Data Display and Licensing Agreement** for display or redistribution. These prices are not public-app licensing quotes. The extracted plan table did not reliably establish which congressional endpoints belong to each tier; do not budget a free key as sufficient. [FMP pricing and display requirements](https://site.financialmodelingprep.com/developer/docs/pricing)

FMP documents both latest House and Senate disclosures, as well as daily price/volume history. Ripple already calls the two disclosure routes, but implementing FMP stock history would require a new adapter. [House endpoint](https://site.financialmodelingprep.com/developer/docs/stable/house-latest) · [Senate endpoint](https://site.financialmodelingprep.com/developer/docs/stable/senate-latest) · [Daily prices endpoint](https://site.financialmodelingprep.com/developer/docs/stable/historical-price-eod-full)

**Assessment:** obtain a single quote listing those exact endpoints, historical backfills, per-member lookup, adjustments, SPY, logos, and public display rights. Compare that complete offer with Quiver plus Tiingo.

### Finnhub: current integration needs entitlement-aware handling

The official rendered documentation marks stock candles as **Premium**. Symbol lookup is separately documented, so successful search is not evidence of candle access. Authentication supports a token parameter or `X-Finnhub-Token` header. [Finnhub documentation](https://finnhub.io/docs/api/stock-candles)

Finnhub's terms require written permission to share data or derived results; listed plans are personal unless explicitly stated otherwise, and business internal use also requires approval. [Finnhub terms](https://finnhub.io/terms-of-service)

**Assessment:** a free key is not a complete replacement for Yahoo history. Keep Finnhub on the shortlist only if its candle access and permitted use are confirmed. No reliable current paid candle-plan price was established in this review, so none is estimated here.

## 3. Alternatives worth considering

| Provider | Verified offering and indicative price | Ripple fit and decision |
| --- | --- | --- |
| **Tiingo** | EOD OHLCV, dividends, splits, raw and adjusted data. Free individual tier: 50 requests/hour and 1,000/day. Personal $30/month; internal commercial $50/month. EOD + IEX **display redistribution $250/month for startups, $500/month enterprise**. [Product pricing](https://www.tiingo.com/products/end-of-day-stock-price-data) | **Preferred price-data trial.** Daily history closely matches the app. Confirm startup eligibility, derived-return rights, permitted cache retention, and SPY coverage. Internal commercial is distinct from redistribution. [Licensing documentation](https://www.tiingo.com/documentation/general) |
| **Twelve Data** | Basic: 8 credits/minute, 800/day. The business page prominently displays **Venture $499/month** and **Enterprise $1,099/month**, but also contains a conflicting lower “from $149” Venture figure. Treat checkout or a quote as authoritative for the selected capacity. [Business pricing](https://twelvedata.com/pricing-business) | Strong broader-market alternative. Business display rights remain subject to feed/exchange conditions; redistribution needs a separate agreement. ASX external use requires additional ASX licensing. [Usage rules](https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage) |
| **Massive** | Individual Basic: free, 5 calls/minute, two years of history; Starter $29/month, Developer $79/month, Advanced $199/month. [Individual pricing](https://massive.com/pricing?product=stocks) | Good US-market breadth and bulk history. Stocks Business is **$2,499/month**, including real-time fair-market-value data and end-of-day SIP data; live exchange feeds can require add-ons. Too costly for the present MVP unless those capabilities are needed. [Stocks Business](https://massive.com/stocks) |
| **Alpha Vantage** | Standard free allowance **25 requests/day**; premium plans remove the daily cap. [Premium access](https://www.alphavantage.co/premium/) | Useful small research trial; limited allowance is a poor shared-app baseline. Confirm the precise historical function and commercial license before using it. A quote endpoint alone cannot calculate historical reactions. [Terms](https://www.alphavantage.co/terms_of_service/) |
| **SEC-API.io** | Parsed Forms 3/4/5 and other filing APIs; first 100 calls free. Personal/startup **$55/month**, or $49/month billed annually. Internal business $239/month, or $199/month annually. Redistribution requires a separate enterprise arrangement. [Pricing](https://sec-api.io/pricing) | Buy if maintaining EDGAR ingestion becomes expensive. It is a convenience alternative to Ripple's existing parser, not the first subscription needed. |
| **FiscalNote PolicyNote API** | Free **4,000 results/month**; self-serve **$300/month for 20,000 results**. [Pricing](https://fiscalnote.com/policynote-api-pricing) | Consider for broader legislative/regulatory research. It adds scope beyond the current presidential-document feed; measure results consumed, not just HTTP requests, and confirm display terms. |

**Volume comparability matters.** Twelve Data says its default US feed represents roughly 5% of total market activity. Ripple generates volume-spike signals, so mixing that feed with consolidated historical volume could distort those signals. Test feed consistency and negotiate the necessary dataset. [Twelve Data US coverage](https://support.twelvedata.com/en/articles/9935903-us-equities-market-data)

**Derived percentages still need a license.** Massive explicitly says displaying a calculated price or percentage change is covered by its app-use licensing requirements. Replacing raw prices with return chips does not establish an exemption. [Massive app-use guidance](https://massive.com/knowledge-base/article/which-plan-do-i-need-to-show-massive-data-in-my-app)

## 4. Public sources to retain

**SEC EDGAR:** its submissions/XBRL APIs require no API key. Form 4 transactions still require retrieving the relevant filing content; the submissions API is an index of filings, not a ready-made parsed trade feed. Centralize collection and caching so mobile users share ingestion work. [SEC API documentation](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)

SEC's published limit is no more than **10 requests/second per user across machines**. Ripple has a client queue, but moving ingestion to a backend requires an aggregate limiter. Confirm that the contact address in the current User-Agent is controlled and monitored. [SEC developer guidance](https://www.sec.gov/about/developer-resources) · [Current SEC headers](<A:/M. PROJECTS/RIPPLE/src/providers/insider/InsiderProvider.ts:64>)

**Federal Register:** its public API explicitly requires no keys. Keep it for current policy coverage and preserve the linked official publication. Its web rendition is an informational version, and the site identifies the official government PDF as the legal reference. Do not assume publication time equals signing or announcement time. [Federal Register API and publication notice](https://www.federalregister.gov/developers/documentation/api/v1)

**House Clerk:** retain primary-document provenance and the filing-only fallback. Building OCR and normalization in-house is an engineering alternative, with ongoing costs for scanned documents, amendments, identity matching, and verification. It would not automatically add Senate ingestion. These limitations follow from Ripple's present [index/PDF implementation](<A:/M. PROJECTS/RIPPLE/src/providers/congress/CongressProvider.ts:126>).

**Yahoo:** classify as a prototype dependency, with operational and redistribution suitability unresolved. A keyless response is not proof of a supported API or permission to redistribute. The current implementation itself documents CORS and rate-limit problems. [Stocks provider](<A:/M. PROJECTS/RIPPLE/src/providers/stocks/StocksProvider.ts:18>)

## 5. What adding keys will not fix

These findings come from static code inspection; they are not results of authenticated integration tests.

1. **Publicly embedded secrets.** All three key variables use `EXPO_PUBLIC_`. Expo states those values appear in plaintext in the compiled app. Put shared provider credentials in server-side secret storage and have the app call Ripple's backend. Git-ignoring `.env` protects the repository, not the compiled application. [Expo environment guidance](https://docs.expo.dev/guides/environment-variables/)

2. **House-based member discovery.** Congress search constructs individual subjects from House index rows. `getSignals()` returns early when no matching House rows exist, before requesting an aggregator. A vendor's Senate coverage therefore does not translate into complete Senate support in Ripple. Separate both-chamber identity discovery from House fallback documents. [Search](<A:/M. PROJECTS/RIPPLE/src/providers/congress/CongressProvider.ts:390>) · [Early return](<A:/M. PROJECTS/RIPPLE/src/providers/congress/CongressProvider.ts:458>)

3. **FMP history is capped by the adapter.** It requests only page zero with 25 rows per chamber. An upgraded plan will not change that request. Add pagination or member-specific history, and retain corrections and older records in storage. [FMP request](<A:/M. PROJECTS/RIPPLE/src/providers/congress/CongressProvider.ts:326>)

4. **No automatic Quiver-to-FMP failover.** When both keys exist, `fetchKeyedTrades()` selects Quiver. Failure falls back toward House filings, not a second attempt through FMP. If redundancy is desired, implement it explicitly and deduplicate the two feeds by source filing and transaction identity. [Selection logic](<A:/M. PROJECTS/RIPPLE/src/providers/congress/CongressProvider.ts:363>)

5. **Finnhub can replace working Yahoo history with an access failure.** The inspected `loadSeries()` chooses Finnhub whenever a key exists. It does not fall back to Yahoo there after candle denial, although search has its own fallback. Validate candle capability before activating that route. [Price loader](<A:/M. PROJECTS/RIPPLE/src/providers/stocks/StocksProvider.ts:281>)

6. **Three-month history limits analysis.** Yahoo requests `3mo`; Finnhub requests approximately 90 days. Older event reactions are deliberately unavailable when the event predates the series. Purchase sufficient history, but also change the date-window request and persistence strategy. [History window](<A:/M. PROJECTS/RIPPLE/src/providers/stocks/StocksProvider.ts:68>) · [Reaction guard](<A:/M. PROJECTS/RIPPLE/src/providers/stocks/reaction.ts:38>)

7. **Price adjustment policy needs an explicit contract.** The Yahoo parser uses `quote.close`, and Ripple's `Series` has no adjustment-basis field. Specify whether output represents split-adjusted price return or dividend-inclusive total return, and apply the same basis to stocks and SPY. Preserve session dates, timezone, currency, and provider provenance.

8. **README claims need correction.** Quiver's $25 figure is an annual equivalent, Finnhub candles are premium, and FMP free congressional access is not established. The README also describes a 30-minute daily-series cache, but no shared cache was found in the inspected `loadSeries()` path. Cost planning should follow actual request behavior. [README](<A:/M. PROJECTS/RIPPLE/README.md>) · [Current price loader](<A:/M. PROJECTS/RIPPLE/src/providers/stocks/StocksProvider.ts:281>)

## 6. Cost and request planning

| Scenario | Planning cost | Appropriate use |
| --- | --- | --- |
| Existing local configuration | $0 paid API subscriptions configured locally | Development using public routes; availability and Yahoo reuse rights remain unresolved |
| Personal research prototype | $30/month Quiver Hobbyist + eligible free individual price tier | Non-commercial evaluation within vendor limits; not a public launch budget |
| Recommended public MVP shortlist | $250/month Tiingo startup redistribution + Quiver commercial quote + infrastructure | Conditional on eligibility, contract scope, and successful trials |
| Combined-provider alternative | FMP commercial quote + infrastructure | Compare endpoint coverage and complete licensing cost |

Price sources are the provider sections above. Exchange add-ons, taxes, storage, compute, and data-processing labor are excluded. No currency conversion is assumed.

**Illustrative workload, not measured app traffic:** 100 users each requesting 20 tickers plus SPY across 13 refreshes create 27,300 symbol-history loads per trading day without sharing. A backend serving a combined universe of 200 tickers plus SPY with 13 shared refreshes reduces that to 2,613 loads; one daily update reduces it to 201. Search, filings, retries, and backfills add traffic. Batch pricing and credit weights vary by vendor.

For an EOD product, retrieve completed sessions once daily, process corrections later, and serve stored series. Fetch a long historical backfill once, then request incremental updates. Coalesce simultaneous requests for the same ticker and keep SPY shared across all comparisons.

## 7. Procurement and rollout sequence

1. **Define the launch dataset:** US stocks and ETFs, SPY, daily prices and volume, both congressional chambers, and enough history to cover the displayed holdings and reaction windows. Specify the return adjustment policy.
2. **Obtain two comparable offers:** Quiver Commercial plus Tiingo startup redistribution; FMP covering Congress plus EOD prices. Request exact endpoint entitlements, history, update latency, quotas, amendments, and source links.
3. **Confirm rights for actual features:** free and paid users, native app and web, return chips, volume signals, caching and retention, screenshots, exports, attribution, and any restrictions on derived datasets. Include logos if used.
4. **Run a small backend trial:** representative US tickers plus SPY; recent and old House/Senate records; splits, dividends, holidays, amended filings, and unavailable securities. Compare parsed trades to their primary filings. Measure completeness and latency rather than relying on vendor marketing.
5. **Fix the integration gaps:** both-chamber discovery, pagination, date ranges, provenance, shared cache, endpoint-specific capability checks, and safe error logging that redacts credentials.
6. **Enable production credentials on the backend:** use separate development and production keys, bounded quotas, rotation procedures, and per-provider health records. Keep raw provider secrets out of mobile and web bundles.

Acceptance should require successful authentication **and** the expected payload, required historical range, source timestamps, coherent price adjustments, and explicit display permission. HTTP 200 alone is insufficient.

## 8. Remaining uncertainties

- There are no configured local keys to test. Deployed keys, subscription ownership, balances, and billing were not inspected.
- Quiver's commercial price, rate limits, backfill rights, and daily-price suitability require confirmation.
- FMP's exact congressional plan entitlement and commercial quote were not established from the extracted public table.
- Finnhub premium candle pricing was not verified; premium classification and personal-use restrictions were verified.
- Twelve Data's official pricing material contains conflicting Venture starting figures; the report preserves that ambiguity instead of presenting a lower figure as guaranteed.
- Tiingo startup eligibility and contractual coverage of Ripple's derived metrics require confirmation.
- No provider's accuracy, completeness, latency, or uptime was independently benchmarked in this research.

The immediate decision is to trial the proposed daily-price and congressional stack through a backend, then buy the license that covers Ripple's actual public use. Filling the existing Expo key fields is not a production-ready integration plan.
