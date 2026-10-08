# Ripple: key screens, elements and features

This is an inventory of the current app, meant as input for redesigning the user flows. It lists what each screen has and does today, not how it looks.

## User flows

1. **First launch:** Onboarding (4 pages) → either Add → Congress → follow a party or member → Signals, or "Explore the starter feed first" → Signals.
2. **Daily check:** Signals feed → filter by source → tap a card → subject page → open the original filing.
3. **Follow something new:** the + button (on Signals or Watchlist) → choose a source → search → add (several at once) → Done.
4. **Research a trade:** Trades → open the filing, or tap the member → member page → timeline and every trade, measured.
5. **Spot patterns:** Timeline → change the range → read the clusters → the Latest list.
6. **Manage follows:** Watchlist → mute, unfollow, expand a party into its members → member page.
7. **Housekeeping:** Settings → theme and tone, sources, cache, backup/restore, replay the intro, legal.

---

## 1. Onboarding (4 pages, swipeable)

- **Shared elements:**
  - Brand gradient background with a glow.
  - A Skip link (top right).
  - Page dots.
  - A full-width primary button.
- **Page 1, Welcome:**
  - The logo inside animated ripple rings (still when reduced motion is on).
  - Kicker "PUBLIC MONEY · MADE LEGIBLE", the wordmark "Ripple" and the tagline "See the signal behind the noise."
  - "Get started" button.
- **Page 2, Sources:** "Every market-moving disclosure, in one place." Then 4 rows, each with an icon, name and one-line description: Congress, Insiders, Policy, Stocks.
- **Page 3, Measured:** "Every trade, measured against the market." Then 3 points: What happened next (vs the S&P 500), When it became public (filings past the 45-day deadline are flagged), and Straight to the source (every card opens the original filing).
- **Page 4, Follow:**
  - "Follow the people who move markets." with an explainer.
  - The disclaimer: public records only, not investment advice, not affiliated with any government agency.
  - Primary button "Follow a party or member" (goes to Add → Congress); secondary link "Explore the starter feed first".
- **Behaviour:**
  - Shown once.
  - Can be replayed from Settings → Show introduction.
  - Finishing marks it as seen.

## 2. Signals: the main feed (tab 1)

- **Header:** logo, "Ripple" and a settings gear.
- **Source filter chips:** Congress, Insiders, Policy, Stocks.
  - Each chip has an icon and a count.
  - They scroll horizontally and toggle on/off; an off chip is dimmed.
- **Day headers:**
  - The date, e.g. "Fri 2 Oct".
  - A summary such as "14 filings · Congress 11, Stocks 3".
  - An optional burst badge, e.g. "3 FILINGS ON HD".
- **Feed card**, which varies by source:
  - **Avatar:** a member portrait, company logo, ticker tile or policy glyph.
  - **Title line:** name or ticker, plus meta (district · party · age, or USD · 1d), with a source dot and label on the right.
  - **Sentence:** a plain-English summary, e.g. "Cleo Fields bought NFLX … ($1,001 – $15,000) on 2026-09-14. Disclosed 17 days later."
  - **Value chip:** direction plus amount or %, e.g. "▲ +$8,001", "▼ −$806K", "▲ +1.62%".
  - **Tags:**
    - BUY / SELL / OPEN-MARKET SELL / TAX WITHHOLDING / PRICE MOVE / 3-MONTH HIGH.
    - VIA DEMOCRATS / REPUBLICANS (why it is in your feed).
    - "3 MEMBERS BOUGHT · 30D" (clusters).
    - "+9.51% BEFORE FILING", "+0.18pp vs SPY", "GOOG −0.11% · 2D", "+6 MORE".
- **Floating + button:** add a subject.
- **Behaviour:**
  - Pull to refresh.
  - Auto-refresh every 10 minutes while the app is open.
  - A "N new signals" pill scrolls you to the top.
  - Feed grouping by day can be turned off in Settings.
- **States:**
  - Starter feed and notice (nothing followed yet).
  - Loading ("Pulling filings…").
  - Empty for the current filter.
  - An error bar per source that can be dismissed.
  - An offline sample tag.

## 3. Trades (tab 2)

- **Header:** logo, "Trades" and a gear.
- **Section "Trades":** "Stocks & crypto · 114 disclosed".
- **Trade row:**
  - Member portrait, name, district and party, with a BUY/SELL pill.
  - Asset logo, ticker and type (Stock), amount range and age.
  - Performance since the trade (▲/▼ %), with a quality line: "Flat", "Sold high", "Bought low", "Not a decision" or "No price data".
  - An "open filing" icon.
  - Insider rows show an initials avatar, the role (e.g. "EVP & Chief Financial Officer"), a GRANT / TAX pill and a share count.
- **Section "Congress trade reports":** filings that list no tickers, with a REPORT action that opens the PDF.
- **Section "Top holdings"**.
- **Behaviour:**
  - Tapping the person opens their subject page.
  - The open icon opens the source document.

## 4. Timeline (tab 3)

- **Header:** logo, "Timeline" and a gear.
- **Range control:** "All sources" with a segmented control: 30D / 90D / 1Y / All.
- **Swim-lane chart:** one lane per source (Stocks, Insiders, Congress, Policy), each with its count.
  - Each mark is a filing. A numbered circle means several filings within a few days.
  - ▲ means buys, ▼ means sells, and a circle means mixed or no direction.
  - The date axis runs along the bottom.
- **Legend paragraph and "Updated 8s ago"**.
- **Latest:** the most recent feed cards, in the same format as Signals.

## 5. Watchlist (tab 4)

- **Header:** logo, "Watchlist" and a gear.
- **Groups by source:** a source pill (icon and colour) with "N followed".
- **Row:** avatar, name and subtitle (e.g. "CA-11 · Democrat · 6 trade filings", "NASDAQ · Equity", "$AAPL · CIK …").
  - **Bell:** mute or unmute.
  - **✕:** unfollow.
  - **Party rows:** a members button that expands the party.
- **Expanded party:**
  - An insight box, e.g. "Their most-traded tickers are in your Insiders and Stocks: BSX, HD, MPC."
  - The most active members, each tappable through to their page.
- **"Add another subject"** row.
- **Behaviour:** a muted subject is kept but drops out of the feed.

## 6. Subject page (one template, five kinds)

- **Navigation bar:** back, forward, home, and the title.
- **Profile header:** avatar, name and subtitle, with a bell (mute) and a follow/unfollow button. When not followed, a "Follow" button is shown instead.
- **Range control:** 30D / 90D / 1Y / All, with a single-lane timeline for this subject.
- **Feed:** every signal for this subject, using the same card format.
- **Kinds:**
  - **Party** (Republicans/Democrats): every member's trades.
  - **Member** (Nancy Pelosi): portrait, district, party and filing count.
  - **Company insiders** (Apple Inc.): Form 4 sales and purchases with roles.
  - **Stock** (NVIDIA): price-move signals.
  - **Policy topic** ("tariff" in presidential actions): matching executive orders and proclamations, with a PROCLAMATION tag.

## 7. Add a subject (a 2-step flow)

- **Step 1, Choose source:**
  - Explanatory text at the top.
  - 4 source rows, each with an icon, name, description and provenance line ("Live · no key · House Clerk…").
  - A public-data note below the list.
- **Step 2, Search** (one screen per source):
  - A search field with a clear button.
  - Placeholders differ per source: "Name, district, or a party" / company / ticker / topic.
  - **Congress, with no query:** group rows for All members, Republicans, Democrats and Independents.
  - **Result row:** avatar, name and meta, with a + button that becomes "Added".
  - **"Done · N added →"** button at the bottom.

## 8. Settings

- **Profile:**
  - Theme: System / Dark / Light.
  - Gains and losses: Green/red or Teal/orange (colour-blind safe).
  - Group the feed by day: toggle.
  - Haptic feedback: toggle.
- **Sources:** a row per source with its provenance, a Live/no-key tag and a "N following" count.
- **Data:**
  - Subjects followed, paused, signals cached, last refreshed and refresh interval.
  - A "Clear cached signals" button.
- **About:**
  - App blurb and a not-investment-advice note.
  - Show introduction.
  - Terms of Service.
  - External links: House Clerk disclosures, SEC EDGAR and Federal Register.

## 9. Backup

- **Back up:** the watchlist as copyable JSON, with a "Send backup" button that opens the share sheet.
- **Restore:** a paste field and a Restore button. Restoring only adds subjects and never removes any.

## 10. Legal

- **Terms of Service and Privacy Policy:** long-form text with an effective date.
- **Draft notice:** an "unfilled before release" banner.

---

## Shared components to redesign once

- **Navigation:**
  - Tab bar: Signals (access-point icon), Trades (arrows), Timeline (chart line), Watchlist (eye).
  - App header (logo, title, gear), and the sub-page navigation bar (back, forward, home, title).
- **Feed and rows:**
  - Feed card.
  - Trade row.
  - Watchlist row.
  - Search result row.
  - Day header.
- **Controls:**
  - Filter chip.
  - Segmented control.
  - FAB.
  - Primary and secondary buttons.
- **Labels:**
  - Source pill.
  - Tag / badge.
  - Value chip with direction.
  - BUY/SELL pill.
- **Avatars:** person portrait, party glyph, company logo plate, ticker tile, policy glyph.
- **Data views:** swim-lane timeline, single-lane timeline, insight box.
- **States:** empty, loading, error bar, offline tag and "new signals" pill.

## Rules that carry over whatever the style

- Direction is never shown by colour alone: there is always ▲/▼ or BUY/SELL.
- Party marks are informational, not campaign styling.
- Contrast and tap targets:
  - Text contrast of 4.5:1 or better.
  - Touch targets of 44pt or more.
  - Tickers and numbers are never truncated.
- Light and dark themes, plus the alternative colour-blind-safe tone pair.
- Every card can reach its original public filing.
