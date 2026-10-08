/**
 * Trades read from the Clerk's own PDFs, turned into the same `ParsedTrade`
 * the keyed aggregators produce — so everything downstream (trade cards, the
 * cluster count, the price reaction, round trips) treats them identically.
 *
 * The data comes from `scripts/scrape-house-ptrs.ts`, which reads each filing's
 * PDF and writes `data/house-trades.json`. Pure: no network, no bundler.
 */
// Relative `.ts` imports, so `node --test` can load this without the bundler.
import { personName } from '../../lib/format.ts';
import { filingUrl, parseFilingDate, rangeMidpoint, type FilingRow, type ParsedTrade } from './parse.ts';
import { decodeFiling, type ScrapedFile } from './scraped-format.ts';

/** One filing's listed-security trades, as `ParsedTrade`s. */
export function scrapedTrades(row: FilingRow, file: ScrapedFile): ParsedTrade[] {
  const disclosed = parseFilingDate(row.filingDate);
  const disclosureDate = disclosed === null ? null : new Date(disclosed).toISOString().slice(0, 10);

  return decodeFiling(file, row.docId).map((t, i) => ({
    representative: personName(row.first, row.last),
    district: row.stateDst || null,
    ticker: t.ticker,
    transaction: t.side === 'purchase' ? 'Purchase' : t.side === 'partial-sale' ? 'Sale (partial)' : 'Sale',
    range: t.amount || null,
    amount: rangeMidpoint(t.amount),
    transactionDate: t.date,
    disclosureDate,
    sourceUrl: filingUrl(row),
    key: `${row.docId}-${i}`,
    filingId: row.docId,
    option: t.assetType === 'OP',
    owner: t.owner,
    // An option on a stock is not the stock: say so wherever the name shows.
    assetName: t.assetType === 'OP' ? `${t.name ?? t.ticker} (options)` : t.name,
  }));
}

/** Every scraped trade across the dataset, for the cluster count and round trips. */
export function allScrapedTrades(file: ScrapedFile, rows: readonly FilingRow[]): ParsedTrade[] {
  return rows.flatMap((row) => (file.filings[row.docId] ? scrapedTrades(row, file) : []));
}
