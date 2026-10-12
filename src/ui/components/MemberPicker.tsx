import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { isAbort } from '@/lib/http';
import { getProvider } from '@/providers/registry';
import type { SubjectResult } from '@/providers/types';
import { subjectKey, useWatchlist } from '@/store/watchlist';
import { makeStyles, useTheme } from '../ThemeProvider';
import { radius, space, tint, type } from '../theme';
import { Avatar } from './Avatar';

/** Rows shown before "Show all", so a party of 200 filers does not bury the list. */
const PREVIEW = 8;

/**
 * The members inside a Congress group, opened under its row in the Follow
 * flow: each with its own Follow button, and one to follow them all.
 *
 * Following the group already brings in every member's trades; this is for
 * wanting them on the watchlist one by one — to mute a single member, say, or
 * to keep following them if the group is dropped. Members are fetched on
 * first open, not for every group on screen.
 */
export function MemberPicker({ group }: { group: SubjectResult }) {
  const c = useTheme();
  const styles = useStyles();
  const provider = getProvider(group.source);
  const subjects = useWatchlist((s) => s.subjects);
  const addMany = useWatchlist((s) => s.addMany);

  const [members, setMembers] = useState<SubjectResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!provider.groupMembers) return;
    const controller = new AbortController();
    setFailed(false);
    provider
      .groupMembers(group.handle, controller.signal)
      .then((list) => setMembers(list ?? []))
      .catch((err) => {
        if (!isAbort(err)) setFailed(true);
      });
    return () => controller.abort();
  }, [provider, group.handle]);

  const followed = new Set(subjects.map((s) => subjectKey(s.source, s.handle)));
  const isFollowing = (m: SubjectResult) => followed.has(subjectKey(m.source, m.handle));
  const unfollowed = members?.filter((m) => !isFollowing(m)) ?? [];
  const visible = members && !showAll ? members.slice(0, PREVIEW) : members;

  const follow = (list: SubjectResult[]) => {
    const added = addMany(list);
    if (added === 0) return;
    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    AccessibilityInfo.announceForAccessibility(
      added === 1 ? `Following ${list[0]!.displayName}` : `Following ${added} members`,
    );
  };

  return (
    <View style={styles.panel}>
      {members === null && !failed && (
        <View style={styles.status}>
          <ActivityIndicator size="small" color={c.textMuted} />
          <Text style={styles.statusText}>Finding members…</Text>
        </View>
      )}
      {failed && (
        <Text style={styles.statusText} accessibilityLiveRegion="polite">
          Couldn’t load members. Close this list and open it again to retry.
        </Text>
      )}
      {members && members.length === 0 && (
        <Text style={styles.statusText}>No member of this group has filed a trade report yet.</Text>
      )}

      {members && members.length > 0 && (
        <View style={styles.head}>
          <Text style={styles.headText}>
            {members.length} member{members.length === 1 ? '' : 's'} with trade filings
          </Text>
          {unfollowed.length > 0 ? (
            <Pressable
              onPress={() => follow(unfollowed)}
              style={({ pressed }) => [styles.followAll, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={
                unfollowed.length === members.length
                  ? `Follow all ${members.length} ${group.displayName} members`
                  : `Follow the other ${unfollowed.length} ${group.displayName} members`
              }
            >
              <Ionicons name="add" size={16} color={c.onAccent} />
              <Text style={styles.followAllText}>
                {unfollowed.length === members.length ? 'Follow all' : `Follow ${unfollowed.length} more`}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.allDone} accessible accessibilityLabel={`Following every ${group.displayName} member`}>
              <Ionicons name="checkmark" size={16} color={c.accent} />
              <Text style={styles.memberFollowText}>Following all</Text>
            </View>
          )}
        </View>
      )}

      {visible?.map((m) => {
        const following = isFollowing(m);
        return (
          <View key={m.handle} style={styles.member}>
            <Avatar uri={m.avatarUrl} name={m.displayName} size={32} />
            <View style={styles.memberBody}>
              <Text style={styles.memberName} numberOfLines={1}>
                {m.displayName}
              </Text>
              {m.subtitle ? (
                <Text style={styles.memberSubtitle} numberOfLines={1}>
                  {m.subtitle}
                </Text>
              ) : null}
            </View>
            {following ? (
              <View style={styles.memberFollowing} accessible accessibilityLabel={`Following ${m.displayName}`}>
                <Ionicons name="checkmark" size={14} color={c.accent} />
                <Text style={styles.memberFollowText}>Following</Text>
              </View>
            ) : (
              <Pressable
                onPress={() => follow([m])}
                style={({ pressed }) => [styles.memberFollow, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Follow ${m.displayName}${m.subtitle ? `, ${m.subtitle}` : ''}`}
              >
                <Ionicons name="add" size={14} color={c.accent} />
                <Text style={styles.memberFollowText}>Follow</Text>
              </Pressable>
            )}
          </View>
        );
      })}

      {members && members.length > PREVIEW && (
        <Pressable
          onPress={() => setShowAll((v) => !v)}
          style={styles.more}
          accessibilityRole="button"
          accessibilityState={{ expanded: showAll }}
          accessibilityLabel={showAll ? 'Show fewer members' : `Show all ${members.length} members`}
        >
          <Text style={styles.moreText}>{showAll ? 'Show fewer' : `Show all ${members.length} members`}</Text>
        </Pressable>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  // Sunk into the page colour under its group's row, with a rail down the
  // left, as the watchlist draws an opened party.
  panel: {
    backgroundColor: c.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    paddingLeft: space.lg,
    paddingRight: space.md,
    paddingVertical: space.sm,
    gap: 2,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingBottom: space.xs,
  },
  headText: {
    ...type.caption,
    color: c.textMuted,
    flex: 1,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  statusText: {
    ...type.caption,
    color: c.textMuted,
    paddingVertical: space.sm,
  },
  followAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: c.accent,
  },
  followAllText: {
    ...type.label,
    fontSize: 14,
    color: c.onAccent,
  },
  allDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: tint(c.accent, 0.16),
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    paddingVertical: space.xs,
    borderLeftWidth: 2,
    borderLeftColor: c.border,
    paddingLeft: space.md,
  },
  memberBody: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  memberName: {
    ...type.label,
    color: c.text,
  },
  memberSubtitle: {
    ...type.caption,
    color: c.textMuted,
  },
  memberFollow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: c.accent,
  },
  memberFollowing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: 22,
    backgroundColor: tint(c.accent, 0.16),
  },
  memberFollowText: {
    ...type.label,
    color: c.text,
  },
  pressed: {
    opacity: 0.8,
  },
  more: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  moreText: {
    ...type.label,
    color: c.text,
    textDecorationLine: 'underline',
  },
}));
