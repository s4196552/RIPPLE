import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { describe } from '@/providers/registry';
import type { Signal } from '@/providers/types';
import { relativeTime, spokenTime } from '@/lib/time';
import { glyph } from '../icons';
import { makeStyles, useTheme } from '../ThemeProvider';
import { font, radius, space, type } from '../theme';
import { subjectAvatar } from '../subjectAvatar';
import { spokenLabel } from '../tone';
import { Avatar } from './Avatar';
import { Glyph } from './Glyph';
import { TonePill } from './TonePill';

interface Props {
  signal: Signal;
  onPress: (signal: Signal) => void;
  onPressActor?: (signal: Signal) => void;
  /** Long press. Secondary actions belong here, never in a second visible control. */
  onLongPress?: (signal: Signal) => void;
}

/**
 * One row in the unified feed.
 *
 * Memoized on id + timestamp: polling re-renders the list often and the card
 * tree is the expensive part.
 */
export const SignalCard = memo(
  function SignalCard({ signal, onPress, onPressActor }: Props) {
    const c = useTheme();
    const styles = useStyles();
    const source = describe(signal.source);
    const [pressed, setPressed] = useState(false);
    const hasFooter = Boolean(signal.accent || signal.badges?.length);

    // The avatar and the card body are siblings, never nested Pressables:
    // nesting renders a <button> inside a <button> on web, which is invalid
    // HTML and breaks keyboard focus. Press state is lifted so the highlight
    // still covers the whole card.
    return (
      <View style={[styles.card, pressed && styles.cardPressed]}>
        <Pressable
          onPress={() => onPressActor?.(signal)}
          disabled={!onPressActor}
          hitSlop={space.xs}
          accessibilityRole="button"
          accessibilityLabel={`View all signals from ${signal.actor.displayName}`}
        >
          <Avatar
            {...subjectAvatar(signal.source, signal.actor.handle, signal.actor.avatarUrl)}
            name={signal.actor.displayName}
          />
        </Pressable>

        <Pressable
          style={styles.body}
          onPress={() => onPress(signal)}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          accessibilityRole="button"
          // One natural phrase, and it carries everything the card shows
          // visually — badges and the value pill included, since those are
          // information rather than decoration.
          accessibilityLabel={
            `${source.label}, ${spokenTime(signal.timestamp)}. ` +
            `${signal.actor.displayName}. ${signal.text}` +
            `${signal.accent ? ` ${spokenLabel(signal.accent.tone, signal.accent.label)}.` : ''}` +
            `${signal.badges?.length ? ` ${signal.badges.join('. ')}.` : ''}`
          }
          accessibilityHint="Opens the original filing"
        >
          {/* The kicker: where this came from, by icon and name, and when.
              Neutral on purpose — sources are told apart by name, so colour
              stays free to mean direction. */}
          <View style={styles.source}>
            <Glyph glyph={glyph(source.icon)} size={13} color={c.textSubtle} />
            <Text style={styles.sourceText} numberOfLines={1}>
              {source.label}
            </Text>
            <View style={styles.spacer} />
            <Text style={styles.time}>{relativeTime(signal.timestamp)}</Text>
          </View>

          <Text style={styles.name} numberOfLines={2}>
            {signal.actor.displayName}
            {signal.actor.subtitle ? (
              <Text style={styles.subtitle}>{`  ${signal.actor.subtitle}`}</Text>
            ) : null}
          </Text>

          <Text style={styles.text}>{signal.text}</Text>

          {hasFooter && (
            <View style={styles.footer}>
              <View style={styles.badges}>
                {signal.badges?.map((badge) => (
                  <View key={badge} style={styles.badge}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                ))}
              </View>
              {signal.accent && <TonePill tone={signal.accent.tone} label={signal.accent.label} />}
            </View>
          )}
        </Pressable>
      </View>
    );
  },
  (prev, next) => {
    const a = prev.signal;
    const b = next.signal;
    // id + timestamp alone was not enough: a re-fetch can enrich a signal in
    // place — a Congress filing gaining its ticker and amount once the PDF is
    // parsed — keeping both. The card then never repainted and showed the
    // thinner first version for the rest of the session. Compare what is
    // actually drawn, which is still far cheaper than re-rendering the tree.
    return (
      a.id === b.id &&
      a.timestamp === b.timestamp &&
      a.text === b.text &&
      a.actor.displayName === b.actor.displayName &&
      a.actor.subtitle === b.actor.subtitle &&
      a.actor.avatarUrl === b.actor.avatarUrl &&
      a.accent?.label === b.accent?.label &&
      a.accent?.tone === b.accent?.tone &&
      sameBadges(a.badges, b.badges) &&
      prev.onPress === next.onPress &&
      prev.onPressActor === next.onPressActor
    );
  },
);

function sameBadges(a: string[] | undefined, b: string[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((badge, i) => badge === b[i]);
}

const useStyles = makeStyles((c) => ({
  // A card on the page, as in the design: surface, hairline border, 14pt
  // corners, 8pt between cards.
  card: {
    flexDirection: 'row',
    gap: space.md,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    paddingHorizontal: 14,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  cardPressed: {
    backgroundColor: c.surfaceAlt,
  },
  body: {
    flex: 1,
    gap: 3,
  },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  // `textSubtle`, not `textFaint`: these carry information and must clear AA.
  sourceText: {
    ...type.eyebrow,
    textTransform: 'uppercase',
    color: c.textSubtle,
    flexShrink: 1,
  },
  spacer: {
    flex: 1,
    minWidth: space.sm,
  },
  time: {
    ...type.caption,
    fontFamily: font.medium,
    color: c.textSubtle,
  },
  name: {
    ...type.heading,
    color: c.text,
  },
  subtitle: {
    ...type.label,
    fontFamily: font.medium,
    color: c.textSubtle,
  },
  text: {
    ...type.bodyTight,
    color: c.textMuted,
  },
  // The measurement row: a rule, the tags on the left and the value on the
  // right where the eye lands for figures. Solid rather than the design's
  // dashed line: iOS does not draw a dashed border on one side only.
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
  },
  badgeText: {
    ...type.tag,
    color: c.textMuted,
  },
}));
