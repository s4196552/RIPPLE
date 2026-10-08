/**
 * The on-disk shape of `data/house-trades.json`, shared by the scraper that
 * writes it (`scripts/scrape-house-ptrs.ts`) and the app that reads it.
 *
 * The app bundles this file, so it holds only what the app shows: trades in
 * listed securities, as short tuples, with the amount bands and company names
 * stored once and referred to by index and ticker. Everything else a filing
 * lists — Treasuries, municipal bonds, private funds — is read and dropped.
 */
// Relative `.ts` import, so both Node (the scraper, the tests) and Metro load it.
import type { PtrTransaction } from './ptr.ts';

export const SCRAPED_FORMAT_VERSION = 2;

export type ScrapedSide = 'purchase' | 'sale' | 'partial-sale';

/** One listed-security trade, as the app uses it. */
export interface ScrapedTrade {
  ticker: string;
  side: ScrapedSide;
  /** Trade date, ISO `YYYY-MM-DD`. */
  date: string;
  /** The disclosed band, as filed: `$50,001 - $100,000`. */
  amount: string;
  /** `SP` spouse, `JT` joint, `DC` dependent child; null for the member's own account. */
  owner: string | null;
  /** `ST` stock, `OP` option, `ET` exchange-traded product… */
  assetType: string;
  /** The company as the filer named it, share-class boilerplate trimmed. */
  name: string | null;
}

/** `[ticker, side, date, band index, owner, assetType]` */
export type EncodedTrade = [string, 'P' | 'S' | 'SP', string, number, string | null, string];

export interface ScrapedFile {
  v: number;
  generatedAt: string;
  years: number[];
  /** Distinct amount bands; each trade stores an index into this. */
  bands: string[];
  /** Ticker -> company name, as first filed. */
  names: Record<string, string>;
  /** Clerk DocID -> that filing's listed-security trades. */
  filings: Record<string, EncodedTrade[]>;
  /** Read, but listed no trades in listed securities (only bonds, funds…). */
  unlisted: string[];
  /** Scans of paper forms: no text to read. */
  scanned: string[];
  /** Failed to download or parse on the last run; retried next run. */
  unreadable: string[];
}

/**
 * Asset-type codes whose parenthesised symbol is a listed, priceable ticker:
 * stocks, exchange-traded products, options, restricted stock, and the "other"
 * and asset-backed buckets filers use for ETFs and funds.
 *
 * Left out: private funds (`HN`), crypto (`CT`), private companies (`OI`) and
 * the like, where the parentheses hold a fund family or a nickname — "Trimer
 * Capital Partners (GLAS)" is not GLAS stock, and pricing it as such would put
 * someone else's chart on the card.
 */
const LISTED = new Set(['ST', 'ET', 'OP', 'RS', 'AB', 'OT']);

/**
 * The trades in a parsed filing that the app can show: a listed ticker, and a
 * buy or a sell. Exchanges are left out — swapping one holding for another is
 * neither, and calling it either would misstate it.
 */
export function listedTrades(transactions: readonly PtrTransaction[]): ScrapedTrade[] {
  return transactions.flatMap((t): ScrapedTrade[] => {
    if (!t.ticker || !t.assetType || !LISTED.has(t.assetType) || t.type === 'exchange') return [];
    return [
      {
        ticker: t.ticker,
        side: t.type,
        date: t.date,
        amount: t.amount,
        owner: t.owner,
        assetType: t.assetType,
        name: assetName(t.asset),
      },
    ];
  });
}

/** `Apple Inc. - Common Stock (AAPL) [ST]` -> `Apple Inc.` */
export function assetName(asset: string): string | null {
  const name = asset
    .replace(/\[[A-Z]{2}\]\s*$/, '')
    .replace(/\([A-Z]{1,5}(?:[.\-][A-Z])?\)\s*$/, '')
    .replace(/\s*-?\s*(Class [A-Z] )?(Common|Ordinary) (Stock|Shares)\s*$/i, '')
    .replace(/\s*-\s*$/, '')
    .trim();
  return name || null;
}

const SIDE_TO_CODE: Record<ScrapedSide, EncodedTrade[1]> = { purchase: 'P', sale: 'S', 'partial-sale': 'SP' };
const CODE_TO_SIDE: Record<EncodedTrade[1], ScrapedSide> = { P: 'purchase', S: 'sale', SP: 'partial-sale' };

/** Builds the file from decoded filings. Bands and names are collected here. */
export function encodeFile(
  filings: Record<string, ScrapedTrade[]>,
  meta: Pick<ScrapedFile, 'generatedAt' | 'years' | 'unlisted' | 'scanned' | 'unreadable'>,
): ScrapedFile {
  const bands: string[] = [];
  const bandIndex = new Map<string, number>();
  const names: Record<string, string> = {};
  const encoded: Record<string, EncodedTrade[]> = {};

  for (const docId of Object.keys(filings).sort()) {
    encoded[docId] = filings[docId]!.map((t) => {
      let band = bandIndex.get(t.amount);
      if (band === undefined) {
        band = bands.push(t.amount) - 1;
        bandIndex.set(t.amount, band);
      }
      if (t.name && names[t.ticker] === undefined) names[t.ticker] = t.name;
      return [t.ticker, SIDE_TO_CODE[t.side], t.date, band, t.owner, t.assetType];
    });
  }

  return { v: SCRAPED_FORMAT_VERSION, ...meta, bands, names, filings: encoded };
}

/** One filing's trades, decoded. Empty for a filing the file does not hold. */
export function decodeFiling(file: ScrapedFile, docId: string): ScrapedTrade[] {
  return (file.filings[docId] ?? []).map(([ticker, code, date, band, owner, assetType]) => ({
    ticker,
    side: CODE_TO_SIDE[code],
    date,
    amount: file.bands[band] ?? '',
    owner,
    assetType,
    name: file.names[ticker] ?? null,
  }));
}
