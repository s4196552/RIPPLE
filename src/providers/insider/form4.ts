import { tag, tagAll, tagNumber, tagValue } from '../../lib/xml.ts';
import { compact, money } from '../../lib/format.ts';
import type { Actor, Signal } from '@/providers/types';

/**
 * Reading SEC Form 4 ownership documents.
 *
 * Only `import type` plus our own pure helpers, so this is unit-tested against
 * captured filings with no network. Form 4 is the single richest free market
 * signal available: every officer, director and 10% owner must file within two
 * business days of trading their own company's stock.
 */

/**
 * Transaction codes, from the Form 345 spec. The distinction that matters is
 * `P`/`S` — a real decision to buy or sell on the open market — versus the
 * routine compensation mechanics (`A`, `M`, `F`) that carry no signal at all
 * and would otherwise flood the feed.
 */
export const TRANSACTION_CODES: Record<string, { label: string; discretionary: boolean }> = {
  P: { label: 'OPEN-MARKET BUY', discretionary: true },
  S: { label: 'OPEN-MARKET SELL', discretionary: true },
  A: { label: 'GRANT / AWARD', discretionary: false },
  M: { label: 'OPTION EXERCISE', discretionary: false },
  F: { label: 'TAX WITHHOLDING', discretionary: false },
  G: { label: 'GIFT', discretionary: false },
  D: { label: 'DISPOSITION TO ISSUER', discretionary: false },
  C: { label: 'CONVERSION', discretionary: false },
  X: { label: 'OPTION EXERCISE', discretionary: false },
};

export interface Form4Transaction {
  code: string;
  date: string;
  shares: number;
  pricePerShare: number;
  value: number;
  sharesAfter: number | null;
  acquired: boolean;
}

export interface Form4 {
  issuerName: string;
  ticker: string;
  ownerName: string;
  ownerTitle: string | null;
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  periodOfReport: string | null;
  transactions: Form4Transaction[];
}

function isTrue(value: string | null): boolean {
  return /^(1|true)$/i.test(value ?? '');
}

/** Parse an ownership document. Returns null when the XML isn't a Form 4. */
export function parseForm4(xml: string): Form4 | null {
  if (!xml.includes('ownershipDocument')) return null;

  const issuer = tag('issuer', xml) ?? '';
  const relationship = tag('reportingOwnerRelationship', xml) ?? '';

  const transactions: Form4Transaction[] = [];
  for (const block of tagAll('nonDerivativeTransaction', xml)) {
    const code = tagValue('transactionCode', block);
    if (!code) continue;

    const shares = tagNumber('transactionShares', block) ?? 0;
    const pricePerShare = tagNumber('transactionPricePerShare', block) ?? 0;
    // A/D: acquired or disposed. Trust this over inferring from the code, since
    // the same code can appear in either direction.
    const acquiredDisposed = tagValue('transactionAcquiredDisposedCode', block);

    transactions.push({
      code,
      date: tagValue('transactionDate', block) ?? '',
      shares,
      pricePerShare,
      value: Math.round(shares * pricePerShare),
      sharesAfter: tagNumber('sharesOwnedFollowingTransaction', block),
      acquired: acquiredDisposed === 'A',
    });
  }

  return {
    issuerName: tag('issuerName', issuer) ?? 'Unknown issuer',
    ticker: (tag('issuerTradingSymbol', issuer) ?? '').toUpperCase(),
    ownerName: tag('rptOwnerName', xml) ?? 'Unknown',
    ownerTitle: tag('officerTitle', relationship),
    isDirector: isTrue(tag('isDirector', relationship)),
    isOfficer: isTrue(tag('isOfficer', relationship)),
    isTenPercentOwner: isTrue(tag('isTenPercentOwner', relationship)),
    periodOfReport: tag('periodOfReport', xml),
    transactions,
  };
}

/** `CEO`, `Director`, `10% owner` — whichever is most specific. */
export function describeRole(f: Form4): string {
  if (f.ownerTitle) return f.ownerTitle;
  if (f.isOfficer) return 'Officer';
  if (f.isDirector) return 'Director';
  if (f.isTenPercentOwner) return '10% owner';
  return 'Insider';
}

/**
 * `YYYY-MM-DD` -> epoch ms at UTC midnight.
 *
 * Built explicitly rather than via `Date.parse`, so the value doesn't shift
 * with the device's timezone. The feed sorts on this.
 */
export function parseFilingDay(value: string | null | undefined): number | null {
  const m = (value ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const ts = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(ts) ? ts : null;
}

/**
 * Collapse a filing into its most meaningful transaction.
 *
 * A single Form 4 often reports several lines — an option exercise plus the
 * sale that funded it plus the tax withholding. Showing all three as separate
 * cards triples the noise for one event, so the feed shows one card per filing
 * and picks the line that actually carries signal: a discretionary buy or sell
 * if there is one, otherwise the largest by dollar value.
 */
export function principalTransaction(f: Form4): Form4Transaction | null {
  if (f.transactions.length === 0) return null;

  const discretionary = f.transactions.filter((t) => TRANSACTION_CODES[t.code]?.discretionary);
  const pool = discretionary.length > 0 ? discretionary : f.transactions;

  return pool.reduce((best, t) => (t.value > best.value ? t : best), pool[0]!);
}

/** A parsed filing -> a feed signal. `accessionNumber` makes the id unique. */
export function normalizeForm4(
  f: Form4,
  accessionNumber: string,
  actor: Actor,
  filedAt: number,
): Signal | null {
  const tx = principalTransaction(f);
  if (!tx) return null;

  const meta = TRANSACTION_CODES[tx.code];
  const role = describeRole(f);
  const verb = meta?.discretionary
    ? tx.acquired
      ? 'bought'
      : 'sold'
    : tx.acquired
      ? 'acquired'
      : 'disposed of';

  const priceText = tx.pricePerShare > 0 ? ` at $${tx.pricePerShare.toFixed(2)}` : '';
  const valueText = tx.value > 0 ? ` (${money(tx.value)})` : '';

  const badges = [meta?.label ?? tx.code];
  if (f.transactions.length > 1) badges.push(`+${f.transactions.length - 1} MORE`);

  return {
    id: `insider:${accessionNumber}`,
    source: 'insider',
    actor,
    text:
      `${f.ownerName} (${role}) ${verb} ${compact(tx.shares)} shares of ${f.ticker || f.issuerName}` +
      `${priceText}${valueText}.`,
    url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(f.ticker)}&type=4`,
    timestamp: parseFilingDay(tx.date) ?? filedAt,
    ticker: f.ticker || null,
    accent:
      tx.value > 0
        ? { label: `${tx.acquired ? '+' : '-'}${money(tx.value)}`, tone: tx.acquired ? 'up' : 'down' }
        : null,
    badges,
    trade: {
      // The trader is the officer, not the issuer — `actor` is the company,
      // because that is what the user watches.
      traderName: f.ownerName,
      traderTitle: role,
      traderPhotoUrl: null, // the SEC publishes no portraits
      action: tx.acquired ? 'buy' : 'sell',
      // A grant, an exercise and a tax withholding are movements nobody chose.
      discretionary: meta?.discretionary ?? false,
      kindLabel: meta?.label ?? tx.code,
      assetName: f.issuerName,
      amountLabel:
        tx.value > 0 ? money(tx.value) : `${compact(tx.shares)} share${tx.shares === 1 ? '' : 's'}`,
    },
  };
}
