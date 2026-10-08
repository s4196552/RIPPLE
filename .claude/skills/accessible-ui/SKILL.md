---
name: accessible-ui
description: React Native / Expo accessibility conventions for the Ripple CLD app — accessibilityRole/Label/State on Pressables, the nested-Pressable-renders-as-nested-button-on-web pitfall, touch target sizing, live-region announcements, and WCAG contrast for the theme tokens in src/ui/theme.ts. Use this whenever adding, editing, or reviewing any component under src/ui/components/ or any screen under app/ (especially anything with Pressable, TouchableOpacity, Image, or Text), whenever picking a text/icon color from theme.ts, and whenever the user asks about accessibility, a11y, screen readers, VoiceOver, TalkBack, keyboard navigation, or color contrast in this app — even if they just say "add a button" or "make this row tappable" without mentioning accessibility explicitly.
---

# Accessible UI for Ripple CLD

This app already has a consistent accessibility house style across `src/ui/components/` and `app/**`. The goal here isn't to teach generic WCAG — it's to keep new code matching what's already there, and to catch the handful of gaps that keep slipping through.

Apply this whenever you touch a `Pressable`/`TouchableOpacity`, an `Image`, or a color from `src/ui/theme.ts`. Two situations to handle differently:

- **Writing new UI**: follow the house style below as you write it, don't retrofit it after.
- **Reviewing/auditing existing UI**: walk the checklist near the bottom against the file(s) in scope and report what's missing — don't silently "fix" things the user didn't ask you to touch.

## House style (already established — match it)

**Every interactive `Pressable` gets a role and a label.** `accessibilityRole="button"` for actions, `accessibilityRole="switch"` for anything that toggles a persistent state (mute, filter on/off), paired with `accessibilityState={{ checked }}`. The label states the action in plain language, and for toggles it reflects the *current* state so the announcement makes sense either way:

```tsx
accessibilityRole="switch"
accessibilityState={{ checked: watched.muted }}
accessibilityLabel={watched.muted ? 'Unmute' : 'Mute'}
```

An icon-only button (no visible text) is exactly where this matters most — without a label a screen reader has nothing to announce but "button." A `Pressable` wrapping visible text usually doesn't need an explicit label (RN derives it from the child `Text`), but add one anyway when the visible text alone would be ambiguous out of context (e.g. multiple "Follow" buttons on one screen).

**Labels read as one natural phrase, not fragments.** `${author} on ${platform}: ${text}` (see `PostCard`), not separate labels stapled together. Write the label the way you'd actually say the row out loud.

**Never nest a `Pressable` inside another `Pressable`'s accessible subtree.** This repo hit it directly: a nested `Pressable` renders as a `<button>` inside a `<button>` on web, which is invalid HTML and breaks keyboard/AT focus. Every place that needs two independent tap targets on one row (avatar vs. card body in `PostCard`, row-navigate vs. mute/remove in `watchlist.tsx`) makes them **siblings** instead, and lifts any shared press-visual state (like a highlight on press) up to the common parent `View`. If you're adding a second tappable region inside an existing card/row, reach for this sibling pattern rather than wrapping one `Pressable` in another.

**Images**: set `accessibilityIgnoresInvertColors` on every `<Image>` (matches the rest of the codebase). Purely decorative glyphs and monogram fallbacks (`Avatar`'s initials) don't get their own `accessibilityLabel` — they sit inside an already-labeled `Pressable` ancestor, and giving them a second label would make VoiceOver/TalkBack announce the row twice.

## Checklist — things that have slipped through before

Run through these whenever you're adding a new interactive element or color, or auditing an existing one. None of these are hypothetical — every one was found missing somewhere in the current codebase.

1. **Icon-only `Pressable` with no role/label.** The error-dismiss bar in `app/(tabs)/index.tsx` (`styles.errorBar`) has neither `accessibilityRole` nor `accessibilityLabel` — a screen reader user has no idea it's tappable or what it does. Check every `Pressable` you add: if there's no descriptive child `Text`, it needs an explicit label.

2. **Data shown only in a visual badge, not in the label.** `FilterChips` renders a numeric count pill next to each platform name, but the label is just `"${label} filter"` — the count itself is invisible to a screen reader. If a number, icon, or color conveys information visually, fold it into the label text (e.g. `"${label} filter, ${count} posts"`).

3. **Live/transient content with no announcement.** The "N new posts" pill and the error banner in `app/(tabs)/index.tsx` appear on their own without user action, but nothing marks them so assistive tech notices. Give elements like this `accessibilityLiveRegion="polite"` (Android) and consider `AccessibilityInfo.announceForAccessibility()` on mount (cross-platform) so the change is actually spoken, not just visible.

4. **Touch target below ~44×44.** Several icon-only actions render smaller than that (e.g. the 34×34 `iconButton` in `app/account/[platform]/[handle].tsx`, the mute/remove icons in `watchlist.tsx` rows). They already use `hitSlop` to compensate — when you add a new icon button, give it `hitSlop` sized so the *effective* tap area reaches ~44×44, don't just eyeball it.

5. **A new color used for text/icons without checking contrast against `colors.bg`.** See the reference table below before reusing an existing token for a new purpose, or before adding a new token.

6. **Fixed-height rows or `numberOfLines` clamps that were only ever eyeballed at default font size.** This app hasn't verified behavior at large accessibility text sizes. If you're adding a row with a tight fixed height or an aggressive `numberOfLines`, sanity-check (or at least flag) how it behaves when Dynamic Type / font scaling is cranked up — text should never be silently clipped in a way that loses information.

## Contrast reference for `src/ui/theme.ts`

Precomputed WCAG contrast ratios against the dark palette's `bg` (#0B0918), so you don't have to recompute these by hand — `test/theme.test.ts` asserts the same numbers. AA requires **4.5:1** for normal text, **3:1** for large text (≥24px, or ≥18.66px bold) and for non-text UI components/graphics.

| Token | Hex | Ratio vs. bg | Verdict |
|---|---|---|---|
| `text` | `#ECEBF7` | 16.7:1 | Passes AA at any size |
| `textMuted` | `#9893B4` | 6.7:1 | Passes AA even for normal-size body text |
| `textSubtle` | `#7D7899` | 4.7:1 | Passes AA — the dimmest tone allowed for informational text |
| `textFaint` | `#605B7E` | **3.1:1** | **Fails AA for normal text.** Only passes the 3:1 large-text/graphical threshold |
| `accent` | `#21A1E4` | 6.8:1 | Passes AA at any size (the logo's sky ring; `onAccent` on it is 6.8:1) |
| `up` | `#3FD68C` | 10.5:1 | Passes AA at any size |
| `down` | `#F2545B` | 5.8:1 | Passes AA at any size |

The light palette has its own table in the comment above `lightPalette` in `src/ui/theme.ts`.

`textFaint` is the one real problem: it's currently used for captions, handles, and timestamps at 11–12px (`type.caption` / `type.micro`), which is normal-size text, not large text — so it's below the AA threshold everywhere it currently appears (`PostCard` handle/time/dot, watchlist row handle, etc.). Two honest fixes, don't invent a third: (a) reserve `textFaint` for genuinely decorative/non-informational chrome only, moving anything that conveys information (timestamps, handles, counts) to `textMuted`; or (b) if the visual hierarchy really needs a dimmer tone for that text, get a new token that clears 4.5:1 rather than reusing `textFaint`. If you're asked to fix this, don't do a sweeping repaint — flag it and let the user decide which reads matter enough to change, since `textFaint` is used a lot purely for visual hierarchy.

If a new theme token is proposed, compute its ratio against `colors.bg` the same way (WCAG relative luminance formula) before using it for text or icons, and note the result rather than assuming it's fine because it "looks readable."
