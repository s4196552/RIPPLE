#### Ripple Crypto Wallet Tracking Feasibility

- NOTE: Researched on **2 October 2026**. API prices, free-tier rules and terms change often; re-check each before building against it.
- **Recommendation:** Add a **Wallets** source that follows a **curated list of wallets whose ownership is documented** — public officials, government treasuries, and the companies and projects tied to them — and shows each wallet's attribution evidence on screen. Show a "linked" wallet only when the link itself is documented. Keep heuristic clustering (wallets that *look* related on-chain) as an internal research lead, never as a public card.
- **Reason:** On-chain activity is public and fits Ripple's "people whose actions move markets" idea, but **who owns a wallet is not on-chain**. Every attribution is a claim. A wrong one names a real person as moving money they never touched, which is both a defamation risk and the exact kind of personal-information compilation Apple's guidelines prohibit.

#### Terms

- DEF: **Attribution** means a claim that a real person or organization controls an address, with the evidence for that claim.
- DEF: **Linked wallet** means an address connected to an attributed one. The connection may be documented (an official record, a contract relationship) or inferred (transaction patterns). Only the first kind is publishable.
- DEF: **Clustering heuristic** means a rule that groups addresses as probably sharing an owner, such as Bitcoin's common-input-ownership rule or a shared exchange deposit address. Heuristics produce leads, not facts.
- ANLGY: An address is like a numbered bank account whose statement is pinned to a public wall. Anyone can read every deposit and withdrawal, but nothing on the statement says whose account it is.

#### Attribution Evidence Tiers

| Tier | Evidence | Example | Ripple treatment |
|---|---|---|---|
| **1 — Self-published or official** | The owner or a government publishes the address, or the owner's name record (e.g. ENS) points to it | El Salvador's treasury, published at [bitcoin.gob.sv](https://www.nasdaq.com/articles/el-salvador-launches-website-to-track-$360m-bitcoin-treasury); addresses in the [OFAC SDN list](https://github.com/0xB10C/ofac-sanctioned-digital-currency-addresses) | Publish as attributed, with a link to the source |
| **2 — Official record matched to the chain** | A disclosure, court filing or issuer filing gives figures that match one address exactly | Trump's 2023 disclosure matched to ETH address `0x9484…22ce` by [Arkham](https://x.com/arkham/status/1691875444809781337) ([CoinDesk](https://www.coindesk.com/markets/2023/08/16/trump-owns-even-more-crypto-than-first-known-new-documents-show)) | Publish with the wording "attributed by [who], based on [record]" and the match method |
| **3 — Reputable third-party label** | A block-explorer or analytics label, or investigative reporting, without a primary record | The "World Liberty: Multisig" label on [Etherscan](https://etherscan.io/address/0x5be9a4959308a0d0c7bc0870e319314d8d957dbb) | Publish only for organizations, never for private individuals; show "labelled by [who]" and a dispute path |
| **4 — Heuristic linkage** | On-chain patterns only: funding source, timing, shared deposit address | "This wallet was funded by X" | Internal lead only. Never shown as ownership. |

- NOTE: Labels from tier 3 are wrong often enough to matter. Tim Draper publicly said Arkham [wrongly linked him](https://www.tradingview.com/news/cointelegraph:a59f93473094b:0-tim-draper-says-arkham-got-bitcoin-wallet-attribution-wrong/) to a large Bitcoin transfer, and Mantra's CEO [disputed Arkham's labels](https://it.tradingview.com/news/cointelegraph%3A35a31a3e9094b%3A0-mantra-ceo-denies-insider-om-token-dump-says-arkham-mislabeled-wallets) during the OM collapse.

#### Who Is Worth Following

| Subject | Kind | Best available tier | Why it matters |
|---|---|---|---|
| Donald Trump — personal ETH wallet | Public official | 2 | His 2025 disclosure (released June 2026) reports crypto in personal and business wallets worth over US$200 million. [Finbold](https://finbold.com/president-trump-discloses-his-cryptocurrency-holdings/) · [The Block](https://www.theblock.co/amp/post/406782/president-trump-financial-disclosures-hundreds-millions-crypto-related-income) |
| World Liberty Financial (WLFI) treasury and token contracts | Company linked to an official | 3 (Etherscan labels) | Large treasury moves are market events; WLFI publicly explained a US$250 million reshuffle as "not selling". [Decrypt](https://decrypt.co/304163/trump-world-liberty-moves-250-million-ethereum) |
| WLFI vesting contract | Contract | 1 (on-chain contract) | Trump's ~14.2 billion WLFI are locked until a **May 2028** cliff, then release through May 2031: a known future event Ripple can show on the timeline. [CoinDesk](https://www.coindesk.com/business/2026/09/14/trump-s-usd800-million-stake-into-world-liberty-financial-s-token-now-has-a-timeline-to-becoming-sellable) |
| El Salvador national treasury | Government | 1 | Published by the government itself, with real-time proof of reserves. |
| US government seized-asset wallets | Government | 2–3 (court records, labels) | Transfers out of them are watched as possible sell pressure. |
| Members of Congress | Public officials | Usually none | Disclosures report crypto **holdings and trades**, not addresses. Ripple should show these as Congress trades (already covered by the trades table's `Crypto` asset type), not hunt for members' addresses. |
| Family members, staff, donors | Mostly private individuals | — | **Out of scope.** Following them crosses from tracking public conduct into building dossiers on private people. |

- NOTE: Whether Trump's 2026 filing lists actual addresses or only describes wallets by holdings and value ranges was not confirmed in this research. Read the OGE filing before relying on it as a tier 1 source.

#### Data Sources

| Source | Chains | Price and access | Key terms for Ripple |
|---|---|---|---|
| [Etherscan API V2](https://docs.etherscan.io/resources/rate-limits) | Ethereum and ~60 EVM chains via one key | Free: 5 calls/s and 100,000 calls/day, shared across chains; free coverage was cut to selected chains | **Free plans are personal and non-commercial only.** A shipped app needs an Advanced plan or higher; "Powered by Etherscan.io APIs" attribution is required; no pass-through proxy or data feed. [API terms](https://etherscan.io/apiterms) |
| [Zerion API](https://zerion.io/api/) | 42 EVM chains plus Solana | Free developer key: 2,000 requests/day; Builder **US$149/month**; Startup **US$499/month** | Returns already-decoded transactions with labels and prices, which removes most of the parsing work. Strongest single fit. [Pricing guide](https://zerion.io/blog/best-multichain-portfolio-apis-2026-guide/) |
| [Helius](https://www.helius.dev/pricing) | Solana | Free: 1M credits/month, 10 req/s; Developer **US$49/month** | Decoded Solana events for 3,600+ programs moved to every plan on 24 Sep 2026. Needed only if Zerion's Solana coverage falls short. |
| [mempool.space](https://mempool.space/enterprise/) | Bitcoin | Public API with unpublished soft limits (~10 req/s); Enterprise from **US$1,499/month** | Open source: running Ripple's own instance avoids both the limits and the fee. |
| [Arkham Intel API](https://info.arkm.com/announcements/the-new-arkham-api) | Multichain, 300M+ labels | Access by application; launched 17 Feb 2026 | **Its terms prohibit sublicensing or making the services available to third parties.** [API terms](https://arkm.com/api-terms-of-service) Usable as an internal research tool, not as a label feed in a consumer app, without a negotiated licence. |
| [OFAC SDN advanced XML](https://compliapi.com/data-sources/ofac-sdn-advanced-xml) | 14 chains incl. BTC, ETH, USDT, USDC | Free official download | Tier 1 attribution, but for sanctions screening rather than market moves. |

#### How It Fits Ripple's Architecture

- **One new provider.** The `Provider` interface in [types.ts](../src/providers/types.ts) already fits: add `'wallets'` to `SourceId`, one file under `src/providers/wallets/`, and one line in `registry.ts`.
- **Subjects are curated entries, not raw addresses.** A handle such as `entity:wlfi-treasury` maps to one or more addresses plus their evidence (tier, source URL, date checked). `searchSubjects` searches that curated list. Adding a new entry is a reviewed code or data change.
- **A signal is a transfer, swap or new-token event over a size threshold.** Example text: "World Liberty treasury sent 5,000 ETH (US$X) to a Coinbase Prime deposit address." Badges can include `TO EXCHANGE`, `FROM EXCHANGE`, `SWAP` and `LARGE TRANSFER`.
- **Price reaction already works.** Yahoo crypto pairs such as `ETH-USD` already flow through the stocks provider and `trades.ts`, so a signal's `ticker` gives the after-move numbers with no new code.
- **Attribution needs a new field.** Add an optional `attribution` (tier, attributor, evidence URL, last checked) to `Actor` or `SubjectResult`, and render it next to the existing provenance tag, so the evidence is always one tap away.
- **User-entered addresses are a separate, safer mode.** Following an address the user pastes in, labelled "Address you added" and never matched to anyone, is block-explorer behavior rather than compiling personal information.

#### Interpretation Rules

- A transfer is not a sale. A move to an exchange deposit address is not a sale either; only a swap or an exchange-side trade shows one.
- Treasury reshuffles, custody migrations and multisig signer changes look large but are routine. Badge them as what they are.
- Famous wallets receive large volumes of airdropped spam tokens. Ignore unsolicited incoming tokens without a market price, or they will dominate the feed.
- State correlation and causation separately, as the existing [research report](./Social%20Content%20API%20And%20Store%20Feasibility.md) requires for every card.

#### Store And Legal Risk

- **Apple 5.1.1(viii):** "Apps that compile personal information from any source that is not directly from the user or without the user's explicit consent, even public databases, are not permitted." Linking addresses to people is the riskiest part of this feature. Limiting subjects to public officials' **official conduct** and to organizations, citing a primary record for each, and leaving out private individuals keeps Ripple closest to its current public-disclosure model. [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/)
- **Apple 3.1.5** covers wallets, mining and exchanges. A read-only tracker that never holds or moves funds does not trigger it; adding a "copy this trade" or swap button would.
- **Defamation and correction:** Every attributed card needs a visible "dispute this attribution" path and a way to withdraw a label quickly, with the withdrawal recorded.
- **Credentials:** Commercial API keys cannot ship in the Expo bundle, where public env values are readable. This feature needs a small server, which changes the current "no backend" answers in the store privacy forms. Confirm with Etherscan that an app backend adding analysis is not the "pass-through proxy" its terms prohibit.
- **Policy context:** The Senate rejected cloture on the CLARITY Act 49–50 on 15 September 2026; its ethics provisions on officials' crypto holdings stalled with it. [NPR](https://www.npr.org/2026/09/15/nx-s1-5968711/clarity-act-crypto-senate-vote) · [CNBC](https://www.cnbc.com/2026/09/14/clarity-act-senate-vote-crypto-regulation.html)

#### Suggested Order

| Phase | Scope | Indicative source cost | Gate before the next phase |
|---|---|---|---|
| **0 — Research prototype** | Local-only Wallets provider over 5–10 curated tier 1–2 entries, on free tiers | **US$0**, but free Etherscan/Zerion terms allow personal research only, so it cannot ship | Feed is useful and spam filtering works |
| **1 — Shippable curated feed** | Tiers 1–3 for organizations and governments, tiers 1–2 for officials; attribution UI; server holding keys | **About US$149/month** on Zerion Builder; add Helius (US$49) or a self-hosted mempool instance only if coverage needs it | App Review accepts the attribution model; dispute path works |
| **2 — User-entered addresses** | Follow any pasted address, unattributed | Same plan; watch request volume | Rate limits and costs hold up |
| **3 — Licensed labels** | Arkham or similar labels in the app | Enterprise quote | Only if a licence explicitly permits consumer display |

#### Decisions Before Building

- Q: Is the feature about **people** (officials) or about **money** (treasuries and projects tied to them)? Starting with the second carries far less attribution and store risk.
- Q: Who reviews a new curated entry, and what evidence tier is the minimum for each subject kind?
- Q: Is Ripple ready to run a backend? This feature cannot ship on commercial terms without one.
- Q: Which chains matter at launch? Ethereum and Bitcoin cover the subjects above; Solana matters mainly for meme-coin activity such as $TRUMP.
- Q: Should known future events (vesting cliffs, unlock schedules) appear on the timeline as scheduled markers?
