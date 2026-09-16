# Ripple

One reverse-chronological feed for the people whose actions move markets —
members of Congress filing trade disclosures, corporate insiders filing Form 4s,
and the White House signing executive orders — merged into a single timeline,
with what the stock did afterwards attached to each signal.

React Native + Expo (SDK 57), TypeScript, iOS + Android, dark by default.

```bash
npm install
npm start          # then press i / a, or scan the QR with Expo Go
```

```bash
npm run typecheck  # tsc --noEmit
npm test           # node:test, 474 unit tests, no jest/babel needed
```

---

## The idea

The reference products for this each do one column of the picture: Quiver tracks
congressional trades and insider filings, trumptracker.org tracks cabinet
trades, trumptrack.app ties official statements to price reaction. Ripple puts
them in one watchlist and one feed.

You follow **subjects** — a representative, a company, a policy topic — and
every disclosure they generate lands in one timeline, newest first, with a
source badge so provenance is always visible.

## What's here

| Screen | File | What it does |
| --- | --- | --- |
| Unified feed | [app/(tabs)/index.tsx](app/(tabs)/index.tsx) | Merged stream grouped into days with a per-day digest header, pull-to-refresh, source filter chips, "N new" pill, tap to open the original filing |
| Trades | [app/(tabs)/trades.tsx](app/(tabs)/trades.tsx) | Disclosed transactions as a table — trader, action, asset, amount, date, return, timing verdict, source — plus the assets the watched group traded most |
| Timeline | [app/(tabs)/timeline.tsx](app/(tabs)/timeline.tsx) | Every source on one shared time axis, one lane each, with a 30D/90D/1Y/All range |
| Source picker | [app/add/index.tsx](app/add/index.tsx) | Step 1 of the add flow — grid generated from the provider registry, each tagged with its live-data status |
| Subject search | [app/add/[source].tsx](app/add/[source].tsx) | Step 2 — debounced autocomplete, inline added-state confirmation |
| Watchlist | [app/(tabs)/watchlist.tsx](app/(tabs)/watchlist.tsx) | Grouped by source, per-subject mute and unfollow |
| Subject detail | [app/subject/[source]/[handle].tsx](app/subject/[source]/[handle].tsx) | One subject's signals, fetched deeper than the feed's per-subject cap, with their own history on a time axis above the list |

## Architecture

```
UI  ──reads──>  feed store  ──fans out to──>  provider registry
                    │                              │
                    └──> merge engine              ├── CongressProvider
                         (dedupe, sort, cap)       ├── InsiderProvider
                    watchlist store                ├── PolicyProvider
                         └──> AsyncStorage         └── StocksProvider
```

Every source sits behind one interface, in [src/providers/types.ts](src/providers/types.ts):

```ts
searchSubjects(query, signal)   -> SubjectResult[]
getSignals(handle, options)     -> Signal[]
normalizeSignal(raw, actor)     -> Signal
mode()                          -> 'live' | 'public' | 'mock'
```

`Signal` is the only shape the UI knows — `{ source, actor, text, url,
timestamp, ticker?, accent?, badges? }` — so merging is a plain sort by
`timestamp` and every screen is source-agnostic.

**Nothing in `app/` or `src/store/` imports a concrete provider.** The picker,
chips, badges and colours are all generated from
[src/providers/registry.ts](src/providers/registry.ts).

### Adding a source

1. Add the id to `SourceId` in `src/providers/types.ts`.
2. Write `src/providers/<name>/<Name>Provider.ts` satisfying `Provider`.
3. Add one line to `PROVIDERS` in `src/providers/registry.ts`.

No UI changes. Obvious next ones: Senate disclosures, federal contract awards,
lobbying filings.

**One contract to get right:** every signal returned by `getSignals(handle)`
must carry `actor.handle === handle`. The feed prunes signals whose actor isn't
a watched subject, so a decorative handle makes the whole source silently vanish
after a successful fetch. There is a regression test for exactly this.

## Data sources — all four work with no API key

The picker tags each source with where its data comes from, so degraded data is
never mistaken for the real thing.

### Congress — `LIVE · NO KEY`, with one honest limitation

[CongressProvider](src/providers/congress/CongressProvider.ts) reads the House
Clerk's annual disclosure index (`{year}FD.txt`, ~80KB, no key, no signup) and
emits one signal per Periodic Transaction Report — the STOCK Act trade filing.

**The limitation, stated plainly:** the Clerk publishes *who filed and when* as
structured data, but the tickers, amounts and direction exist only inside the
filed PDF, frequently as a scan. So the keyless path links to the PDF and does
**not** invent a ticker it hasn't read.

To get ticker-level trades, set `EXPO_PUBLIC_QUIVER_API_TOKEN` (~$25/mo, and
covers the Senate) or `EXPO_PUBLIC_FMP_API_KEY` (free tier). The provider then
serves parsed trades with amounts, direction, disclosure lag, and a
**LATE FILING** badge when a trade breaches the 45-day STOCK Act deadline.

The Senate isn't covered keyless: its eFD system requires accepting an
interstitial agreement and holding a session cookie, which isn't something to do
from a mobile client. Both keyed providers include it.

**Reading a disclosed trade honestly.** With ticker-level data available, each
congressional trade carries two extra pieces of context, because the headline
number on its own flatters the trade:

- **What you missed.** Trades surface weeks after they happen, and some of the
  move is already gone by the time the filing is public. The card shows the
  transaction-date-to-disclosure-date move (`+8.31% BEFORE FILING`) whenever it
  is material, so the reader isn't left assuming the whole return was available
  to them.
- **How many others bought it.** `clusterBuyers` counts *distinct* members who
  disclosed a purchase of the same ticker in a 30-day window (`4 MEMBERS BOUGHT ·
  30D`). Members, not filings — one frequent filer shouldn't be able to look like
  a consensus.

- **How the round trip actually went.** Each member's disclosed buy is paired
  with their own later disclosed sell, and the position is measured over *that*
  holding period against SPY (`HELD 143D · +3.12pp vs SPY`).

Both are descriptive: they count filings and price history, and claim nothing
about what happens next.

**Why the holding rule is not a detail.** Evaluating these trades over a fixed
window — 30 days, 60 days — is not a neutral choice. Backtests that sell on a
60-day timer turn a set of individually winning congressional trades into a
portfolio that *loses* to the index; holding each position until the filer
actually sold instead flips the same trades to a slight edge. Same trades,
opposite conclusion, because the horizon was doing the work. So
[positions.ts](src/providers/positions.ts) never invents an exit: a position runs
to the matching disclosed sell, and one with no such sell is reported as still
open rather than quietly closed at a convenient date. Matching is FIFO, never
crosses actors or tickers, and a sell with no open buy in front of it is dropped
rather than given a fabricated opening date.

**What is deliberately not built:** a composite "wired into Washington" score
ranking companies by lobbying spend + federal contracts + congressional buying.
Published backtests of exactly that construction find it inverted — the
top-ranked basket underperformed both an equal-weight control and the
bottom-ranked basket it said to avoid. The reason is mundane: heavy lobbying
marks a mature incumbent (defence, energy, pharma), not an edge. The rationale is
recorded in [parse.ts](src/providers/congress/parse.ts) so it isn't added later
on the assumption that it works.

**Parties and faces.** The Clerk index names a filer only as `Khanna, Ro, CA17`
— no party, no portrait. Both come from
[`unitedstates/congress-legislators`](https://github.com/unitedstates/congress-legislators),
a public-domain roster with no key, joined to each filing by seat and surname in
[roster.ts](src/providers/congress/roster.ts), with official portraits from the
companion image repository.

That join is what makes **party subjects** work: alongside individual members
you can follow `All members`, `Republicans`, `Democrats` or `Independents`, and
the feed fills with whoever in that group filed — each card carrying that
member's own name, seat and face.

The matching is deliberately conservative. Seat plus surname is the primary key,
because a district changes hands and last year's filer may not hold it today
(Rich McCormick's GA-06 filings now point at Lucy McBath's seat). When the
surname disagrees, it falls back to a surname lookup, and accepts it only when
exactly one sitting member could be meant — two McCormicks in Congress are
separated by state, and anything still ambiguous resolves to nobody. An
unresolved filer keeps their filing and simply shows no face and no party,
rather than being guessed into a caucus.

### Insiders — `LIVE · NO KEY` ✅ richest free source

[InsiderProvider](src/providers/insider/InsiderProvider.ts) reads SEC EDGAR
Form 4 filings. Officers, directors and 10% owners must file within two business
days of trading their own company's stock, and every filing is free and
machine-readable. You get the insider's name, role, transaction code, share
count, price and dollar value.

Two details that matter:

- **One card per filing, not per line.** A single Form 4 often reports an option
  exercise plus the sale that funded it plus tax withholding. Three cards for
  one event is three times the noise, so the feed picks the line that carries
  signal — a discretionary `P`/`S` if present, else the largest by value.
- **SEC fair-access rules are honoured**: a descriptive User-Agent (required —
  requests without one get a 403) and a serialised request queue holding well
  under their 10 req/s cap. Change the contact address in that file to your own
  before shipping.

### Policy — `LIVE · NO KEY`

[PolicyProvider](src/providers/policy/PolicyProvider.ts) reads the Federal
Register API — executive orders, proclamations, determinations, memoranda. No
key, no rate limit published, real CORS headers. The friendliest source here.

Two kinds of subject: a document type (`type:executive_order`) or a **free-text
topic** (`term:semiconductor`). The topic watch is the powerful one — it
surfaces every presidential action mentioning an industry you care about.

### Stocks & price reaction — `LIVE · NO KEY`

[StocksProvider](src/providers/stocks/StocksProvider.ts) uses Yahoo Finance's
public endpoints. A ticker is a subject; a signal is a notable session — a daily
move past 1.5%, a genuine period high or low (with a materiality margin, so
sideways drift doesn't post fake "3-month high" cards), or a volume spike above
1.9× the 20-day average.

The same price data powers **price reaction**
([reaction.ts](src/providers/stocks/reaction.ts)): each signal carries what the
stock did between that filing and today. That join is what makes an insider sale
mean something. It's strictly a bonus — if the price lookup fails, the SEC data
still stands.

**Every reaction is measured against the market.** A raw "+13.58% since" is close
to meaningless alone, and printing it by itself is actively misleading — a
position can be up a lot and still be losing to simply holding the index. So each
reaction ships as two chips: the raw move and the excess over SPY across exactly
the same sessions.

```
NVDA +13.58% · 44D     +10.98pp vs SPY
```

The benchmark is clamped to the subject's own window rather than run to its own
latest close — comparing a 44-session stock move against a 47-session index move
would quietly credit or penalise three sessions the subject never saw. Verified
against live data: that NVDA window is SPY +2.60%, so the raw number alone
overstated the result by 2.6 points.

Daily series are cached for 30 minutes ([StocksProvider](src/providers/stocks/StocksProvider.ts)).
That is load-bearing, not an optimisation: every benchmarked signal needs the SPY
series too, so without it ten watched companies would fetch the same index history
ten times and reliably trip Yahoo's rate limit.

**Round trips are rare here, by design.** The same pairing runs on Form 4s, but
it seldom fires and that is correct. Measured over 120 consecutive filings from
three large issuers: JPM produced 18 discretionary transactions, every one a
sale and not a single open-market purchase; WFC produced none; KEY produced
three, all sales. Insiders acquire through grants and option exercises, then
sell. Letting grants open positions would make the badge appear constantly while
describing vesting schedules rather than decisions — so it doesn't.

**Company logos.** Every ticker — in Stocks and in Insiders — carries its logo,
built from the symbol alone by [logos.ts](src/providers/logos.ts). Financial
Modeling Prep serves these as plain images at a predictable path with no key and
no API call, which is why it's preferred over Finnhub's `/stock/profile2`: that
does carry a `logo` field, but spends a rate-limited request per symbol just to
learn a URL, and a feed holds dozens.

Logos are drawn on a light plate and fitted rather than cropped. Both matter:
they're artwork on a transparent background drawn for light surfaces — Intel's
is 97% near-black pixels, an empty square on this app's dark chrome — and a wide
wordmark filled to a square loses its ends. An unknown symbol 404s, which
[Avatar](src/ui/components/Avatar.tsx) already turns back into the ticker
monogram.

## Trades and top holdings

[src/lib/trades.ts](src/lib/trades.ts) turns signals into a table row per
disclosed transaction: trader (name, role, portrait where the source publishes
one), action, asset with its logo and type, amount, date, return, a timing
verdict, and a link to the filing.

The fields come from a structured `trade` on the signal, not from parsing the
rendered sentence — the trader's name and role would otherwise only exist inside
prose written for a card.

**The timing verdict** — `Sold high`, `Sold early`, `Bought low`, `Bought early`,
`Flat` — reads what the price did after the trade became public. A sale ahead of
a fall was well timed; one ahead of a rise left money on the table. Moves under
2% are called flat, because without a dead band a 0.2% drift gets reported as
shrewd timing. This is hindsight, not skill and certainly not prediction.

**Grants are not purchases.** Roughly half of real Form 4 filings are
compensation mechanics: across 22 live NVDA and AAPL filings, 11 were
open-market sales and 11 were grants, gifts or tax withholding. Direction alone
would render all 11 as BUY or SELL — and the holdings roll-up did read
"7 bought" when all seven were share grants. So each trade carries
`discretionary`, and the UI:

- shows BUY/SELL in colour only for real decisions, and names the rest
  (`GRANT`, `TAX`, `GIFT`) in neutral tone;
- withholds a timing verdict on them, since a vesting schedule has no timing to
  judge — distinguishing "no price data" from "not a decision", which are
  different facts;
- counts them as `awarded`, apart from `buys` and `sells`.

**Top holdings** ranks assets by how many *distinct* people disclosed trading
them, so one prolific filer cannot manufacture the look of consensus — the same
reasoning as `clusterBuyers`. It says plainly what it is: these are disclosed
transactions, not current positions. Periodic transaction reports record trades;
holdings live in the annual disclosure, which this app does not read. An asset
bought and later sold still appears.

## Timeline and digest

Two views over the same already-merged array in the feed store. Neither fetches
anything of its own.

**Timeline** ([app/(tabs)/timeline.tsx](app/(tabs)/timeline.tsx)) stacks each
source as its own lane on a shared axis. A vertical feed is good at "what is
newest" and bad at "when did these happen relative to each other" — whether
three members bought the same week an executive order landed. Filings that would
render on top of each other collapse into one numbered, tappable marker, since a
busy week otherwise reads as a single smear rather than nine events. All the
geometry lives in [src/lib/timeline.ts](src/lib/timeline.ts) — pure, no React,
unit-tested, because off-by-one positioning is invisible in a screenshot and
obvious in a test.

The same component sits above the list on subject detail, giving one member or
company their own axis — but only past four filings, since a track with two dots
on it reads as a broken chart rather than a sparse one.

**Digest** ([src/lib/digest.ts](src/lib/digest.ts)) groups the feed into days
with a header giving the count, the per-source breakdown, and the single most
notable fact — late filings first, otherwise a ticker several filings landed on.
Grouping runs *after* filtering, so a day whose only signals came from a hidden
source disappears with them instead of leaving an empty header, and the order
within a day is left exactly as the feed produced it.

Days are bucketed in **UTC**, matching every other date in the app. Bucketing by
local time would drop a filing dated 27 August into 26 August for every user west
of UTC — the filing would appear under the wrong date on most devices.

The headline never parses a formatted `accent.label` back into a number to rank
"biggest trade": that string is built for display, and reading it back would
break the first time the formatting changed.

## Feed behaviour

- **Merge** — [src/store/merge.ts](src/store/merge.ts) dedupes by id (incoming
  wins, so corrections survive), sorts newest-first with a deterministic id
  tiebreak, and caps retention at 500. The tiebreak matters more here than in a
  social feed: these sources are day-resolution, so a dozen filings routinely
  share a timestamp exactly, and an unstable sort would make the list jump.
- **Polling** — every 10 minutes while foregrounded, asking each subject only
  for signals newer than the newest already held. Deliberately slow: every
  source is disclosure-based and updates a few times a day at most.
- **Isolation** — sources are fanned out with `Promise.allSettled`, so one
  failing or rate-limiting can never blank the feed. Failures surface as a
  dismissible banner.
- **Filtering** — source chips filter already-loaded signals at render time, so
  toggling is instant and costs no quota. Muting a subject stops fetching it.
- **Timezones** — every date parser builds UTC explicitly rather than using
  `Date.parse` on bare `M/D/YYYY`, which reads in the device's local zone and
  would shift filings by up to a day. The feed sorts on these values.
- **Persistence** — the feed is stored to disk (250 signals) so a relaunch opens
  on the last signals the user saw rather than a spinner. Only `signals` and
  `lastUpdated` survive: a restored `loading: true` would spin for a fetch
  nobody started, and restored errors would blame yesterday's run. The
  full-screen spinner is now reserved for having genuinely nothing to show — a
  cold start with cached content refreshes behind the list instead of replacing
  it.

## App shell

- **Long press a card** for the secondary actions: open the filing, see
  everything from that subject, or share. Uses `ActionSheetIOS` on iOS and an
  alert on Android — each platform's own control rather than one bespoke sheet.
  A long press has no visual affordance, so it fires a haptic and is published
  as a named accessibility action for screen-reader users.
- **Share** hands the signal to the system share sheet. Every signal is a public
  filing with a canonical URL, which is exactly what is worth passing on.
  [share.ts](src/lib/share.ts) composes the message and is unit-tested; it names
  the actor only when the signal text doesn't already, or a share read
  "Ro Khanna (CA-17): Ro Khanna bought NVDA".
- **[Settings](app/settings.tsx)** exists to let the app account for itself:
  which sources are live, which are keyless, where each one's data comes from,
  how much is cached and when it last refreshed. A tracker that quietly degrades
  to sample data is worse than one that says so, and this is where that can be
  checked without reading the source.
- **Pause, not mute.** The watchlist control was a notification bell, which
  promised alerts the app does not send. It has always meant "stop fetching
  this subject", so it is now an eye, labelled Pause/Resume.
- **[Terms of Service](app/terms.tsx)** — the app names people, restates
  self-reported filings, and shows numbers people may trade on, so it needs to
  say plainly what it is and is not. The text lives in
  [src/legal/terms.ts](src/legal/terms.ts) as data, which keeps it out of the
  layout, versioned with the behaviour it describes, and assertable: the tests
  check that the terms still say the things the app depends on their saying
  (not advice, the 45-day filing window, the sample-data fallback, on-device
  storage). **It is a draft, not reviewed by a lawyer**, and two placeholders —
  contact address and governing jurisdiction — are deliberately left unfilled.
  A test fails while they are, and a `__DEV__`-only banner on the screen says
  the same thing where it will actually be seen.
- **Dynamic Type** — text scales with the system size. The one text-bearing
  container pinned to an exact height (the search field) now uses `minHeight`
  and padding; the one place scaling is deliberately off is the avatar monogram,
  which is sized as a fraction of a fixed box that cannot grow with it.

## Tests

`npm test` runs 474 unit tests on Node's native TypeScript stripping — no Jest,
no babel config, no watchman. The modules under test avoid framework and network
imports so they load without React Native's native modules.

Covered: merge dedupe/sort/tiebreak/cap and the actor-handle pruning contract;
House Clerk index parsing (tabs, CRLF, malformed rows, optional columns) and
member extraction; disclosure-range midpoints and STOCK Act late detection;
Form 4 XML parsing, transaction classification and the one-card-per-filing rule;
Federal Register scope parsing and normalization; price-reaction maths including
the cases where it must return nothing rather than mislead; XML entity decoding;
formatting; relative time.

Two bugs this suite and the browser caught during the build, both fixed:
a policy-provider actor handle that silently discarded every policy signal after
a successful fetch, and a stock classifier that called any new maximum a
"3-month high" even on 0.1% sideways drift.

## Known gaps

- **Congressional tickers need a key.** Keyless gives filings, not line items.
- **Web builds degrade.** Yahoo and the House Clerk send no CORS headers, so
  those two are blocked in a browser. iOS/Android have no CORS and are the real
  target; the Federal Register and SEC work everywhere.
- **Yahoo rate-limits.** Verified: it returns 429 under repeated automated
  access and even fingerprints the HTTP client. `syntheticSeries` keeps the UI
  working; Finnhub is the way out.
- No push notifications; polling is foreground-only.
- **The Terms of Service are an unreviewed draft.** They describe what the app
  actually does, but no lawyer has read them, the contact address and governing
  jurisdiction are still `TODO`, and there is no privacy policy document or
  first-run acceptance step — both of which the app stores will ask for.
- No account sync — the watchlist is local to the device.
- `colors.textFaint` in the theme is 3.3:1 against the background, below WCAG AA
  for normal-size text. New UI here uses `textMuted` (6.6:1) for anything
  informational and reserves `textFaint` for decorative separators.
