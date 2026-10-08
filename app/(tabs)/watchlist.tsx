import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { partyTag, withoutParty } from '@/lib/filing';
import { describe } from '@/providers/registry';
import { derivedTickerSubjects, isPartyHandle } from '@/store/derived';
import { useFeed } from '@/store/feed';
import { groupBySource, subjectKey, useWatchlist, type WatchedSubject } from '@/store/watchlist';
import { Avatar } from '@/ui/components/Avatar';
import { EmptyState } from '@/ui/components/EmptyState';
import { GroupMembers } from '@/ui/components/GroupMembers';
import { WatchActionsSheet } from '@/ui/components/WatchActionsSheet';
import { groupGlyph } from '@/ui/groupGlyph';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { font, radius, space, tint, type } from '@/ui/theme';

/** Manage screen: everything followed, a card per source, with mute and unfollow. */
export default function WatchlistScreen() {
  const c = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const subjects = useWatchlist((s) => s.subjects);
  const remove = useWatchlist((s) => s.remove);
  const setMute = useWatchlist((s) => s.setMute);
  const signals = useFeed((s) => s.signals);
  /** Group rows the user has opened to see their members. Not persisted. */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [acting, setActing] = useState<WatchedSubject | null>(null);
  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const sections = useMemo(() => {
    const groups = groupBySource(subjects);
    return [...groups.entries()].map(([source, items]) => ({
      source,
      title: describe(source).label,
      data: items.sort((a, b) => b.addedAt - a.addedAt),
    }));
  }, [subjects]);

  // The design's "cross-source overlap": the tickers a followed party trades
  // most, which the feed is already fetching into Insiders and Stocks. The same
  // derivation the feed uses, so the card names exactly what it fetches.
  const overlap = useMemo(() => {
    const derived = derivedTickerSubjects(subjects, signals, () => false);
    const tickers = [...new Set(derived.map((d) => d.handle))];
    const groups = [...new Set(derived.flatMap((d) => d.via))];
    return tickers.length > 0 ? { tickers, groups } : null;
  }, [subjects, signals]);

  if (subjects.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="list-outline"
          title="Nothing on your watchlist"
          body="Members of Congress, companies and policy topics you follow will be listed here, grouped by source."
          action={{ label: 'Follow something', icon: 'add', onPress: () => router.push('/add') }}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.source}:${item.handle}`}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          overlap ? (
            <Pressable
              onPress={() => router.push('/timeline')}
              style={({ pressed }) => [styles.overlap, pressed && styles.pressedCard]}
              accessibilityRole="button"
              accessibilityLabel={
                `Cross-source overlap. ${possessive(overlap.groups)} most-traded tickers are in your ` +
                `Insiders and Stocks: ${overlap.tickers.join(', ')}. See on Timeline.`
              }
            >
              <View style={styles.overlapHead}>
                <Ionicons name="git-merge-outline" size={16} color={c.accent} />
                <Text style={styles.overlapEyebrow}>Cross-source overlap</Text>
              </View>
              <Text style={styles.overlapText}>
                {possessive(overlap.groups)} most-traded tickers are in your Insiders and Stocks:
              </Text>
              <View style={styles.overlapFoot}>
                {overlap.tickers.map((t) => (
                  <Text key={t} style={styles.ticker}>
                    {t}
                  </Text>
                ))}
                <View style={styles.flex} />
                <Text style={styles.overlapLink}>See on Timeline</Text>
                <Ionicons name="chevron-forward" size={14} color={c.accent} />
              </View>
            </Pressable>
          ) : null
        }
        renderSectionHeader={({ section }) => (
          // The section's name in words: sources are told apart by name, and
          // the header announces the pair so a screen reader hears what the
          // count is of.
          <View
            style={styles.sectionHeader}
            accessible
            accessibilityRole="header"
            accessibilityLabel={`${section.title}, ${section.data.length} followed`}
          >
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>
              {section.data.length} follow{section.data.length === 1 ? '' : 's'}
            </Text>
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const key = subjectKey(item.source, item.handle);
          const isGroup = isPartyHandle(item.source, item.handle);
          const open = isGroup && expanded.has(key);
          const group = groupGlyph(item.source, item.handle);
          const party = partyTag(item.subtitle);
          const sub = party ? withoutParty(item.subtitle) : item.subtitle;
          const first = index === 0;
          const last = index === section.data.length - 1;
          const until =
            item.muted && item.mutedUntil != null
              ? `until ${new Date(item.mutedUntil).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`
              : 'until you unmute';

          // One card per source, drawn row by row: each row carries its share
          // of the border so the list can still recycle rows. Row-navigate and
          // the action buttons are siblings, never nested Pressables — nesting
          // renders a <button> inside a <button> on web.
          return (
            <View style={[styles.card, first && styles.cardFirst, last && styles.cardLast]}>
              <View style={[styles.row, !first && styles.rule]}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/subject/[source]/[handle]',
                      params: { source: item.source, handle: item.handle },
                    })
                  }
                  style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    `${item.displayName}${item.subtitle ? `, ${item.subtitle}` : ''}` +
                    `${item.muted ? `, muted ${until}` : ''}. View their filings.`
                  }
                >
                  <View style={item.muted && styles.dim}>
                    <Avatar
                      uri={item.avatarUrl}
                      name={item.displayName}
                      glyph={group?.glyph}
                      square={item.source === 'stocks' || item.source === 'insider'}
                      size={36}
                    />
                  </View>
                  <View style={styles.rowBody}>
                    <View style={styles.nameLine}>
                      <Text style={[styles.rowName, item.muted && styles.mutedName]} numberOfLines={1}>
                        {item.displayName}
                      </Text>
                      {party ? (
                        <View style={styles.party}>
                          <Text style={styles.partyText}>{party}</Text>
                        </View>
                      ) : null}
                    </View>
                    {item.muted ? (
                      <View style={styles.nameLine}>
                        <View style={styles.mutedTag}>
                          <Text style={styles.mutedTagText}>MUTED</Text>
                        </View>
                        <Text style={styles.rowSubtitle} numberOfLines={1}>
                          {until}
                        </Text>
                      </View>
                    ) : sub ? (
                      <Text style={styles.rowSubtitle} numberOfLines={1}>
                        {sub}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>

                {isGroup && (
                  <Pressable
                    onPress={() => toggleExpanded(key)}
                    style={styles.action}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    accessibilityLabel={open ? `Hide ${item.displayName} members` : `Show ${item.displayName} members`}
                  >
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={c.textMuted} />
                  </Pressable>
                )}

                {item.muted ? (
                  <Pressable
                    onPress={() => setMute(item.source, item.handle, false)}
                    style={styles.action}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: true }}
                    accessibilityLabel={`Unmute ${item.displayName}`}
                  >
                    <Ionicons name="notifications-off" size={20} color={c.accent} />
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => setActing(item)}
                    style={styles.action}
                    accessibilityRole="button"
                    accessibilityLabel={`Mute ${item.displayName}`}
                    accessibilityHint="Choose how long"
                  >
                    <Ionicons name="notifications-outline" size={20} color={c.textMuted} />
                  </Pressable>
                )}

                <Pressable
                  onPress={() => setActing(item)}
                  style={styles.action}
                  accessibilityRole="button"
                  accessibilityLabel={`Unfollow ${item.displayName}`}
                >
                  <Ionicons name="remove-circle-outline" size={20} color={c.textMuted} />
                </Pressable>
              </View>
              {open && <GroupMembers group={item} />}
            </View>
          );
        }}
      />

      <WatchActionsSheet
        subject={acting}
        onClose={() => setActing(null)}
        onSaveMute={(until) => {
          if (acting) setMute(acting.source, acting.handle, until);
          setActing(null);
        }}
        onUnfollow={() => {
          if (acting) remove(acting.source, acting.handle);
          setActing(null);
        }}
      />
    </View>
  );
}

/** "Republicans’", "Republicans’ and Democrats’". */
function possessive(names: readonly string[]): string {
  const owned = names.map((n) => (n.endsWith('s') ? `${n}’` : `${n}’s`));
  return owned.length > 1 ? `${owned.slice(0, -1).join(', ')} and ${owned[owned.length - 1]}` : (owned[0] ?? '');
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.bg,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: 10,
    paddingBottom: space.xxl,
  },
  flex: {
    flex: 1,
  },
  overlap: {
    borderRadius: radius.lg,
    paddingVertical: space.md,
    paddingHorizontal: 14,
    backgroundColor: tint(c.accent, 0.16),
  },
  pressedCard: {
    opacity: 0.85,
  },
  overlapHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overlapEyebrow: {
    ...type.eyebrow,
    fontFamily: font.bold,
    textTransform: 'uppercase',
    color: c.text,
  },
  overlapText: {
    ...type.body,
    color: c.text,
    marginTop: 6,
    marginBottom: space.sm,
  },
  overlapFoot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  ticker: {
    ...type.mono,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    color: c.text,
  },
  overlapLink: {
    ...type.label,
    color: c.text,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.lg,
    paddingBottom: space.sm,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    ...type.caption,
    fontFamily: font.semibold,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: c.textSubtle,
  },
  sectionCount: {
    ...type.caption,
    fontFamily: font.medium,
    color: c.textSubtle,
  },
  card: {
    backgroundColor: c.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    overflow: 'hidden',
  },
  cardFirst: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  cardLast: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 60,
    paddingRight: space.xs,
  },
  rule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingLeft: 14,
    alignSelf: 'stretch',
  },
  pressed: {
    backgroundColor: c.surfaceAlt,
  },
  dim: {
    opacity: 0.7,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowName: {
    ...type.body,
    lineHeight: 20,
    fontFamily: font.semibold,
    color: c.text,
    flexShrink: 1,
  },
  mutedName: {
    color: c.textMuted,
  },
  party: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
  },
  partyText: {
    ...type.tag,
    color: c.textMuted,
  },
  rowSubtitle: {
    ...type.caption,
    color: c.textSubtle,
    flexShrink: 1,
  },
  mutedTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: c.surfaceAlt,
  },
  mutedTagText: {
    ...type.tag,
    color: c.textMuted,
  },
  /** A real 44pt square, so neighbouring actions never share a tap region. */
  action: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
