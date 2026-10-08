import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  DISCLOSURE_LIMIT_DAYS,
  assetName,
  disclosureLag,
  isLate,
  isoDate,
  partyTag,
  withoutParty,
} from '@/lib/filing';
import { hostLabel, pct } from '@/lib/format';
import { describe } from '@/providers/registry';
import { findSignal } from '@/store/signalCache';
import { Avatar } from '@/ui/components/Avatar';
import { Glyph } from '@/ui/components/Glyph';
import { TonePill } from '@/ui/components/TonePill';
import { glyph } from '@/ui/icons';
import { shareSignal } from '@/ui/signalActions';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { font, radius, space, type } from '@/ui/theme';
import { spokenLabel, type Tone } from '@/ui/tone';

const KIND: Record<string, string> = {
  congress: 'Periodic Transaction Report',
  insider: 'Form 4',
};

function toneOf(value: number): Tone {
  return value > 0 ? 'up' : value < 0 ? 'down' : 'neutral';
}

/**
 * One filing, in full: what was traded, by whom, for how much, how long the
 * public waited, and what the price has done since — with the original one
 * tap away at the bottom.
 */
export default function FilingScreen() {
  const c = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const signal = id ? findSignal(id) : undefined;

  useEffect(() => {
    if (!signal) return;
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => void shareSignal(signal)}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="Share this filing"
        >
          <Ionicons name="share-outline" size={22} color={c.text} />
        </Pressable>
      ),
    });
  }, [navigation, signal, c, styles]);

  if (!signal) {
    return (
      <View style={[styles.screen, styles.missing]}>
        <Text style={styles.missingText}>
          This filing is no longer loaded. Open it again from Signals or the member’s page.
        </Text>
      </View>
    );
  }

  const meta = describe(signal.source);
  const trade = signal.trade;
  const lag = disclosureLag(signal);
  const late = isLate(signal);
  const name = assetName(signal);
  const party = partyTag(signal.actor.subtitle);
  const place = withoutParty(signal.actor.subtitle);
  const r = signal.reaction;
  const action = trade?.action === 'sell' ? 'Sell' : 'Buy';
  // Badges the screen already says another way — the pill, the delay row.
  const badges = (signal.badges ?? []).filter((b) => !['BUY', 'SELL', 'LATE FILING'].includes(b));

  const open = () =>
    WebBrowser.openBrowserAsync(signal.url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      toolbarColor: c.bg,
      controlsColor: c.accent,
    });

  const rows: { label: string; value: string; mono?: boolean }[] = [
    ...(trade?.amountLabel ? [{ label: 'Amount, as filed', value: trade.amountLabel, mono: true }] : []),
    ...(trade?.kindLabel ? [{ label: 'Transaction', value: sentenceCase(trade.kindLabel) }] : []),
    ...(trade?.traderTitle && signal.source === 'insider' ? [{ label: 'Role', value: trade.traderTitle }] : []),
    ...(trade?.tradedAt != null ? [{ label: 'Traded', value: isoDate(trade.tradedAt), mono: true }] : []),
    { label: trade ? 'Disclosed' : 'Filed', value: isoDate(signal.timestamp), mono: true },
  ];

  const measures = r
    ? [
        { value: r.changePct, label: pct(r.changePct), caption: `${signal.ticker ?? 'Price'} move since filing` },
        ...(r.excessPct != null
          ? [
              {
                value: r.excessPct,
                label: pct(r.excessPct).replace('%', 'pp'),
                caption: `vs ${r.benchmarkSymbol ?? 'SPY'} from filing to today`,
              },
            ]
          : []),
      ]
    : [];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.kicker}>
          <Glyph glyph={glyph(meta.icon)} size={14} color={c.textSubtle} />
          <Text style={styles.kickerText}>
            {meta.label}
            {KIND[signal.source] ? ` · ${KIND[signal.source]}` : ''}
          </Text>
        </View>

        <View style={styles.titleRow}>
          {trade && <TonePill tone={trade.action === 'sell' ? 'down' : 'up'} label={action} variant="tag" />}
          <Text style={styles.title} accessibilityRole="header">
            {signal.ticker ? <Text style={styles.titleMono}>{signal.ticker}</Text> : null}
            {signal.ticker && name ? ' · ' : ''}
            {name ?? (signal.ticker ? '' : signal.text)}
          </Text>
        </View>

        <Pressable
          onPress={() =>
            router.push({
              pathname: '/subject/[source]/[handle]',
              params: { source: signal.source, handle: signal.actor.handle },
            })
          }
          style={({ pressed }) => [styles.actor, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${signal.actor.displayName}${signal.actor.subtitle ? `, ${signal.actor.subtitle}` : ''}. Open their page`}
        >
          <Avatar uri={signal.actor.avatarUrl} name={signal.actor.displayName} size={32} />
          <Text style={styles.actorName} numberOfLines={1}>
            {signal.actor.displayName}
          </Text>
          {party && (
            <View style={styles.party}>
              <Text style={styles.partyText}>{party}</Text>
            </View>
          )}
          {place ? <Text style={styles.actorPlace}>{place}</Text> : null}
          <View style={styles.flex} />
          <Ionicons name="chevron-forward" size={18} color={c.textSubtle} />
        </Pressable>

        {trade ? null : <Text style={styles.sentence}>{signal.text}</Text>}

        <View style={styles.table}>
          {rows.map((row, i) => (
            <View key={row.label} style={[styles.kv, i > 0 && styles.rule]}>
              <Text style={styles.dt}>{row.label}</Text>
              <Text style={[styles.dd, row.mono && styles.mono]}>{row.value}</Text>
            </View>
          ))}
          {lag !== null && (
            <View
              style={[styles.kv, styles.rule, styles.lagRow]}
              accessible
              accessibilityLabel={`Days to disclose: ${lag} of ${DISCLOSURE_LIMIT_DAYS} allowed. ${late ? 'Late' : 'On time'}.`}
            >
              <View style={styles.lagHead}>
                <Text style={styles.dt}>Days to disclose</Text>
                <View style={styles.lagValue}>
                  {late && <Ionicons name="warning" size={14} color={c.warning} />}
                  <Text style={styles.dd}>
                    <Text style={styles.mono}>{lag}</Text> of {DISCLOSURE_LIMIT_DAYS} allowed · {late ? 'late' : 'on time'}
                  </Text>
                </View>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.min(100, (lag / DISCLOSURE_LIMIT_DAYS) * 100)}%`,
                      backgroundColor: late ? c.warning : c.accent,
                    },
                  ]}
                />
                <View style={styles.limit} />
              </View>
            </View>
          )}
        </View>

        {badges.length > 0 && (
          <View style={styles.badges}>
            {badges.map((badge) => (
              <View key={badge} style={styles.badge}>
                <Text style={styles.badgeText}>{badge}</Text>
              </View>
            ))}
          </View>
        )}

        {measures.length > 0 && (
          <View>
            <Text style={styles.section}>Measured</Text>
            <View style={styles.tiles}>
              {measures.map((m) => (
                <View
                  key={m.caption}
                  style={styles.tile}
                  accessible
                  accessibilityLabel={`${spokenLabel(toneOf(m.value), m.label)}, ${m.caption}`}
                >
                  <TonePill tone={toneOf(m.value)} label={m.label} />
                  <Text style={styles.tileCaption}>{m.caption}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => void open()}
          style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}
          accessibilityRole="link"
          accessibilityLabel={`Open original filing on ${hostLabel(signal.url)}`}
        >
          <Text style={styles.primaryText}>Open original filing</Text>
          <Ionicons name="open-outline" size={18} color={c.onAccent} />
        </Pressable>
        <Text style={styles.footNote}>Opens {hostLabel(signal.url)}</Text>
      </View>
    </View>
  );
}

function sentenceCase(s: string): string {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.bg,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.xl,
    gap: space.md,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missing: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  missingText: {
    ...type.body,
    color: c.textMuted,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.75,
  },
  flex: {
    flex: 1,
  },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kickerText: {
    ...type.eyebrow,
    textTransform: 'uppercase',
    color: c.textSubtle,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: font.bold,
    color: c.text,
    flexShrink: 1,
  },
  titleMono: {
    fontFamily: font.monoSemibold,
  },
  actor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  actorName: {
    ...type.body,
    fontFamily: font.semibold,
    color: c.text,
    flexShrink: 1,
  },
  party: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
  },
  partyText: {
    ...type.micro,
    fontFamily: font.bold,
    letterSpacing: 0.6,
    color: c.textMuted,
  },
  actorPlace: {
    ...type.label,
    fontFamily: font.medium,
    color: c.textSubtle,
  },
  sentence: {
    ...type.body,
    color: c.textMuted,
  },
  table: {
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  rule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  dt: {
    ...type.bodyTight,
    color: c.textMuted,
  },
  dd: {
    ...type.bodyTight,
    fontFamily: font.semibold,
    color: c.text,
    textAlign: 'right',
    flexShrink: 1,
  },
  mono: {
    fontFamily: font.monoSemibold,
    fontVariant: ['tabular-nums'],
  },
  lagRow: {
    flexDirection: 'column',
    gap: space.sm,
  },
  lagHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
  },
  lagValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.surfaceAlt,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
  },
  // The 45-day mark.
  limit: {
    position: 'absolute',
    right: 0,
    top: -3,
    width: 2,
    height: 12,
    backgroundColor: c.textMuted,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
  },
  badgeText: {
    ...type.tag,
    color: c.textMuted,
  },
  section: {
    ...type.caption,
    fontFamily: font.semibold,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: c.textSubtle,
    marginBottom: space.sm,
    marginHorizontal: 2,
  },
  tiles: {
    flexDirection: 'row',
    gap: space.sm,
  },
  tile: {
    flex: 1,
    gap: 6,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: space.md,
  },
  tileCaption: {
    ...type.caption,
    color: c.textMuted,
  },
  footer: {
    paddingTop: 10,
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    backgroundColor: c.surface,
  },
  primary: {
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: c.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: 20,
  },
  primaryText: {
    ...type.body,
    fontSize: 16,
    fontFamily: font.semibold,
    color: c.onAccent,
  },
  footNote: {
    ...type.caption,
    color: c.textSubtle,
    textAlign: 'center',
    marginTop: space.sm,
  },
}));
