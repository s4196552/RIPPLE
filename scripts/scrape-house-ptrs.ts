/**
 * Scrape House Periodic Transaction Reports into trade-level data the app can show.
 *
 *   npm run scrape:house                  # current + previous year, new filings only
 *   npm run scrape:house -- --full        # re-read every filing, ignoring what's saved
 *   npm run scrape:house -- --limit 20    # stop after 20 new PDFs (a quick check)
 *
 * Writes `src/providers/congress/data/house-trades.json`, which the app bundles
 * and `CongressProvider` reads to turn "a filing exists" into "sold FULT,
 * $50,001 – $100,000". Incremental: a filing already in the file is never
 * fetched again, so a daily run downloads only that day's new reports.
 *
 * Everything here is public record: the Clerk's annual index and the PDFs it
 * links to. Requests are paced and identify themselves, as the Clerk asks.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  PERIODIC_TRANSACTION_REPORT,
  filingUrl,
  parseFilingIndex,
  type FilingRow,
} from '../src/providers/congress/parse.ts';
import { parsePtr, type PtrTextItem } from '../src/providers/congress/ptr.ts';
import {
  SCRAPED_FORMAT_VERSION,
  decodeFiling,
  encodeFile,
  listedTrades,
  type ScrapedFile,
  type ScrapedTrade,
} from '../src/providers/congress/scraped-format.ts';

const OUT = 'src/providers/congress/data/house-trades.json';
const INDEX_BASE = 'https://disclosures-clerk.house.gov/public_disc/financial-pdfs';
const USER_AGENT = 'Ripple/1.0 (demo; public-record research)';
const CONCURRENCY = 4;
const PAUSE_MS = 150;

const args = process.argv.slice(2);
const FULL = args.includes('--full');
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || Infinity;

const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url: string, tries = 3): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
      if (res.ok) return res;
      // A 404 is a real answer (the PDF is not posted yet), not a blip to retry.
      if (res.status === 404 || attempt >= tries) throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      if (attempt >= tries) throw err;
    }
    await sleep(1000 * attempt);
  }
}

async function loadIndex(year: number): Promise<FilingRow[]> {
  const res = await fetchWithRetry(`${INDEX_BASE}/${year}FD.txt`);
  return parseFilingIndex(await res.text());
}

/** One PDF -> positioned text items, every page. */
async function readPdf(bytes: Uint8Array): Promise<PtrTextItem[]> {
  const doc = await getDocument({ data: bytes, verbosity: 0, isEvalSupported: false }).promise;
  const items: PtrTextItem[] = [];
  try {
    for (let page = 1; page <= doc.numPages; page++) {
      const content = await (await doc.getPage(page)).getTextContent();
      for (const it of content.items) {
        if (!('str' in it)) continue;
        items.push({ str: it.str, x: it.transform[4], y: it.transform[5], page });
      }
    }
  } finally {
    await doc.destroy();
  }
  return items;
}

function loadExisting(): ScrapedFile | null {
  if (FULL || !existsSync(OUT)) return null;
  try {
    const file = JSON.parse(readFileSync(OUT, 'utf8')) as ScrapedFile;
    return file.v === SCRAPED_FORMAT_VERSION ? file : null;
  } catch {
    return null;
  }
}

async function main() {
  const year = new Date().getUTCFullYear();
  const years = [year, year - 1];

  const rows = (await Promise.all(years.map(loadIndex)))
    .flat()
    .filter((r) => r.filingType === PERIODIC_TRANSACTION_REPORT);

  const existing = loadExisting();
  const filings: Record<string, ScrapedTrade[]> = {};
  let unlisted: string[] = [];
  let scanned: string[] = [];
  const unreadable: string[] = [];

  // Keep what we already have for filings still in the covered years.
  const wanted = new Set(rows.map((r) => r.docId));
  if (existing) {
    for (const docId of Object.keys(existing.filings)) {
      if (wanted.has(docId)) filings[docId] = decodeFiling(existing, docId);
    }
    unlisted = existing.unlisted.filter((d) => wanted.has(d));
    scanned = existing.scanned.filter((d) => wanted.has(d));
  }
  const done = new Set([...Object.keys(filings), ...unlisted, ...scanned]);
  // `unreadable` is retried every run: those are usually PDFs not posted yet.
  const todo = rows.filter((r) => !done.has(r.docId)).slice(0, LIMIT);

  console.log(`${rows.length} trade reports in ${years.join(' + ')}; ${done.size} already scraped; fetching ${todo.length}.`);
  // Nothing new: leave the file untouched, so a scheduled run has nothing to commit.
  if (existing && todo.length === 0 && existing.unreadable.length === 0) {
    console.log('Up to date.');
    return;
  }

  let next = 0;
  let finished = 0;
  let trades = 0;
  const worker = async () => {
    while (next < todo.length) {
      const row = todo[next++]!;
      try {
        const res = await fetchWithRetry(filingUrl(row));
        const parsed = parsePtr(await readPdf(new Uint8Array(await res.arrayBuffer())));
        const listed = listedTrades(parsed.transactions);
        if (parsed.scanned) {
          scanned.push(row.docId);
        } else if (parsed.transactions.length === 0) {
          // Text, but no table we recognise: worth a look, and a retry.
          unreadable.push(row.docId);
        } else if (listed.length === 0) {
          unlisted.push(row.docId);
        } else {
          filings[row.docId] = listed;
          trades += listed.length;
        }
      } catch (err) {
        unreadable.push(row.docId);
        console.warn(`  ${row.docId} (${row.last}): ${(err as Error).message}`);
      }
      finished++;
      if (finished % 25 === 0 || finished === todo.length) {
        console.log(`  ${finished}/${todo.length} read, ${trades} new transactions`);
      }
      await sleep(PAUSE_MS);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const out = encodeFile(filings, {
    generatedAt: new Date().toISOString(),
    years,
    unlisted: unlisted.sort(),
    scanned: scanned.sort(),
    unreadable: unreadable.sort(),
  });
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out));

  const total = Object.values(out.filings).reduce((n, t) => n + t.length, 0);
  console.log(
    `Wrote ${OUT}: ${total} trades in listed securities across ${Object.keys(out.filings).length} filings; ` +
      `${out.unlisted.length} filings with only bonds/funds, ${out.scanned.length} scanned (no text), ` +
      `${out.unreadable.length} unreadable.`,
  );
}

await main();
