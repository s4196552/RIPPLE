import { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { describe } from '@/providers/registry';
import type { Signal } from '@/providers/types';
import { relativeTime, spokenTime } from '@/lib/time';
import { makeStyles, useTheme } from '../ThemeProvider';
import { radius, space, tint, type } from '../theme';
import { markedLabel, spokenLabel, toneColor } from '../tone';
import { Avatar } from './Avatar';
import { SourceBadge } from './SourceBadge';

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

    // The avatar and the card body are siblings, never nested Pressables:
    // nesting renders a <button> inside a <button> on web, which is invalid
    // HTML and breaks keyboard focus. Press state is lifted so the highlight
    // still covers the whole row.
    return (
      <View style={[styles.card, pressed && styles.cardPressed]}>
        <Pressable
          onPress={() => onPressActor?.(signal)}
          disabled={!onPressActor}
          hitSlop={space.sm}
          accessibilityRole="button"
          accessibilityLabel={`View all signals from ${signal.actor.displayName}`}
        >
          <Avatar
            uri={signal.actor.avatarUrl}
            name={signal.actor.displayName}
            accent={source.color}
            square={signal.source === 'stocks' || signal.source === 'insider'}
          />
        </Pressable>

        <Pressable
          style={styles.body}
          onPress={() => onPress(signal)}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          accessibilityRole="button"
          // One natural phrase, and it carries everything the card shows
          // visually — badges and the accent chip included, since those are
          // information rather than decoration.
          accessibilityLabel={
            `${source.label}, ${spokenTime(signal.timestamp)}. ` +
            `${signal.text}` +
            `${signal.accent ? ` ${spokenLabel(signal.accent.tone, signal.accent.label)}.` : ''}` +
            `${signal.badges?.length ? ` ${signal.badges.join('. ')}.` : ''}`
          }
          accessibilityHint="Opens the original filing"
        >
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>
              {signal.actor.displayName}
            </Text>
            {signal.actor.subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {signal.actor.subtitle}
              </Text>
            ) : null}
            <Text style={styles.dot} accessibilityElementsHidden importantForAccessibility="no">
              ·
            </Text>
            <Text style={styles.time}>{relativeTime(signal.timestamp)}</Text>
            <View style={styles.spacer} />
            <SourceBadge source={signal.source} />
          </View>

          <Text style={styles.text}>{signal.text}</Text>

          <View style={styles.footer}>
            {signal.accent && (
              <View
                style={[
                  styles.chip,
                  { backgroundColor: tint(toneColor(signal.accent.tone, c), 0.16) },
                ]}
              >
                <Text style={[styles.chipText, { color: toneColor(signal.accent.tone, c) }]}>
                  {markedLabel(signal.accent.tone, signal.accent.label)}
                </Text>
              </View>
            )}

            {signal.badges?.map((badge) => (
              <View key={badge} style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ))}
          </View>
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
  card: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    backgroundColor: c.bg,
  },
  cardPressed: {
    backgroundColor: c.surface,
  },
  body: {
    flex: 1,
    gap: space.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  name: {
    ...type.label,
    color: c.text,
    flexShrink: 1,
  },
  // Handles, districts and timestamps carry information, so they use
  // `textMuted` (6.6:1) rather than `textFaint`, which fails AA at this size.
  subtitle: {
    ...type.caption,
    color: c.textMuted,
    flexShrink: 1,
  },
  dot: {
    ...type.caption,
    color: c.textFaint, // purely a separator glyph
  },
  time: {
    ...type.caption,
    color: c.textMuted,
  },
  spacer: {
    flex: 1,
    minWidth: space.sm,
  },
  text: {
    ...type.body,
    color: c.text,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.xs,
  },
  chip: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  chipText: {
    ...type.micro,
  },
  badge: {
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: c.surfaceAlt,
  },
  badgeText: {
    ...type.tag,
    color: c.textMuted,
  },
}));
