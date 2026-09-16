import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { describe } from '@/providers/registry';
import type { SourceId } from '@/providers/types';
import { groupBySource, useWatchlist, type WatchedSubject } from '@/store/watchlist';
import { Avatar } from '@/ui/components/Avatar';
import { EmptyState } from '@/ui/components/EmptyState';
import { SourceBadge } from '@/ui/components/SourceBadge';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { radius, space, tint, type } from '@/ui/theme';

/** Manage screen: everything watched, grouped by source, with mute + remove. */
export default function WatchlistScreen() {
  const c = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const subjects = useWatchlist((s) => s.subjects);
  const remove = useWatchlist((s) => s.remove);
  const toggleMute = useWatchlist((s) => s.toggleMute);

  const sections = useMemo(() => {
    const groups = groupBySource(subjects);
    return [...groups.entries()].map(([source, items]) => ({
      source,
      title: describe(source).label,
      data: items.sort((a, b) => b.addedAt - a.addedAt),
    }));
  }, [subjects]);

  const confirmRemove = (subject: WatchedSubject) => {
    Alert.alert(
      `Stop following ${subject.displayName}?`,
      'Their signals will be removed from your feed. You can add them again any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unfollow',
          style: 'destructive',
          onPress: () => remove(subject.source, subject.handle),
        },
      ],
    );
  };

  if (subjects.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="list-outline"
          title="Nothing on your watchlist"
          body="Members of Congress, companies and policy topics you follow will be listed here, grouped by source."
          action={{ label: 'Add a subject', onPress: () => router.push('/add') }}
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
        renderSectionHeader={({ section }) => (
          // The badge carries the source name but is hidden from assistive tech
          // (it is decorative on feed cards, where the name is already in the
          // card's label). Here it is the only thing naming the group, so the
          // header announces the pair itself — otherwise a screen reader heard
          // a bare "2 followed" with no idea what of.
          <View
            style={styles.sectionHeader}
            accessible
            accessibilityRole="header"
            accessibilityLabel={`${section.title}, ${section.data.length} followed`}
          >
            <SourceBadge source={section.source as SourceId} showLabel size={22} />
            <Text style={styles.sectionCount}>{section.data.length} followed</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const meta = describe(item.source);
          // Row-navigate and the two action buttons are siblings, never nested
          // Pressables — nesting renders a <button> inside a <button> on web.
          return (
            <View style={styles.row}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/subject/[source]/[handle]',
                    params: { source: item.source, handle: item.handle },
                  })
                }
                style={({ pressed }) => [styles.rowMain, pressed && styles.rowPressed]}
                accessibilityRole="button"
                accessibilityLabel={
                  `${item.displayName}${item.subtitle ? `, ${item.subtitle}` : ''}` +
                  `${item.muted ? ', muted' : ''}. View their signals.`
                }
              >
                <Avatar
                  uri={item.avatarUrl}
                  name={item.displayName}
                  accent={meta.color}
                  square={item.source === 'stocks' || item.source === 'insider'}
                  size={38}
                />

                <View style={styles.rowBody}>
                  <View style={styles.rowTitle}>
                    <Text
                      style={[styles.rowName, item.muted && styles.mutedText]}
                      numberOfLines={1}
                    >
                      {item.displayName}
                    </Text>
                    {item.muted && (
                      <View style={styles.mutedTag}>
                        <Text style={styles.mutedTagText}>MUTED</Text>
                      </View>
                    )}
                  </View>
                  {item.subtitle ? (
                    <Text style={styles.rowSubtitle} numberOfLines={1}>
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
              </Pressable>

              <Pressable
                onPress={() => toggleMute(item.source, item.handle)}
                style={styles.action}
                accessibilityRole="switch"
                accessibilityState={{ checked: item.muted }}
                accessibilityLabel={
                  item.muted ? `Unmute ${item.displayName}` : `Mute ${item.displayName}`
                }
              >
                <Ionicons
                  name={item.muted ? 'notifications-off' : 'notifications-outline'}
                  size={18}
                  color={item.muted ? c.warning : c.textMuted}
                />
              </Pressable>

              <Pressable
                onPress={() => confirmRemove(item)}
                style={styles.action}
                accessibilityRole="button"
                accessibilityLabel={`Stop following ${item.displayName}`}
              >
                <Ionicons name="close" size={18} color={c.textMuted} />
              </Pressable>
            </View>
          );
        }}
        ListFooterComponent={
          <Pressable
            onPress={() => router.push('/add')}
            style={({ pressed }) => [styles.addRow, pressed && styles.rowPressed]}
            accessibilityRole="button"
            accessibilityLabel="Add another subject to your watchlist"
          >
            <View style={styles.addIcon}>
              <Ionicons name="add" size={20} color={c.accent} />
            </View>
            <Text style={styles.addText}>Add another subject</Text>
          </Pressable>
        }
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.bg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.sm,
  },
  sectionCount: {
    ...type.caption,
    color: c.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  rowPressed: {
    backgroundColor: c.surface,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  rowName: {
    ...type.label,
    color: c.text,
    flexShrink: 1,
  },
  mutedText: {
    color: c.textMuted,
  },
  rowSubtitle: {
    ...type.caption,
    color: c.textMuted,
  },
  mutedTag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: tint(c.warning, 0.16),
  },
  mutedTagText: {
    ...type.tag,
    color: c.warning,
  },
  /**
   * A real 44pt square rather than a small icon padded out with `hitSlop`.
   *
   * These two sit 8pt apart, and each previously carried 12pt of slop — so
   * their tap regions overlapped by 16pt and the row had a band where "mute"
   * and "unfollow" both claimed the touch. Sizing the control itself makes the
   * target honest and keeps the two from colliding.
   */
  action: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    marginTop: space.sm,
  },
  addIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tint(c.accent, 0.12),
  },
  addText: {
    ...type.label,
    color: c.accent,
  },
}));
