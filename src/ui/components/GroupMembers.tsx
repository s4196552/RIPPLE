import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { isAbort } from '@/lib/http';
import { getProvider } from '@/providers/registry';
import type { SubjectResult } from '@/providers/types';
import { MAX_DERIVED_TICKERS, derivedTickerSubjects, topTickers } from '@/store/derived';
import { useFeed } from '@/store/feed';
import { useWatchlist, type WatchedSubject } from '@/store/watchlist';
import { makeStyles, useTheme } from '../ThemeProvider';
import { radius, space, type } from '../theme';
import { Avatar } from './Avatar';

/** Rows shown before "Show all", so a party of 200 filers does not bury the list. */
const PREVIEW = 8;

/**
 * What sits inside a followed group: its members, and the tickers it puts in
 * the Insiders and Stocks sources.
 *
 * Rendered under the group's watchlist row when expanded. Members come from the
 * provider's `groupMembers`, fetched on first expand rather than for every
 * group on screen. Each opens that member's own page, which carries its own
 * Follow button — following the party does not follow its members one by one.
 */
export function GroupMembers({ group }: { group: WatchedSubject }) {
  const c = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const provider = getProvider(group.source);

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

  // The same derivation the feed fetches with — across the whole watchlist,
  // so the cap shared between groups applies here too — read back from what
  // the feed holds, so this line names exactly the tickers it is showing. A
  // directly followed ticker still counts: it is in the feed either way.
  const signals = useFeed((s) => s.signals);
  const subjects = useWatchlist((s) => s.subjects);
  const tickers = useMemo(() => {
    const derived = derivedTickerSubjects(subjects, signals, () => false);
    return [
      ...new Set(derived.filter((d) => d.via.includes(group.displayName)).map((d) => d.handle)),
    ];
  }, [group.displayName, subjects, signals]);
  // Traded tickers that missed the shared cap, taken by groups listed earlier.
  const overCap = useMemo(
    () =>
      tickers.length === 0 &&
      topTickers(
        signals.filter(
          (s) => s.source === 'congress' && s.actor.handle.toLowerCase() === group.handle.toLowerCase(),
        ),
        1,
      ).length > 0,
    [tickers, signals, group.handle],
  );

  const visible = members && !showAll ? members.slice(0, PREVIEW) : members;

  return (
    <View style={styles.sunk}>
      <View style={styles.panel}>
        <View style={styles.tickerBox} accessible accessibilityRole="text">
          <Ionicons name="git-branch-outline" size={14} color={c.textMuted} />
          <Text style={styles.tickerText}>
            {group.muted
              ? 'Muted, so their most-traded tickers are left out of your Insiders and Stocks too.'
              : tickers.length > 0
                ? `Their most-traded tickers are in your Insiders and Stocks: ${tickers.join(', ')}.`
                : overCap
                  ? `Your other groups already fill the ${MAX_DERIVED_TICKERS} tickers fetched into Insiders and Stocks, so none of theirs are added.`
                  : 'Their most-traded tickers will join your Insiders and Stocks after the next refresh.'}
          </Text>
        </View>

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

        {visible?.map((m) => (
          <Pressable
            key={m.handle}
            onPress={() =>
              router.push({
                pathname: '/subject/[source]/[handle]',
                params: { source: m.source, handle: m.handle },
              })
            }
            style={({ pressed }) => [styles.member, pressed && styles.memberPressed]}
            accessibilityRole="button"
            accessibilityLabel={`${m.displayName}${m.subtitle ? `, ${m.subtitle}` : ''}. View their filings.`}
          >
            <Avatar uri={m.avatarUrl} name={m.displayName} size={30} />
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
            <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
          </Pressable>
        ))}

        {members && members.length > PREVIEW && (
          <Pressable
            onPress={() => setShowAll((v) => !v)}
            style={styles.more}
            accessibilityRole="button"
            accessibilityLabel={showAll ? 'Show fewer members' : `Show all ${members.length} members`}
          >
            <Text style={styles.moreText}>
              {showAll ? 'Show fewer' : `Show all ${members.length} members`}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  // Sunk into the page colour under its group's row, with a rail down the
  // left, as the design's watchlist draws an opened party.
  panel: {
    marginLeft: 26,
    paddingLeft: 20,
    paddingRight: 14,
    paddingVertical: space.sm,
    gap: 2,
    borderLeftWidth: 2,
    borderLeftColor: c.border,
  },
  sunk: {
    backgroundColor: c.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  tickerBox: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'flex-start',
    padding: space.sm,
    marginBottom: space.xs,
    borderRadius: radius.md,
    backgroundColor: c.surfaceAlt,
  },
  tickerText: {
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
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 44,
    paddingVertical: space.xs,
    borderRadius: radius.md,
  },
  memberPressed: {
    backgroundColor: c.surfaceAlt,
  },
  memberBody: {
    flex: 1,
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
  more: {
    minHeight: 44,
    justifyContent: 'center',
  },
  moreText: {
    ...type.label,
    color: c.text,
    textDecorationLine: 'underline',
  },
}));
