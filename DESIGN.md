---
version: alpha
name: Ripple
description: >-
  A calm, dense reader for public disclosure records — congressional trade
  filings, SEC Form 4 insider transactions, presidential actions and tracked
  stock moves — merged into one reverse-chronological feed. Dark-first, flat,
  hairline-separated, system type. Direction is never carried by colour alone.
  Unprefixed colour tokens are the default dark palette; `light-*` tokens are
  the light palette; `*-accessible-*` tokens replace up/down in the
  colour-vision-safe tone mode.
colors:
  # ── Dark (default theme) ─────────────────────────────────────────────
  bg: "#0B0E13"
  surface: "#141922"
  surface-alt: "#1C2230"
  raised: "#2A3242"
  border: "#252C3B"
  border-strong: "#333C4E"
  text: "#E9EDF5"
  text-muted: "#8D97AB"
  text-subtle: "#757E92"
  text-faint: "#5C6579"
  accent: "#5B8DEF"
  up: "#3FD68C"
  down: "#F2545B"
  warning: "#E8B23A"
  on-accent: "#0B0E13"
  logo-plate: "#F5F7FA"
  overlay: "rgba(0, 0, 0, 0.6)"
  # ── Light ────────────────────────────────────────────────────────────
  light-bg: "#F6F8FC"
  light-surface: "#FFFFFF"
  light-surface-alt: "#E9ECF3"
  light-raised: "#FFFFFF"
  light-border: "#DCE1EB"
  light-border-strong: "#C3CAD9"
  light-text: "#141A26"
  light-text-muted: "#525967"
  light-text-subtle: "#646D7E"
  light-text-faint: "#7C879C"
  light-accent: "#2457D6"
  light-up: "#067647"
  light-down: "#C4262E"
  light-warning: "#9A6206"
  light-on-accent: "#FFFFFF"
  light-logo-plate: "#F5F7FA"
  light-overlay: "rgba(16, 20, 28, 0.45)"
  # ── Accessible tones (replace up/down only; everything else unchanged) ─
  dark-accessible-up: "#2DD4BF"
  dark-accessible-down: "#FF6B47"
  light-accessible-up: "#0F766E"
  light-accessible-down: "#C2410C"
  # ── Source identity (dark: used as-is) ───────────────────────────────
  source-congress: "#C084FC"
  source-insider: "#F59E0B"
  source-policy: "#5B8DEF"
  source-stocks: "#3FD68C"
  # ── Source solid fills, light theme only ─────────────────────────────
  light-fill-congress: "#7E3AF2"
  light-fill-insider: "#B45309"
  light-fill-policy: "#2457D6"
  light-fill-stocks: "#067647"
typography:
  title:
    fontFamily: system-ui
    fontSize: 20px
    fontWeight: 700
    letterSpacing: -0.3px
  heading:
    fontFamily: system-ui
    fontSize: 16px
    fontWeight: 700
    letterSpacing: -0.2px
  body:
    fontFamily: system-ui
    fontSize: 15px
    fontWeight: 400
    lineHeight: 21px
  body-tight:
    fontFamily: system-ui
    fontSize: 14px
    fontWeight: 400
    lineHeight: 19px
  label:
    fontFamily: system-ui
    fontSize: 13px
    fontWeight: 600
  caption:
    fontFamily: system-ui
    fontSize: 12px
    fontWeight: 400
  micro:
    fontFamily: system-ui
    fontSize: 11px
    fontWeight: 600
    letterSpacing: 0.3px
  tag:
    fontFamily: system-ui
    fontSize: 10px
    fontWeight: 700
    letterSpacing: 0.4px
  code:
    fontFamily: Menlo, monospace
    fontSize: 12px
    fontWeight: 400
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  pill: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  gutter: 16px
  row: 12px
  touch-target: 44px
  fab-clearance: 96px
components:
  screen:
    backgroundColor: "{colors.bg}"
  signal-card:
    backgroundColor: "{colors.bg}"
    padding: 12px
  signal-card-pressed:
    backgroundColor: "{colors.surface}"
  signal-card-text:
    textColor: "{colors.text}"
    typography: "{typography.body}"
  signal-card-name:
    textColor: "{colors.text}"
    typography: "{typography.label}"
  signal-card-meta:
    textColor: "{colors.text-muted}"
    typography: "{typography.caption}"
  value:
    backgroundColor: transparent
    textColor: "{colors.up}"
    typography: "{typography.label}"
  record-badge:
    backgroundColor: transparent
    borderColor: "{colors.border-strong}"
    textColor: "{colors.text-muted}"
    typography: "{typography.tag}"
    rounded: "{rounded.sm}"
    padding: 2px
  source-label:
    dotSize: 6px
    textColor: "{colors.text-muted}"
    typography: "{typography.caption}"
  filter-chip-on:
    backgroundColor: "{colors.surface-alt}"
    borderColor: "{colors.border-strong}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 6px
  filter-chip-off:
    backgroundColor: transparent
    borderColor: "{colors.border}"
    textColor: "{colors.text-subtle}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: 6px
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: 44px
  fab:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    size: 56px
  new-signals-pill:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.micro}"
    rounded: "{rounded.pill}"
    padding: 12px
  segmented-track:
    backgroundColor: "{colors.surface-alt}"
    rounded: "{rounded.md}"
    padding: 3px
  segmented-selected:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: 7px
  segmented-unselected:
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
  provenance-tag:
    backgroundColor: transparent
    borderColor: "{colors.border}"
    dotColor: "{colors.up}"
    textColor: "{colors.text-muted}"
    typography: "{typography.tag}"
    rounded: "{rounded.sm}"
    padding: 2px
  settings-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  settings-section-title:
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
  list-row:
    backgroundColor: "{colors.bg}"
    padding: 12px
  tab-bar:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text-subtle}"
  tab-bar-active:
    textColor: "{colors.accent}"
  empty-state-icon:
    textColor: "{colors.text-subtle}"
    size: 28px
  empty-state-title:
    textColor: "{colors.text}"
    typography: "{typography.heading}"
  empty-state-body:
    textColor: "{colors.text-muted}"
    typography: "{typography.body-tight}"
    width: 280px
  avatar-person:
    rounded: "{rounded.pill}"
    size: 40px
  avatar-company:
    rounded: "{rounded.md}"
    size: 40px
---

# Ripple — Design System

This file is the visual contract for Ripple: tokens in the frontmatter, and
the rules for using them below. The code source of truth is
[`src/ui/theme.ts`](src/ui/theme.ts) (plus [`tone.ts`](src/ui/tone.ts) and
[`sourceFill.ts`](src/ui/sourceFill.ts)). Every hex value here is copied from
it, and every contrast ratio was measured against it, not taken from comments.
If this file and `theme.ts` ever disagree, `theme.ts` wins and this file is out
of date.

User flows, the screen/state matrix and the OpenDesign frame list are in
[`docs/OpenDesign User-Flow Brief.md`](docs/OpenDesign%20User-Flow%20Brief.md).
This file covers the visual system only.

## Overview

Ripple reads like an instrument, not a trading app. It shows what was
disclosed, by whom, and when, in one reverse-chronological feed. The visual
language is **quiet by default and loud only where information lives**. Most
of the screen is near-black ground and grey type. Colour appears in only three
places: a source's identity, a direction (up/down), and the one accent used for
the primary action.

**Personality:** sober, dense, factual. No hero imagery, no gradients, no
illustration, no celebration — and none of the generated-template tells:
no sparkle icons, no icon in a tinted circle, no grid of colour-tinted feature
cards, no rainbow of saturated pills. Colour is a 6–8px dot next to a word,
not a fill. It must never look like it is telling you to
buy something (see Do's and Don'ts on store compliance).

**Dark is the primary theme.** `app.json` sets `userInterfaceStyle: "dark"`,
`primaryColor: "#5B8DEF"` (the dark accent) and the Android adaptive-icon
background `#0B0E13` (the dark `bg`). The "System" theme falls back to **dark**
when the OS reports no preference. Design dark first, then check light.

**Four palettes, two independent settings:**

| | Classic tones | Accessible tones |
|---|---|---|
| **Dark** | default | `up`/`down` → teal/orange |
| **Light** | light palette | `up`/`down` → teal/orange |

The theme can be System, Dark or Light. The tone mode can be Classic or
Accessible. Accessible mode changes **only** `up` and `down`; `accent`,
`warning` and the source colours stay the same.

**Platform:** a phone app (React Native + Expo) with a single column. Design at
390×844, and check 320 and 430 widths. There are no breakpoints and no tablet
layout, although `supportsTablet` is on.

**Screens:** four tabs — **Signals** (header title "Ripple"), **Trades**,
**Timeline**, **Watchlist** — plus stack screens for Settings, Add (a modal
source picker, then a per-source search), Subject profile, Backup, Privacy and
Terms.

**How code uses these tokens:** the frontmatter names are the roles in the
`Palette` interface, converted to kebab-case. They are **not** importable
constants. Components get colours only through `useTheme()` or
`makeStyles((c) => …)`. `theme.ts` deliberately has no `colors` export, because
`StyleSheet.create` would capture a module-scope palette once and it would stop
following theme changes.

## Colors

### Neutrals and roles

Contrast is measured against `bg` in each theme. AA needs 4.5:1 for text and
3:1 for UI boundaries.

| Role | Dark | Light | vs bg (dark / light) | Use |
|---|---|---|---|---|
| `bg` | `#0B0E13` | `#F6F8FC` | — | Screen, feed cards, headers, tab bar |
| `surface` | `#141922` | `#FFFFFF` | 1.10 / 1.06 | Raised cards (settings, backup); **pressed** rows |
| `surface-alt` | `#1C2230` | `#E9ECF3` | — | Segmented-control track, an on filter chip, the off track of a switch, pressed chrome |
| `raised` | `#2A3242` | `#FFFFFF` | — | The selected segment on a `surface-alt` track. Lighter than the track in both themes |
| `border` | `#252C3B` | `#DCE1EB` | 1.38 / 1.23 | Hairlines. Kept low contrast on purpose: spacing does the separating |
| `border-strong` | `#333C4E` | `#C3CAD9` | 1.75 / 1.55 | Outline of record badges, an on filter chip, and the starter notice's Follow affordance |
| `text` | `#E9EDF5` | `#141A26` | 16.47 / 16.38 | Primary content |
| `text-muted` | `#8D97AB` | `#525967` | 6.58 / 6.62 | Metadata that carries information: handles, timestamps, counts |
| `text-subtle` | `#757E92` | `#646D7E` | 4.75 / 4.90 | The dimmest colour allowed for informative text, **on `bg` only** (see below) |
| `text-faint` | `#5C6579` | `#7C879C` | 3.31 / 3.40 | **Decorative only**: separator glyphs, inactive chrome. Fails AA for text |
| `accent` | `#5B8DEF` | `#2457D6` | 5.98 / 5.79 | Primary action, selection, links, the active tab |
| `on-accent` | `#0B0E13` | `#FFFFFF` | on accent 5.98 / 6.16 | Text and icons on any solid fill (accent *or* a source fill) |
| `warning` | `#E8B23A` | `#9A6206` | 10.00 / 4.79 | Muted/offline/optional states, always with an icon or a word |
| `logo-plate` | `#F5F7FA` | `#F5F7FA` | — | Plate for transparent logo artwork. The same in both themes on purpose, because logos are drawn for light backgrounds |
| `overlay` | `rgba(0,0,0,0.6)` | `rgba(16,20,28,0.45)` | — | Defined, **currently unused**. There is no scrim anywhere in the app |

**`text-subtle` depends on what is behind it.** In dark mode it reaches only
4.33:1 on `surface` and 3.90:1 on `surface-alt`. Inside a `surface` card, use
`text-muted` for anything the reader needs to read.

### Direction: up and down

| Tone | Dark classic | Light classic | Dark accessible | Light accessible |
|---|---|---|---|---|
| `up` | `#3FD68C` · 10.32 | `#067647` · 5.35 | `#2DD4BF` · 10.38 | `#0F766E` · 5.15 |
| `down` | `#F2545B` · 5.70 | `#C4262E` · 5.39 | `#FF6B47` · 6.85 | `#C2410C` · 4.87 |

(The number after each hex is contrast against that theme's `bg`.)

- **Colour is never the only cue** (WCAG 1.4.1, Level A). Every direction also
  has a shape or a word:
  - value chips put a glyph before the label: `▲ +$50K`, `▼ −4.2%`
    (`markedLabel`);
  - timeline markers use a triangle pointing up or down, or a circle when there
    is no single direction (`toneShape`);
  - screen readers hear a word: "Up, +$50K" (`spokenLabel`).
- Add a mark only where the direction is not already written in the label. A
  chip that already says BUY or SELL gets no ▲/▼.
- Accessible mode (teal/orange) exists because red/green collapse under
  deuteranopia and protanopia. Its gap is checked in `test/theme.test.ts` by
  simulating all three dichromacies.
- In accessible light mode, `down` and `warning` look alike under deuteranopia
  (ΔE 4.4). This is acceptable only because `warning` is **never** a bare tone
  chip and **never** sits next to a `down` chip. Keep it that way.

### Source identity

| Source | Colour (dark; text, icons, fills) | On light `bg` | Light solid fill | White on fill · fill vs page |
|---|---|---|---|---|
| Congress | `#C084FC` | 2.49 ✗ | `#7E3AF2` | 5.56 · 5.23 |
| Insiders | `#F59E0B` | 2.02 ✗ | `#B45309` | 5.02 · 4.72 |
| Policy | `#5B8DEF` | 3.04 ✗ | `#2457D6` | 6.16 · 5.79 |
| Stocks | `#3FD68C` | 1.76 ✗ | `#067647` | 5.69 · 5.35 |

- The source colours were chosen for the **dark** background. On light they
  fail even the 3:1 needed for UI boundaries, so **a light-theme surface must
  never paint a source colour directly**. Solid fills use the `light-fill-*`
  colour through `sourceFill()`, and the text on them is `on-accent`.
- Sources come from the provider registry, and their order (congress, insider,
  policy, stocks) comes from `PROVIDERS`. `LIGHT_FILL` is typed
  `Record<SourceId, …>`, so adding a fifth source fails the build until someone
  picks a light fill for it. Don't hardcode the list of four in reusable UI.

### Tints

Chips and badges use a translucent version of their own colour:
`tint(hex, alpha)` → `rgba(r, g, b, alpha)`. Alphas in use: **0.16** (the
usual value for chips, badges, provenance tags and the selected choice pill),
**0.12** (`TONE_TINT_ALPHA`, the EmptyState icon ring), **0.18** (avatar
monogram, add buttons), **0.07/0.35** (add-tile background/border),
**0.2** (`on-accent` wash on a filled chip's count pill).

**Rule:** a label drawn in colour X on a tint of X must still measure ≥4.5:1
against the tint composited over its background. Dark mode passes easily.
**Light mode does not at 0.16** (see Known deviations), so in light mode
prefer a neutral chip (`surface-alt` with a coloured glyph) or a solid fill
with `on-accent` text.

### Platform chrome

- Status bar: light content in dark, dark content in light.
- Tab bar: `bg` background, `border` hairline on top; active tab `accent`,
  inactive `text-subtle`. It used to be `text-faint`, which failed AA; an
  inactive tab is a place you can go, not a disabled control.
- Headers: `bg`, `text`, no shadow.
- Pull-to-refresh: tint `text-muted`, Android spinner `accent` on `surface`.
- Switch: track `surface-alt` (off) and `accent` (on).
- Filings open in the system browser sheet with the toolbar in `bg` and the
  controls in `accent`.

## Typography

**The platform system font: San Francisco on iOS, Roboto on Android.** The app
ships no font files and loads none. `expo-font` is installed but unused. Don't
specify Inter, SF Pro or any other webfont. The only other family is
monospace (`Menlo` / `monospace`), used for the backup code block.

| Level | Size / weight / tracking | Line height | Role |
|---|---|---|---|
| `title` | 20 / 700 / −0.3 | — | One per screen: tab headers, top-level section titles (Trades, Top holdings), EmptyState title, subject name |
| `heading` | 16 / 700 / −0.2 | — | Headers on stack screens, day headers in the feed, add-tile names |
| `body` | 15 / 400 | 21 | The **one sentence a card exists to deliver**. Never used for chrome |
| `body-tight` | 14 / 400 | 19 | Settings rows, long legal copy, search input |
| `label` | 13 / 600 | — | The workhorse: names of people and things, **every button label**, section titles within a screen |
| `caption` | 12 / 400 | — | Metadata: timestamps, counts, subtitles, help text, footnotes |
| `micro` | 11 / 600 / +0.3 | — | Chip labels, the new-signals pill, and small uppercase section labels above settings cards |
| `tag` | 10 / 700 / +0.4 | — | **Uppercase status stamps only**: `TRADE DISCLOSURE`, `MUTED`, `OPTIONAL`, `LIVE · KEYED` |

- Sizes are in points (dp) and map 1:1 to px on a 390-wide frame.
- Only `body` and `body-tight` define a line height. Long-form screens set their
  own leading where the text is used (23 on the privacy/terms lede, 20 or 17
  elsewhere). Don't invent leading for the other six levels.
- Uppercase is applied where the text is used, never in the token.
- The scale has two weights, 600 and 700. There is no 500.
- **10px is the smallest text size.** Anything smaller fails the legibility
  minimums of both platforms (iOS 11pt, Material 10sp).
- **System text scaling stays on.** The one exception is the avatar monogram,
  which is sized as a fraction of its fixed-size circle. Design every text
  container to grow; don't lock text boxes to a fixed height.

## Layout

**Spacing scale:** 4 · 8 · 12 · 16 · 24 · 32 (`xs`–`xxl`). There is nothing
between 16 and 24.

- **Gutter:** 16 horizontal on every screen and row.
- **Row rhythm:** 12 vertical padding per row. Rows are separated by a
  hairline, not by a gap between them.
- **Inside a row:** gap 12 between avatar and body, 4 between lines of text,
  8 between chips.
- **Section header:** 24 above and 8 below.
- **Scroll content:** 32 bottom padding. Grouped screens (Settings) use 16
  padding and 24 between sections.
- **Feed:** 96 bottom padding (56 FAB + 24 inset + 16), so the last card
  clears the FAB.
- **Touch targets:** at least 44×44. Icon buttons are drawn at 32–38 for
  density and padded out to 44 with `tapSlop(size)`. **Exception:** two
  targets 8 apart get real 44×44 boxes instead, because overlapping slop makes
  one touch claim both targets.
- **Off-scale numbers are sometimes deliberate.** 2, 3, 5, 7 and 10 appear on
  chips and tags, and several of them are touch-target arithmetic (the choice
  pill's 10 vertical padding is what gets it to 44). Don't round them to the
  scale.
- Safe areas and headers come from the navigator. Only the Add screen's
  bottom Done bar handles insets itself, together with a keyboard inset.
- The feed's day headers are **not sticky**: a sticky header would cover its
  own card on a day with few items.

**Recurring structures:**

- *Feed card / list row:* no surface and no radius. Gutter plus row rhythm and
  a bottom hairline. When pressed, the whole row turns `surface`.
- *Grouped card (Settings):* `surface`, `rounded.lg`, hairline border, no
  padding of its own. Child rows carry 16/12 padding and a **top** hairline.
- *Self-padded card (Backup):* `surface`, `rounded.lg`, hairline, 16 padding,
  12 gap.
- *Source list (Add):* one grouped `surface` card; each row is a 40 neutral
  icon square (glyph in `sourceFill`), name, blurb, `ProvenanceTag` and
  provenance line, and a chevron.

## Elevation & Depth

**The app is flat.** Depth comes from the background steps
**`bg` → `surface` → `surface-alt`**, divided by `StyleSheet.hairlineWidth`
borders, and nothing else.

Shadows are reserved for the only two things that float above the feed:

| Preset | Used on | iOS | Android |
|---|---|---|---|
| `floating` | FAB | `#000` @ 0.40, radius 12, y 4 | elevation 6 |
| `raised` | "N new signals" pill | `#000` @ 0.35, radius 10, y 3 | elevation 5 |

- Cards, tiles, sheets and headers have no shadow (`headerShadowVisible: false`
  everywhere).
- **No custom overlays.** There is no scrim, no bottom sheet, no custom modal
  and no z-index scale. Confirmations are native `Alert`; the card's long-press
  menu is `ActionSheetIOS` (with an `Alert` fallback on Android). Add opens as
  a native modal screen. Don't design custom dialogs.

**Motion:** almost none. Two things move, both with Reanimated:

- The tab bar's selector slides to the new tab (260ms, ease-out cubic) instead
  of jumping, so changing page reads as one motion. It is placed without a
  slide on launch.
- `RippleRings` widens and fades the logo's rings on onboarding.

Everything else is instant:

- Raised controls (FAB, pill, primary button) go to opacity 0.85 and scale 0.96
  when pressed.
- Rows turn `surface` when pressed.
- Haptics mark actions: a light impact when opening a signal, a success
  notification when adding a subject.
- New content is announced to screen readers through live regions.

Any motion **must** check the OS reduce-motion setting (`useReducedMotion`).
With it on, the selector moves instantly and the rings hold still.

## Shapes

| Radius | Used on |
|---|---|
| `sm` 6 | Small rectangular tags: record badge, provenance tag, `MUTED`, icon-only source badge, tone swatch |
| `md` 10 | Inputs, company/ticker avatars, source icons on Add, filter chips, filled buttons, segmented track, code block, warning boxes |
| `lg` 14 | Cards: settings card, backup card, the Add source list, starter notice |
| `pill` 999 | FAB, new-signals pill, labelled source badge |

- Filled buttons (primary, Follow) and filter chips are `md`, not pills: a
  row of full pills is the most recognisable template tell there is.
- A circle is `size / 2`; there is no `radius.full`.
- **Two border weights:** a hairline to *divide*, and 1px to *outline* a chip
  or tile. A 1px line is never used as a divider.
- **Avatar shape has meaning:** people (Congress members, policy actors) are
  **circles**; companies and tickers (insider, stocks) are **squares** with
  `rounded.md`. Logos sit on a plate, are scaled to fit with 5px of padding per
  side, and are never cropped. Portraits fill the circle and are cropped.
- **Direction shapes** carry meaning: ▲ triangle = up, ▼ triangle = down,
  ● circle = no single direction. They are triangles rather than arrows because
  an arrow's stem and head blur together at 10px. Timeline markers are 12
  across, or 16 for a numbered cluster.
- **Icons:** Ionicons only, passed through `iconName()`, which falls back to
  `help-circle-outline`. Both filled and `-outline` icons are in use (the tabs
  are `pulse`, `swap-horizontal`, `git-commit-outline` and `list`). Match
  whichever style the surrounding icons use.

## Components

There is **no component library**. Components are recipes: styles written
inline with `makeStyles` in each screen. The shared components are:

- `SignalCard(signal, onPress, onPressActor, onLongPress)` — the feed unit.
  Layout: 40 avatar | name · subtitle · time, a spacer, then the source as a
  6px dot and its name in `caption`/`text-muted`. Below that, the `body`
  sentence, then a footer with the value (bare tone text in `label` weight
  with its ▲/▼ mark, tabular figures, no pill) and record badges (hairline
  `border-strong` outline, no fill). The avatar and the body are **sibling**
  tap targets; the pressed state belongs to their shared parent.
- `FilterChips(hidden, onToggle, counts)` — one chip per source, `rounded.md`.
  - On: `surface-alt` fill, `border-strong` hairline, a solid source dot,
    `text` label and a `text-muted` tabular count.
  - Off: transparent with a `border` hairline, a hollow source dot and the
    label in `text-subtle` at weight 400.
  - Colour identifies the source, never the state. It is announced as a
    `switch`, and the label includes the count.
- `Segmented(label, value, onChange, options, fill)` — one choice from a small
  set: a `surface-alt` track with the selected segment on `raised`. Used for
  Theme and Gains-and-losses in Settings and for the timeline range. Announced
  as `radiogroup`/`radio` with `aria-checked`.
- `ProvenanceTag(mode)` — the provenance stamp: a hairline outline, a 6px
  status dot (`accent` keyed, `up` keyless, `warning` sample) and the fixed
  string in `tag`/`text-muted`. `OFFLINE SAMPLE` alone turns its text and
  outline `warning`, because it is the one state worth being loud about.
- `SourceBadge(source, showLabel=false, size=20)` — the source tint at 0.16
  with the glyph in the source colour. Still used on Watchlist and Settings
  rows; no longer on feed cards.
- `Avatar(uri, name, size=40, accent, square, logo)` — monogram fallback on a
  0.18 tint of the accent. In light mode the initials are `text`, because the
  brand colours on their own tint measure under 2:1. Logos sit on
  `logo-plate`.
- `SignalTimeline(signals, onSelect, title)` — one lane per source, 34 tall,
  with a 78-wide label column, direction-shaped markers and a numbered cluster
  when filings fall within a few days of each other. Lane names and neutral
  markers use `sourceFill`. The range is a `Segmented`.
- `EmptyState(icon, title, body, action)` — a bare 28 glyph in `text-subtle`
  (no ring), a `heading` title, `body-tight` copy in `text-muted` centred at
  max width 280, and an optional `button-primary` with an optional leading
  icon.
- `StarterNotice(onPress)` — an inset `surface` card with a hairline border,
  a two-line explanation and an outlined "+ Follow" affordance. The whole card
  is a single accessible element.
- Defined inside screens: `DigestHeader` (one line: day label in `label`, an
  optional headline tag, a hairline rule, and the counts in `caption`),
  `NavControls` (stack screens only — tab roots have none), `SettingsButton`.

**Provenance strings are fixed, word for word:** `LIVE · KEYED`,
`LIVE · NO KEY`, `OFFLINE SAMPLE`. They render through `ProvenanceTag`. The store-compliance case
depends on sample data never passing as live, so don't paraphrase them
("Live", "Demo").

**Accessibility contract for every component:**

- A group of related text (a card, a notice, a day header) is one accessible
  element with a full-sentence label.
- Information shown only visually (tone, badges, counts) is spoken in that
  label.
- Anything that toggles a persistent setting is a `switch` with `checked`.
- A single choice from a set is `radio` with `aria-checked`.
- Decorative elements are hidden from assistive tech.

## Do's and Don'ts

**Do**

- Get every colour from `useTheme()` / `makeStyles`, and check it in both
  themes and both tone modes. That is four palettes.
- Put a ▲/▼ mark, a shape or a word next to every up/down colour.
- Use `on-accent` for any text on a solid fill.
- Keep `text-faint` for decoration. Use `text-muted` for metadata, and
  `text-muted` instead of `text-subtle` on `surface`.
- Size controls to 44, using `tapSlop()` or a real 44 box when targets sit
  close together.
- Keep "Not investment advice" visible in the app (Settings), not only in the
  legal pages.
- Label where data comes from. Show missing price context as missing, never as
  a misleading zero.

**Don't**

- Don't nest a pressable inside a pressable. On web it renders a `<button>`
  inside a `<button>`. Two targets in a row must be **siblings**.
- Don't wrap a Pressable with a function `style` in `<Link asChild>`. The Slot
  spreads the function into `{}` and every style disappears (this once made the
  FAB an invisible strip).
- Don't add a `colors` export or import a palette at module scope.
- Don't paint source colours directly on the light theme.
- Don't use shadows except on the FAB and the new-signals pill. Don't add
  gradients, custom modals, scrims or bottom sheets.
- Don't add motion without a reduce-motion check.
- Don't go below 10px text, fix text containers to a set height, or turn off
  font scaling.
- Don't make Ripple look like a trading tool. No buy/sell calls to action, no
  green "opportunity" styling, no portfolio framing. Trades are *disclosed* and
  *past*; "Top holdings" ranks disclosures, not current positions (Apple
  guideline 3.2.1(viii)).
- Don't make sticky feed headers. Don't hardcode the four sources.
- Don't copy the items listed under Known deviations below.

## Known deviations

These exist in the code today and break the rules above. They are listed so a
design agent **doesn't copy them**, and so they can be fixed.

1. **Source colours used directly on light** in a few remaining places: the
   add-search glyphs and `SourceBadge` (Watchlist, Settings) still paint the
   dark-theme source colour. Feed cards, filter chips, the Add list, the
   timeline and the Follow button now go through `sourceFill` or `accent`.
2. **`text-subtle` in `surface` cards (dark):** 4.33:1. Settings no longer
   does this; check other cards before copying a colour from them.
3. **Text below 10px:** the timeline cluster count is 8.
4. **Shadows are tuned for dark only:** both presets use `#000` in both
   themes.
5. **Dead code:** `FeedSearch.tsx` and `BrowserWindow.tsx` are imported
   nowhere. `overlay` is unused.
6. **Out-of-date sources:** `.agents/skills/accessible-ui/SKILL.md` gives
   `text` as 16.1:1 (it is 16.47) and refers to `PostCard` and
   `app/account/…`, which no longer exist; **this file wins**. The
   `app.json` description names three sources; the registry ships four.
7. **The web build can't fetch live data.** SEC, the House Clerk and Yahoo
   send no CORS headers, so in a browser every live source fails and the feed
   runs on what was cached. Native is unaffected.
