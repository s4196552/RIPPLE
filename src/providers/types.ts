/**
 * The contract every signal source implements.
 *
 * Ripple watches people and institutions whose actions move markets —
 * members of Congress filing trade disclosures, corporate insiders filing
 * Form 4s, the White House issuing executive orders — and merges everything
 * into one reverse-chronological feed.
 *
 * The feed, the add-flow and the watchlist only ever talk to this interface.
 * They never import a concrete provider, so adding a source is one new file
 * plus one line in `registry.ts`.
 */

/** Registered signal sources. Widen this union to add one. */
export type SourceId = 'congress' | 'insider' | 'policy' | 'stocks' | 'funds';

/** How live a provider's data currently is. Surfaced in the UI as a tag. */
export type ProviderMode =
  /** Talking to a paid/keyed API with credentials configured. */
  | 'live'
  /** Real public data, no credentials required. The default here. */
  | 'public'
  /** Degraded to placeholder data because the network path failed. */
  | 'mock';

/** Who or what a signal is attributed to. */
export interface Actor {
  /**
   * Stable, sigil-free identifier within the source. e.g. `nancy-pelosi-ca11`,
   * `AAPL`, `type:executive_order`.
   *
   * MUST equal the `handle` that was passed to `getSignals`. The feed prunes
   * any signal whose `actor.handle` doesn't match a watched subject, so a
   * decorative value here makes the whole source's signals vanish after a
   * successful fetch — silently, with no error. Put friendly text in
   * `displayName`.
   */
  handle: string;
  /** Human-readable name. e.g. `Nancy Pelosi`, `Apple Inc.`. */
  displayName: string;
  /** Secondary line: district, job title, exchange. */
  subtitle?: string | null;
  avatarUrl?: string | null;
}

/**
 * The single shape the unified feed sorts and renders. Every provider's
 * `normalizeSignal` must produce exactly this, so merging is a plain sort.
 */
export interface Signal {
  /**
   * Globally unique and stable across refreshes: `${source}:${nativeId}`.
   * Used for dedupe when polling overlaps a previous fetch.
   */
  id: string;
  source: SourceId;
  actor: Actor;
  /** One human sentence describing what happened. */
  text: string;
  /** Deep link to the primary document — the filing, the PDF, the order. */
  url: string;
  /** Epoch milliseconds, UTC. The sole sort key for the unified feed. */
  timestamp: number;

  /** Ticker this signal concerns, when it concerns one. Enables price reaction. */
  ticker?: string | null;
  /**
   * The headline number, rendered as a coloured chip: a trade's dollar value,
   * a price move, a disclosure amount range.
   */
  accent?: {
    label: string;
    tone: 'up' | 'down' | 'neutral';
  } | null;
  /** Short uppercase labels: `EXECUTIVE ORDER`, `LATE FILING`, `OPEN-MARKET BUY`. */
  badges?: string[];

  /**
   * Ids of earlier cards this one replaces — a congressional filing's "a
   * report exists" card, once its PDF has been read into trade cards with ids
   * of their own. The merge drops these, so the feed never shows both.
   */
  supersedes?: string[];

  /**
   * Structured facts about the transaction, when this signal is one.
   *
   * Carried separately from `text` because a table needs the fields, not a
   * sentence — and recovering them by parsing the rendered sentence would break
   * the first time the wording changed.
   */
  trade?: TradeDetail | null;

  /**
   * What the price did after this became public, when a ticker and price data
   * were both available.
   *
   * The numbers, not the badge. Providers already compute these to build the
   * chips; keeping the values means a table can rank and classify on them
   * instead of parsing `+3.12pp vs SPY` back out of a string.
   */
  reaction?: SignalReaction | null;

  /**
   * A fund's quarterly 13F, in fields: what it held and what changed since its
   * previous one. Only Funds signals carry it.
   */
  holdings?: FundFiling | null;
}

/** One 13F filing: a fund's US stock holdings at a quarter's end. */
export interface FundFiling {
  /** `13F-HR`, or `13F-NT` when another manager reported the holdings. */
  form: string;
  /** Quarter end, `YYYY-MM-DD`. */
  period: string;
  /** Total reported value in dollars. Null for a notice, which lists nothing. */
  totalValue: number | null;
  /** The previous filing's total, when there was one to compare. */
  priorValue: number | null;
  /** Every position in the filing, before the caps below. */
  positionCount: number;
  /** Largest first, capped so a fund with thousands of lines stays small. */
  positions: FundPosition[];
  /** Changes since the previous filing, biggest dollar move first, capped. */
  moves: FundMove[];
  /** True when the filing was too large to read in full on a phone. */
  truncated: boolean;
}

export interface FundPosition {
  /** Issuer as filed: `AMAZON COM INC`. */
  issuer: string;
  /** Matched from the issuer's name when the match is unambiguous. */
  ticker: string | null;
  /** Share class as filed: `COM`, `CAP STK CL C`. */
  classTitle: string;
  cusip: string;
  /** Options are reported separately from the stock itself. */
  putCall: 'PUT' | 'CALL' | null;
  /** Dollars, at quarter end. */
  value: number;
  shares: number;
  /** Share of the filing's total value, 0..1. */
  weight: number;
}

export type FundMoveKind = 'new' | 'added' | 'trimmed' | 'exited' | 'unchanged';

/**
 * One position's change between two filings.
 *
 * `kind` follows the shares, not the dollars: a stake trimmed into a rising
 * price is "trimmed" though its value went up. `value`, `shares` and `weight`
 * are the after side, zero for an exit.
 */
export interface FundMove extends FundPosition {
  kind: FundMoveKind;
  valueBefore: number;
  sharesBefore: number;
  /** Null for a new position, which has nothing to compare against. */
  sharesChangePct: number | null;
  /**
   * What the stock did from the day the filing went public to the latest
   * close, and against the S&P 500 over the same sessions. Only on the newest
   * filing's biggest moves, and only where the position has a ticker.
   */
  sinceFiling?: { changePct: number; excessPct: number | null; sessions: number } | null;
}

/** The transaction behind a signal, in fields rather than prose. */
export interface TradeDetail {
  /** The person who traded — the insider or the member, never the company. */
  traderName: string;
  /** Their role: `CEO`, `Director`, `CA-11 · Democrat`. */
  traderTitle?: string | null;
  /** Portrait of the trader, when the source publishes one. */
  traderPhotoUrl?: string | null;
  /**
   * Direction of the share movement. Note this is *not* the same as a decision
   * to buy — see `discretionary`.
   */
  action: 'buy' | 'sell';
  /**
   * Whether this was a decision to trade rather than compensation mechanics.
   *
   * A share grant, an option exercise and the tax withholding that follows are
   * all directional movements nobody chose. Showing them as BUY next to a real
   * open-market purchase reads as seven insiders buying the stock, which is
   * simply untrue — so the UI labels them by what they are, and timing verdicts
   * are withheld, since a vesting schedule has no timing to judge.
   */
  discretionary: boolean;
  /** What the filing calls it: `OPEN-MARKET SELL`, `GRANT / AWARD`. */
  kindLabel: string;
  /** Readable asset name: `NVIDIA Corporation`. Falls back to the ticker. */
  assetName?: string | null;
  /** Disclosed size, pre-formatted: `$1,001 - $15,000`, `500K shares`. */
  amountLabel?: string | null;
  /**
   * When the trade itself happened, epoch ms UTC, where the source says.
   *
   * The signal's `timestamp` is the disclosure — the news event — so the gap
   * between the two is how long the public waited, which the member page and
   * the filing view both report.
   */
  tradedAt?: number | null;
}

export interface SignalReaction {
  /** Move from the signal date to the latest close, percent. */
  changePct: number;
  /** Benchmark's move over the identical window, when one was available. */
  benchmarkPct?: number | null;
  /** changePct - benchmarkPct, in percentage points. */
  excessPct?: number | null;
  /** Trading sessions the measurement spans. */
  sessions: number;
  benchmarkSymbol?: string | null;
}

/** Where a subject posts in public. `website` is their own site. */
export type SocialPlatform =
  | 'x'
  | 'truth'
  | 'instagram'
  | 'facebook'
  | 'youtube'
  | 'threads'
  | 'bluesky'
  | 'mastodon'
  | 'tiktok'
  | 'website';

/** One public account, ready to open. */
export interface SocialLink {
  platform: SocialPlatform;
  /** As it should read on screen: `@RepAmata`, `cantwell.senate.gov`. */
  handle: string;
  url: string;
  /**
   * Whose account this is, when it is not the subject's own — the White House
   * subject links the President's account as well as its own.
   */
  owner?: string | null;
}

/**
 * Who a subject is beyond their filings: a few facts and where they post.
 *
 * Separate from `SubjectResult` because it is fetched on the subject's own page
 * only, and may cost a request the add-flow and the feed have no use for.
 */
export interface SubjectProfile {
  /** Short lines under the heading: `Senate · WA`, `In Congress since 1993`. */
  facts: string[];
  /** Official site first, then social accounts. */
  links: SocialLink[];
  /** Where the links come from, shown under them for honesty. */
  provenance: string;
}

/** One row in the add-subject autocomplete list. */
export interface SubjectResult {
  source: SourceId;
  handle: string;
  displayName: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
}

export interface GetSignalsOptions {
  /** Soft cap on returned signals. Providers may return fewer. */
  limit?: number;
  /** Only return signals strictly newer than this epoch-ms. Enables cheap polling. */
  since?: number;
  signal?: AbortSignal;
}

export interface SourceDescriptor {
  id: SourceId;
  /** Display name in the picker and filter chips. */
  label: string;
  /** Character shown before a handle: `$` for tickers, empty for people. */
  sigil: string;
  /** Hex accent used for the card badge, chip and picker tile. */
  color: string;
  /**
   * Icon for the picker tile, feed chip and card badge: a bare Ionicons name,
   * or another set's glyph prefixed with its family — `'fa6:landmark-dome'`.
   * See `parseGlyph`.
   */
  icon: string;
  /** One-line explanation shown under the tile in the source picker. */
  blurb: string;
  /** What the user is choosing when they add one, e.g. "a member of Congress". */
  subjectNoun: string;
  /** Where the data actually comes from. Shown in the picker, for honesty. */
  provenance: string;
}

export interface Provider<Raw = unknown> extends SourceDescriptor {
  /**
   * Typeahead for the add-subject flow. Called on every debounced keystroke,
   * so implementations must be cheap and must honour `signal`.
   */
  searchSubjects(query: string, signal?: AbortSignal): Promise<SubjectResult[]>;

  /**
   * Latest signals for one watched subject, newest first.
   *
   * Every returned signal must carry `actor.handle === handle` — see the note
   * on `Actor.handle`.
   */
  getSignals(handle: string, options?: GetSignalsOptions): Promise<Signal[]>;

  /** Raw payload -> the shared shape. Pure and synchronous; unit-tested directly. */
  normalizeSignal(raw: Raw, actor: Actor): Signal;

  /**
   * The individual subjects inside a group subject, most recently active first.
   *
   * Optional, and only meaningful for handles that stand for several people —
   * a party, say. Resolves `null` for a handle that is not a group, so callers
   * can tell "not a group" from "a group with nobody in it yet".
   */
  groupMembers?(handle: string, signal?: AbortSignal): Promise<SubjectResult[] | null>;

  /**
   * Facts and public accounts for one subject, for its profile card.
   *
   * Optional. Resolves `null` when the source knows nothing more about this
   * handle — a group, or a company with no curated accounts — so the card is
   * simply left out. Must not throw for a network failure: a missing profile
   * costs the card, never the page.
   */
  profile?(handle: string, signal?: AbortSignal): Promise<SubjectProfile | null>;

  /** Whether this provider currently has what it needs to return real data. */
  mode(): ProviderMode;

  /**
   * The avatar for a watched subject, derived from its handle alone.
   *
   * A watchlist entry stores the `SubjectResult` captured when it was added, so
   * its avatar is frozen at that moment: subjects added before a provider
   * learned to supply images keep showing a monogram forever, even while their
   * feed cards — built fresh on every fetch — show the real thing. Anything a
   * provider can derive from the handle synchronously belongs here instead of
   * in that snapshot, so it is always current and needs no migration.
   *
   * Optional, and must stay cheap and synchronous: it is called per row while
   * rendering. Providers that need a network lookup (a congressional portrait
   * needs the roster) leave it out and fall back to the stored value.
   */
  subjectAvatarUrl?(handle: string): string | null;
}
