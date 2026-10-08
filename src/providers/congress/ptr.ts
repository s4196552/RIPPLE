/**
 * Reading the transactions out of a House Periodic Transaction Report PDF.
 *
 * The Clerk's index says *who filed and when*; the trades themselves exist only
 * in each filing's PDF. About nine in ten are filed electronically, and those
 * PDFs carry real text laid out as a table:
 *
 *   ID  Owner  Asset                            Transaction  Date        Notification  Amount
 *                                               Type                     Date
 *              Fulton Financial Corporation -   S            04/23/2026  04/23/2026    $50,001 -
 *              Common Stock (FULT) [ST]                                                $100,000
 *              Filing Status: New
 *
 * The rest are scans of paper forms with no text at all; `parsePtr` reports
 * those as `scanned` rather than guessing.
 *
 * Works on positioned text items (as pdf.js returns them), not on a flattened
 * string, because the asset name and the amount both wrap onto a second line
 * and only the column position says which wrapped text belongs to which.
 *
 * Pure — no PDF library, no network — so it is unit-tested directly. The PDF
 * reading lives in `scripts/scrape-house-ptrs.ts`.
 */

/** One run of text on a page, positioned in PDF points (y grows upward). */
export interface PtrTextItem {
  str: string;
  x: number;
  y: number;
  page: number;
}

export type PtrTransactionType = 'purchase' | 'sale' | 'partial-sale' | 'exchange';

export interface PtrTransaction {
  /** `SP` spouse, `JT` joint, `DC` dependent child; null for the member's own account. */
  owner: string | null;
  /** The asset as filed, wrapped lines joined: `Fulton Financial Corporation - Common Stock (FULT) [ST]`. */
  asset: string;
  /** The ticker in parentheses, when the filer gave one. */
  ticker: string | null;
  /** The bracketed asset-type code: `ST` stock, `OP` option, `GS` government security… */
  assetType: string | null;
  type: PtrTransactionType;
  /** Trade date, ISO `YYYY-MM-DD`. */
  date: string;
  /** Date the member was notified of the trade, ISO; null when not filled in. */
  notified: string | null;
  /** The disclosed band, as filed: `$50,001 - $100,000`. */
  amount: string;
}

export interface ParsedPtr {
  /** No readable text at all: a scanned paper filing. */
  scanned: boolean;
  /** The filer's name as printed on the form, e.g. `Hon. Lloyd K. Smucker`. */
  name: string | null;
  transactions: PtrTransaction[];
}

type Column = 'owner' | 'asset' | 'type' | 'date' | 'notified' | 'amount' | 'cap';

/** Header words that open each column. The header repeats on every page. */
const HEADER: Record<string, Column> = {
  Owner: 'owner',
  Asset: 'asset',
  Transaction: 'type',
  Date: 'date',
  Notification: 'notified',
  Amount: 'amount',
  'Cap.': 'cap',
};

/** How far left of its header a cell may start and still belong to it. */
const COLUMN_SLACK = 6;

/** Rows closer than this many points are the same line. */
const ROW_TOLERANCE = 2.5;

const TYPE_CODES: Record<string, PtrTransactionType> = {
  P: 'purchase',
  S: 'sale',
  'S (partial)': 'partial-sale',
  E: 'exchange',
};

const DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * Field labels on these forms ("Filing Status", "Subholding Of", "Description")
 * are set in a font whose text layer comes out as a capital followed by NULs.
 * A row like that is never part of a transaction's asset or amount.
 */
function isLabelRow(text: string): boolean {
  return text.includes('\u0000');
}

function clean(s: string): string {
  return s.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
}

function isoDate(us: string): string | null {
  const m = us.trim().match(DATE);
  if (!m) return null;
  const [, mo, day, yr] = m;
  return `${yr}-${mo}-${day}`;
}

interface Row {
  page: number;
  y: number;
  items: PtrTextItem[];
}

/** Items -> rows, top to bottom, page by page. */
function toRows(items: readonly PtrTextItem[]): Row[] {
  const sorted = [...items]
    .filter((it) => it.str.trim() !== '')
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);

  const rows: Row[] = [];
  for (const it of sorted) {
    const row = rows[rows.length - 1];
    if (row && row.page === it.page && Math.abs(row.y - it.y) <= ROW_TOLERANCE) {
      row.items.push(it);
    } else {
      rows.push({ page: it.page, y: it.y, items: [it] });
    }
  }
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

/** Column starts from a header row, or null if this row is not the header. */
function headerColumns(row: Row): { column: Column; x: number }[] | null {
  const found = row.items
    .filter((it) => HEADER[it.str.trim()] !== undefined)
    .map((it) => ({ column: HEADER[it.str.trim()]!, x: it.x }));
  const names = new Set(found.map((f) => f.column));
  // "Asset" and "Amount" together only ever appear in the table header.
  if (!names.has('asset') || !names.has('amount')) return null;
  // "Date" appears once on this row, under its own header; keep the first of each.
  const seen = new Set<Column>();
  return found
    .filter((f) => (seen.has(f.column) ? false : (seen.add(f.column), true)))
    .sort((a, b) => a.x - b.x);
}

function cells(row: Row, columns: { column: Column; x: number }[]): Partial<Record<Column, string>> {
  const out: Partial<Record<Column, string>> = {};
  for (const it of row.items) {
    // The rightmost column whose header starts at or left of this item.
    let col: Column | null = null;
    for (const c of columns) if (it.x + COLUMN_SLACK >= c.x) col = c.column;
    if (!col) continue;
    out[col] = out[col] ? `${out[col]} ${it.str}` : it.str;
  }
  return out;
}

/** `Common Stock (FULT) [ST]` -> ticker FULT, type ST. */
export function tickerOf(asset: string): { ticker: string | null; assetType: string | null } {
  const type = asset.match(/\[([A-Z]{2})\]\s*$/);
  // The ticker is the last parenthesised symbol, so a name like
  // "Berkshire Hathaway (Class B) (BRK.B)" still yields it. Letters only, with
  // an optional class suffix: a Treasury's CUSIP ("91282CGH8") sits in the same
  // parentheses and is not a ticker.
  const tickers = [...asset.matchAll(/\(([A-Z]{1,5}(?:[.\-][A-Z])?)\)/g)].map((m) => m[1]!);
  return { ticker: tickers[tickers.length - 1] ?? null, assetType: type?.[1] ?? null };
}

/**
 * Does the amount read as complete? A band is "$15,001 - $50,000"; the open-
 * ended top bands read "Over $50,000,000" or "Spouse/DC Over $1,000,000".
 */
function amountComplete(amount: string): boolean {
  return /\$[\d,]+\s*-\s*\$[\d,]+/.test(amount) || /over\s+\$[\d,]+/i.test(amount);
}

export function parsePtr(items: readonly PtrTextItem[]): ParsedPtr {
  const text = items.map((it) => it.str).join('');
  if (clean(text) === '') return { scanned: true, name: null, transactions: [] };

  const rows = toRows(items);
  let name: string | null = null;
  let columns: { column: Column; x: number }[] | null = null;
  const transactions: PtrTransaction[] = [];
  let open: { tx: PtrTransaction; amountDone: boolean; assetDone: boolean } | null = null;

  const close = () => {
    if (!open) return;
    open.tx.asset = clean(open.tx.asset);
    open.tx.amount = clean(open.tx.amount);
    Object.assign(open.tx, tickerOf(open.tx.asset));
    transactions.push(open.tx);
    open = null;
  };

  for (const row of rows) {
    const rowText = row.items.map((it) => it.str).join(' ');

    if (name === null && row.items[0]?.str.trim() === 'Name:') {
      name = clean(row.items.slice(1).map((it) => it.str).join(' ')) || null;
      continue;
    }

    // The header repeats at the top of every page. It does not end the open
    // transaction: a trade near the foot of one page often wraps its ticker
    // and the rest of its amount onto the next, below the repeated header.
    const header = headerColumns(row);
    if (header) {
      columns = header;
      continue;
    }
    if (!columns) continue;

    // The footnote under the table, and everything after it, is not a trade.
    if (/^\*\s*For the complete list/.test(rowText.trim())) {
      close();
      continue;
    }

    const c = cells(row, columns);
    const type = TYPE_CODES[clean(c.type ?? '')];
    const date = isoDate(clean(c.date ?? ''));

    if (type && date) {
      close();
      open = {
        tx: {
          owner: clean(c.owner ?? '') || null,
          asset: c.asset ?? '',
          ticker: null,
          assetType: null,
          type,
          date,
          notified: isoDate(clean(c.notified ?? '')),
          amount: c.amount ?? '',
        },
        amountDone: false,
        assetDone: false,
      };
      open.amountDone = amountComplete(open.tx.amount);
      continue;
    }

    if (!open) continue;
    const current: { tx: PtrTransaction; amountDone: boolean; assetDone: boolean } = open;

    // A label row (Filing Status, Subholding Of…) ends the asset's wrapped
    // lines; the amount has always finished wrapping by then too.
    if (isLabelRow(rowText)) {
      current.assetDone = true;
      current.amountDone = true;
      continue;
    }

    if (!current.assetDone && c.asset) current.tx.asset += ` ${c.asset}`;
    if (!current.amountDone && c.amount) {
      current.tx.amount += ` ${c.amount}`;
      current.amountDone = amountComplete(current.tx.amount);
    }
  }
  close();

  return { scanned: false, name, transactions };
}
