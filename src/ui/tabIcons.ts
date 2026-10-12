/**
 * The tab bar's own icons, as SVG path data on a 24px grid.
 *
 * Drawn for Ripple rather than borrowed from an icon font, and picked one by
 * one from the icon sets on the design canvas: Signals and Trades from v1
 * (Ripple line), Timeline from v4 (geometric), Watchlist from v2 (duotone),
 * Profile from v1. Every icon is one outline plus the shape that fills in when
 * its tab is selected, so the selected tab changes shape, not only colour.
 *
 * Pure data, so `test/tabIcons.test.ts` can check it without a renderer.
 */

export type TabName = 'index' | 'trades' | 'timeline' | 'watchlist' | 'profile';

export interface TabIconSpec {
  /** Always drawn, as a 1.8 stroke. */
  stroke: string;
  /** Filled in the icon colour. */
  fill: string;
  /** How strongly `fill` shows when idle and when selected, 0..1. */
  fillIdle: number;
  fillSelected: number;
  /**
   * Detail redrawn in the bar's own colour over a solid selected fill, so it
   * reads as cut out. Only the duotone Watchlist icon has one.
   */
  knock?: string;
}

export const TAB_ICONS: Record<TabName, TabIconSpec> = {
  // v1: a ripple. A source dot, a ring, and an outer ring still spreading.
  index: {
    stroke:
      'M12 10.2a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM19.8 7.5A9 9 0 1 1 16.5 4.2',
    fill: 'M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z',
    fillIdle: 0,
    fillSelected: 0.3,
  },
  // v1: two candles, a price move someone acted on.
  trades: {
    stroke: 'M8 3v3M8 15v6M5.5 6h5v9h-5zM16 3v6M16 17v4M13.5 9h5v8h-5z',
    fill: 'M5.5 6h5v9h-5zM13.5 9h5v8h-5z',
    fillIdle: 0,
    fillSelected: 1,
  },
  // v4: an axis with marks of different weight.
  timeline: {
    stroke: 'M3 12h18M5 10.5h2v3H5zM11 8.5h2v7h-2zM17 10h2v4h-2z',
    fill: 'M5 10.5h2v3H5zM11 8.5h2v7h-2zM17 10h2v4h-2z',
    fillIdle: 0,
    fillSelected: 1,
  },
  // v2: a tinted bookmark holding an eye. Selected turns the bookmark solid,
  // with the eye cut out of it.
  watchlist: {
    stroke:
      'M7 3h10a2 2 0 0 1 2 2v16l-7-4.5L5 21V5a2 2 0 0 1 2-2zM8 10.5s1.6-2.6 4-2.6 4 2.6 4 2.6-1.6 2.6-4 2.6-4-2.6-4-2.6zM12 9.6a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z',
    fill: 'M7 3h10a2 2 0 0 1 2 2v16l-7-4.5L5 21V5a2 2 0 0 1 2-2z',
    fillIdle: 0.16,
    fillSelected: 1,
    knock:
      'M8 10.5s1.6-2.6 4-2.6 4 2.6 4 2.6-1.6 2.6-4 2.6-4-2.6-4-2.6zM12 9.6a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z',
  },
  // v1: a person in a circle. Replaced by the user's photo when they set one.
  profile: {
    stroke:
      'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6.3 18.2c1.3-2 3.3-3 5.7-3s4.4 1 5.7 3',
    fill: 'M12 7.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6.3 18.2c1.3-2 3.3-3 5.7-3s4.4 1 5.7 3A9 9 0 0 1 6.3 18.2z',
    fillIdle: 0,
    fillSelected: 1,
  },
};

/** Order in the bar, left to right. Profile sits at the far right. */
export const TAB_ORDER: TabName[] = ['index', 'trades', 'timeline', 'watchlist', 'profile'];
