import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ALL_DESCRIPTORS, getProvider } from '@/providers/registry';
import type { ProviderMode } from '@/providers/types';
import { relativeTime } from '@/lib/time';
import { useFeed } from '@/store/feed';
import { useWatchlist } from '@/store/watchlist';
import { SourceBadge } from '@/ui/components/SourceBadge';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { radius, space, tint, type } from '@/ui/theme';

/**
 * Settings — where the app accounts for itself.
 *
 * Deliberately not a pile of toggles. The useful thing to expose here is
 * *provenance*: which sources are live right now, which are running keyless,
 * and where each one's data actually comes from. A tracker that quietly
 * degrades to sample data is worse than one that says so, and this is the
 * screen where a user can check without reading the source.
 */
export default function SettingsScreen() {
  const c = useTheme();
  const styles = useStyles();
  const subjects = useWatchlist((s) => s.subjects);
  const signals = useFeed((s) => s.signals);
  const lastUpdated = useFeed((s) => s.lastUpdated);
  const resetFeed = useFeed((s) => s.reset);
  const [cleared, setCleared] = useState(false);

  const paused = subjects.filter((s) => s.muted).length;

  const confirmClearCache = () => {
    Alert.alert(
      'Clear cached signals?',
      'Your watchlist is kept. The feed empties and refills on the next refresh.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            resetFeed();
            setCleared(true);
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Section title="Sources">
        <Text style={styles.sectionNote}>
          Every source is public data. Nothing here is behind a login, and nothing you follow
          leaves your device.
        </Text>

        {ALL_DESCRIPTORS.map((descriptor) => {
          const mode = getProvider(descriptor.id).mode();
          const following = subjects.filter((s) => s.source === descriptor.id).length;

          return (
            <View key={descriptor.id} style={styles.sourceRow}>
              <SourceBadge source={descriptor.id} size={26} />
              <View style={styles.sourceBody}>
                <Text style={styles.sourceName}>{descriptor.label}</Text>
                <Text style={styles.sourceMeta} numberOfLines={2}>
                  {descriptor.provenance}
                </Text>
              </View>
              <View style={styles.sourceRight}>
                <ModePill mode={mode} />
                <Text style={styles.sourceCount}>
                  {following} following
                </Text>
              </View>
            </View>
          );
        })}
      </Section>

      <Section title="Data">
        <Row label="Subjects followed" value={String(subjects.length)} />
        {paused > 0 && <Row label="Paused" value={String(paused)} />}
        <Row label="Signals cached" value={String(signals.length)} />
        <Row
          label="Last refreshed"
          value={lastUpdated ? `${relativeTime(lastUpdated)} ago` : 'Never'}
        />
        <Row label="Refresh interval" value="Every 10 minutes, while open" />

        <Pressable
          onPress={confirmClearCache}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Clear cached signals. Your watchlist is kept."
        >
          <Ionicons name="trash-outline" size={16} color={c.down} />
          <Text style={styles.buttonText}>Clear cached signals</Text>
        </Pressable>

        {cleared && (
          <Text style={styles.cleared} accessibilityLiveRegion="polite">
            Cleared. Pull to refresh on the Signals tab to refill.
          </Text>
        )}
      </Section>

      <Section title="About">
        <Text style={styles.sectionNote}>
          Ripple watches public disclosure feeds — congressional trade filings, SEC Form 4s and
          presidential actions — and puts them in one reverse-chronological list.
        </Text>
        <Text style={styles.disclaimer}>
          Not investment advice. Disclosure filings are self-reported, often report a range rather
          than an exact figure, and can arrive weeks after the trade they describe.
        </Text>

        <PageRow icon="reader-outline" label="Terms of Service" href="/terms" />

        <LinkRow
          icon="document-text-outline"
          label="House Clerk disclosures"
          url="https://disclosures-clerk.house.gov/PublicDisclosure"
        />
        <LinkRow icon="business-outline" label="SEC EDGAR" url="https://www.sec.gov/edgar" />
        <LinkRow
          icon="newspaper-outline"
          label="Federal Register"
          url="https://www.federalregister.gov/"
        />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    // Grouped, or a screen reader reads every label and every value as separate
    // stops and the pairing has to be inferred from order.
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/**
 * A row that goes to another screen in the app.
 *
 * Distinct from `LinkRow` on purpose: the trailing chevron and the absence of
 * "opens in a browser" are the only cues that this one stays inside Ripple,
 * and a screen reader gets the difference through the role rather than by
 * inference.
 */
function PageRow({ icon, label, href }: { icon: string; label: string; href: '/terms' }) {
  const c = useTheme();
  const styles = useStyles();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.row, styles.linkRow, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon as never} size={16} color={c.textMuted} />
      <Text style={styles.linkLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={14} color={c.textFaint} />
    </Pressable>
  );
}

function LinkRow({ icon, label, url }: { icon: string; label: string; url: string }) {
  const c = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={() => {
        // The in-app browser keeps the user in Ripple; falling back to the
        // system browser matters on web, where there is no such thing.
        void WebBrowser.openBrowserAsync(url, {
          toolbarColor: c.bg,
          controlsColor: c.accent,
        }).catch(() => Linking.openURL(url));
      }}
      style={({ pressed }) => [styles.row, styles.linkRow, pressed && styles.rowPressed]}
      accessibilityRole="link"
      accessibilityLabel={`${label}. Opens in a browser.`}
    >
      <Ionicons name={icon as never} size={16} color={c.textMuted} />
      <Text style={styles.linkLabel}>{label}</Text>
      <Ionicons name="open-outline" size={14} color={c.textFaint} />
    </Pressable>
  );
}

/** The same honesty as the source picker, in the place people go to check. */
function ModePill({ mode }: { mode: ProviderMode }) {
  const c = useTheme();
  const styles = useStyles();
  const config: Record<ProviderMode, { label: string; tone: string }> = {
    live: { label: 'LIVE · KEYED', tone: c.accent },
    public: { label: 'LIVE · NO KEY', tone: c.up },
    mock: { label: 'OFFLINE SAMPLE', tone: c.warning },
  };
  const { label, tone } = config[mode];

  return (
    <View style={[styles.modePill, { backgroundColor: tint(tone, 0.16) }]}>
      <Text style={[styles.modePillText, { color: tone }]}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.bg,
  },
  content: {
    padding: space.lg,
    gap: space.xl,
    paddingBottom: space.xxl,
  },
  section: {
    gap: space.sm,
  },
  sectionTitle: {
    ...type.micro,
    color: c.textMuted,
    textTransform: 'uppercase',
    paddingLeft: space.xs,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    overflow: 'hidden',
  },
  sectionNote: {
    ...type.bodyTight,
    color: c.textMuted,
    padding: space.lg,
    paddingBottom: space.sm,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  sourceBody: {
    flex: 1,
    gap: 2,
  },
  sourceName: {
    ...type.label,
    color: c.text,
  },
  sourceMeta: {
    ...type.caption,
    color: c.textSubtle,
  },
  sourceRight: {
    alignItems: 'flex-end',
    gap: space.xs,
  },
  sourceCount: {
    ...type.caption,
    color: c.textMuted,
  },
  modePill: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  modePillText: {
    ...type.tag,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  rowPressed: {
    backgroundColor: c.surfaceAlt,
  },
  rowLabel: {
    ...type.bodyTight,
    color: c.textMuted,
    flexShrink: 1,
  },
  rowValue: {
    ...type.bodyTight,
    color: c.text,
    fontWeight: '600',
  },
  linkRow: {
    justifyContent: 'flex-start',
  },
  linkLabel: {
    ...type.bodyTight,
    color: c.text,
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  buttonPressed: {
    backgroundColor: c.surfaceAlt,
  },
  buttonText: {
    ...type.label,
    color: c.down,
  },
  cleared: {
    ...type.caption,
    color: c.textMuted,
    padding: space.md,
    paddingTop: 0,
    textAlign: 'center',
  },
  disclaimer: {
    ...type.caption,
    color: c.textSubtle,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    lineHeight: 17,
  },
}));
