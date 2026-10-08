Design the key screens and user flows for a mobile app called **Ripple** (working name). It is an iPhone/Android app (React Native), so every screen is a phone screen at 390×844.

**You decide the whole visual direction:** typeface(s), colour palette, light or dark theme, iconography, shape language, density, motion cues and layout. Don't imitate any existing finance app. Commit to one clear, nameable direction and apply it consistently across every screen. Tell me in a sentence what the direction is and why it fits.

## What the app is

Ripple turns public financial disclosures into one readable feed. It watches four sources:

- **Congress:** stock trades that members of Congress must disclose under the STOCK Act. Amounts are filed as ranges (e.g. $1,001–$15,000 or $1,000,001–$5,000,000), can be in a spouse's account, can be options, and are often disclosed weeks after the trade (the legal deadline is 45 days).
- **Insiders:** SEC Form 4 filings, where executives and directors buy or sell their own company's stock.
- **Policy:** executive orders and proclamations as they are signed, followable by topic (e.g. "tariff").
- **Stocks:** notable price moves and volume spikes for tickers the user tracks.

Each item links to the original filing. The app adds context: how the stock moved after the trade, how it did against the S&P 500 (shown as "+43.02pp vs SPY"), how it moved between the trade and the filing, and whether the filing was late.

**Who it's for:** curious retail investors and politically engaged readers. They check it once or twice a day and want to know "what did the people I follow just do, and did it matter?"

**Tone:** factual, calm and trustworthy. It reports the public record and makes no accusations. It is not investment advice and is not affiliated with any government agency; that disclaimer must appear in onboarding.

## Key user flows (design every screen in each)

1. **First launch.** Brief onboarding (3–4 screens maximum) explains the four sources and the "measured against the market" idea. It ends on a choice: follow someone now, or explore a starter feed first.
2. **Follow someone.** Choose a source → for Congress, pick a whole party or search for a member → follow. Show the search results state and the moment of following (confirmation or feedback).
3. **The daily check: Signals feed.**
   - A chronological feed grouped by day, mixing all four sources, with a way to filter by source.
   - Each card shows who, what, the amount or size, when, the source, and one measured outcome.
   - Show what a burst of activity looks like (e.g. "3 filings on HD in one day").
4. **Trades.** A focused list of disclosed congressional trades: member, party and district, ticker and company, buy or sell, amount range, days to disclose, and performance since. Tapping opens the original filing.
5. **Member page** (e.g. Nancy Pelosi, CA-11, Democrat):
   - Profile, follow and mute.
   - Their filing activity over time.
   - Their trades with outcomes, including one late filing and one options trade.
6. **Timeline.** Filing activity over time for all followed sources, with ranges of 30D / 90D / 1Y / All. It should show clusters, direction (buys vs sells) and volume at a glance. You choose the visualisation.
7. **Watchlist.**
   - Everything followed, grouped by source.
   - Mute or unfollow each item.
   - A party can expand to show its most active members.
   - Show one cross-source insight, e.g. "Republicans' most-traded tickers overlap your Insiders and Stocks follows: BSX, HD, MPC."

## States to include

- An empty feed (new user, nothing followed).
- Loading.
- Offline or showing cached data.
- A source error (e.g. the SEC feed is rate-limited).

## Real content to use (no lorem ipsum)

- **Cleo Fields** (LA-6, Democrat) bought AAPL, $1,001–$15,000, disclosed 3 days ago, +1.02% since.
- **David J. Taylor** (OH-2, Republican) bought AMGN, $1,001–$15,000, −1.04%. He also sold MPC.
- **Nancy Pelosi** (CA-11, Democrat) bought BE (Bloom Energy), $1,000,001–$5,000,000, on 2026-07-24 in a spouse's account. It was disclosed 28 days later and was +9.51% before filing and +43.02pp vs SPY. A second trade on the same day was options.
- **Max L. Miller** (OH-7, Republican): 16 trade filings.
- **Stocks:** GOOG moved +1.62% to $340.35 on 17.5M shares. MSFT closed at a 3-month high of $517.53. HD closed at a 3-month low of $282.46.
- **Policy:** a topic watch for "tariff" in presidential actions.
- **Insiders:** Apple Inc. ($AAPL, CIK 0000320193).

Use initials or neutral placeholders for portraits and company logos.

## Principles (these are requirements, not style)

- **Direction is never colour-only.** Buy/sell and up/down always carry an arrow, sign or word too, so they work for colour-blind users.
- **Parties are identified, not campaigned for.** Party marks should feel neutral and informational.
- **Every number has its unit and its comparison.** "+9.51% before filing" and "+43.02pp vs SPY" are clearer than a bare "+9.51%".
- **Accessibility:**
  - Body text contrast of 4.5:1 or better.
  - Touch targets of 44pt or more.
  - Text still works at larger accessibility sizes.
  - Never truncate a ticker or a number.
- **Platform conventions:**
  - Bottom tab bar with four tabs: Signals, Trades, Timeline, Watchlist.
  - Settings reachable from the header.
  - A primary "follow something" action always within reach.
- **The app follows the device's light/dark setting.** Whichever theme you lead with, define the other too, and show at least two screens in it.

## Deliverables

1. Every screen in the flows above, as artboards arranged left to right in flow order, one row per flow, with a title over each row.
2. A **style sheet artboard** so this can be built in React Native:
   - Colour tokens (with light and dark values).
   - The type scale (font, size, weight, line height).
   - Spacing and radius scales.
   - Icon style.
   - Components: feed card, trade row, filter chip, segmented control, tab bar, buttons, tags/badges, avatar variants (person, party, company, ticker).
3. Links between artboards, so the main flows can be clicked through in Play.
