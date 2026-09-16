import { create } from 'zustand';

/**
 * Which document the in-app browser window is showing, if any.
 *
 * A store rather than component state because opening a filing happens in an
 * event handler — `openLink` in `src/lib/feedback.ts`, called from a card, a
 * table row, a timeline dot — and none of those can render a modal. The window
 * is mounted once at the root and watches this instead, so every call site
 * stays a one-line function call and none of them knows a modal exists.
 *
 * Deliberately not persisted. A relaunch that reopened whatever document was
 * on screen three days ago would be reopening a window nobody asked for, in
 * front of the feed they actually came back for.
 */

export interface BrowserTarget {
  url: string;
  /** What the app already knows this is, shown until the page reports its own. */
  title?: string | null;
}

interface BrowserState {
  target: BrowserTarget | null;
  open: (url: string, title?: string | null) => void;
  close: () => void;
}

export const useBrowser = create<BrowserState>((set) => ({
  target: null,
  open: (url, title = null) => set({ target: { url, title } }),
  close: () => set({ target: null }),
}));
