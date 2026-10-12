import type { Actor, FundFiling, FundMove, FundPosition, Signal } from '@/providers/types';
import { money } from '../../lib/format.ts';
import { positionLabel, quarterLabel } from './thirteenF.ts';

/** Caps on what a signal carries, so a fund with thousands of lines stays small in storage. */
export const MAX_POSITIONS = 40;
export const MAX_MOVES = 40;

export interface FilingInput {
  accessionNumber: string;
  form: string;
  /** `YYYY-MM-DD`. */
  filingDate: string;
  /** Quarter end, `YYYY-MM-DD`. */
  period: string;
  url: string;
}

/** `2026-05-15` as epoch ms at UTC midnight: filings are dated by day. */
export function dayStamp(date: string): number {
  const t = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(t) ? t : 0;
}

/**
 * One 13F filing as a feed card.
 *
 * The headline number is the book's size, in a neutral pill: the change from
 * last quarter is mostly the market moving the stocks already held, so drawing
 * it as up or down would read as the fund buying or selling when it did
 * neither. The moves that were decisions are named in words and badges.
 */
export function fundSignal(
  filing: FilingInput,
  actor: Actor,
  detail: {
    totalValue: number;
    priorValue: number | null;
    positions: FundPosition[];
    moves: FundMove[];
    truncated: boolean;
    /** The cover page's count, when the table itself was too large to read. */
    positionCount?: number;
  },
): Signal {
  const quarter = quarterLabel(filing.period);
  const decided = detail.moves.filter((m) => m.kind !== 'unchanged');
  const named = (kind: FundMove['kind']) =>
    decided.filter((m) => m.kind === kind).slice(0, 2).map(positionLabel);

  const opened = named('new');
  const exited = named('exited');
  const count = detail.positionCount ?? detail.positions.length;

  const parts = [
    `${actor.displayName} reported ${count > 0 ? `${count} position${count === 1 ? '' : 's'}` : 'its holdings'} worth ${money(detail.totalValue)} for ${quarter}` +
      (detail.priorValue ? `, against ${money(detail.priorValue)} the quarter before.` : '.'),
    opened.length ? `New: ${opened.join(', ')}.` : '',
    exited.length ? `Exited: ${exited.join(', ')}.` : '',
  ];

  const holdings: FundFiling = {
    form: filing.form,
    period: filing.period,
    totalValue: detail.totalValue,
    priorValue: detail.priorValue,
    positionCount: count,
    positions: detail.positions.slice(0, MAX_POSITIONS),
    moves: decided.slice(0, MAX_MOVES),
    truncated: detail.truncated,
  };

  return {
    id: `funds:${filing.accessionNumber}`,
    source: 'funds',
    actor,
    text: parts.filter(Boolean).join(' '),
    url: filing.url,
    timestamp: dayStamp(filing.filingDate),
    ticker: null,
    accent: { label: money(detail.totalValue), tone: 'neutral' },
    badges: [
      '13F',
      quarter.toUpperCase(),
      ...opened.slice(0, 1).map((n) => `NEW ${n.toUpperCase()}`),
      ...exited.slice(0, 1).map((n) => `EXITED ${n.toUpperCase()}`),
    ],
    holdings,
  };
}

/**
 * A 13F notice: the fund files, but another manager reports its holdings.
 *
 * Pershing Square Capital Management did this for Q2 2026, once Pershing
 * Square Inc. began filing the same book. Without this card the fund would
 * simply go quiet, which reads as nothing happening.
 */
export function noticeSignal(filing: FilingInput, actor: Actor): Signal {
  const quarter = quarterLabel(filing.period);
  return {
    id: `funds:${filing.accessionNumber}`,
    source: 'funds',
    actor,
    text: `${actor.displayName} filed a notice for ${quarter}: its holdings are reported in another manager’s 13F.`,
    url: filing.url,
    timestamp: dayStamp(filing.filingDate),
    ticker: null,
    accent: null,
    badges: ['13F NOTICE', quarter.toUpperCase()],
    holdings: {
      form: filing.form,
      period: filing.period,
      totalValue: null,
      priorValue: null,
      positionCount: 0,
      positions: [],
      moves: [],
      truncated: false,
    },
  };
}
