/**
 * Company logos, addressed by ticker.
 *
 * Financial Modeling Prep serves these as plain images at a predictable path,
 * with no key and no API call — the URL is built from the symbol and handed
 * straight to `<Image>`. That matters: the alternative was Finnhub's
 * `/stock/profile2`, which does carry a `logo` field but costs a rate-limited
 * request per symbol just to learn a URL, and a feed can hold dozens.
 *
 * Coverage is broad — ordinary tickers, ETFs, class shares (`BRK.B`), and
 * crypto pairs in either spelling (`BTC-USD` and `BTCUSD` both resolve) — so
 * symbols are passed through as they come rather than being reshaped.
 *
 * An unknown symbol answers 404, which `Avatar` already treats as "no image"
 * and replaces with the ticker monogram. That is the intended failure: a
 * missing logo costs nothing, so nothing here needs to verify a symbol first.
 */
const LOGO_BASE = 'https://images.financialmodelingprep.com/symbol';

export function logoUrl(symbol: string | null | undefined): string | null {
  const clean = symbol?.trim().toUpperCase();
  if (!clean) return null;

  // Encoded because a symbol reaches us from a search result or a saved
  // subject, and a stray `/` or `?` would otherwise reshape the URL.
  return `${LOGO_BASE}/${encodeURIComponent(clean)}.png`;
}

/**
 * A site's own icon, by domain, from Google's favicon service.
 *
 * For the subjects with no ticker to address a logo by — a private fund. It
 * answers any domain, but with a blurred globe or a 16px icon scaled up where
 * the site publishes nothing better, so it is only used for domains checked
 * by eye to return a real mark (see `KNOWN_FUNDS`), never for one learned at
 * runtime.
 */
const SITE_ICON_BASE = 'https://www.google.com/s2/favicons';

export function siteIconUrl(domain: string | null | undefined): string | null {
  const clean = domain?.trim().toLowerCase();
  if (!clean) return null;
  return `${SITE_ICON_BASE}?sz=128&domain=${encodeURIComponent(clean)}`;
}
