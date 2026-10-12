import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { ALL_DESCRIPTORS, getProvider } from '@/providers/registry';
import { openLink, tapFeedback } from '@/lib/feedback';
import { relativeTime } from '@/lib/time';
import { iconName } from '@/ui/icons';
import { usePreferences } from '@/store/preferences';
import { useFeed } from '@/store/feed';
import { useWatchlist } from '@/store/watchlist';
import { ProvenanceTag } from '@/ui/components/ProvenanceTag';
import { Segmented } from '@/ui/components/Segmented';
import { SourceBadge } from '@/ui/components/SourceBadge';
import { RippleLogo } from '@/ui/components/RippleLogo';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { font, radius, space, type } from '@/ui/theme';

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

  const theme = usePreferences((s) => s.theme);
  const tones = usePreferences((s) => s.tones);
  const haptics = usePreferences((s) => s.haptics);
  const dailyDigest = usePreferences((s) => s.dailyDigest);
  const setPreference = usePreferences((s) => s.set);

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
      <Section title="Profile">
        <Text style={styles.sectionNote}>
          How this install is set up. There is no account — these stay on this device.
        </Text>

        <ChoiceRow
          label="Theme"
          value={theme}
          onChange={(v) => setPreference('theme', v)}
          options={[
            { value: 'system', label: 'System' },
            // Short labels so all four fit one row on a phone; the full names
            // are what a screen reader hears.
            { value: 'dark', label: 'Blue', spoken: 'Dark blue' },
            { value: 'black', label: 'Black', spoken: 'True black' },
            { value: 'light', label: 'White' },
          ]}
          help="System follows your phone between Dark blue and White. The accent colours are the same in every mode."
        />

        <ChoiceRow
          label="Gains and losses"
          value={tones}
          onChange={(v) => setPreference('tones', v)}
          options={[
            { value: 'classic', label: 'Green / red' },
            { value: 'accessible', label: 'Teal / orange' },
          ]}
          help={
            tones === 'accessible'
              ? 'Colours chosen to stay distinct with red-green colour blindness.'
              : 'The usual pair. Hard to tell apart with red-green colour blindness.'
          }
          preview={<TonePreview />}
        />

        <SwitchRow
          label="Group the feed by day"
          value={dailyDigest}
          onChange={(v) => setPreference('dailyDigest', v)}
        />

        <SwitchRow
          label="Haptic feedback"
          value={haptics}
          onChange={(v) => setPreference('haptics', v)}
          disabled={Platform.OS === 'web'}
          help={Platform.OS === 'web' ? 'Not available in a browser.' : undefined}
        />
      </Section>

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
                <ProvenanceTag mode={mode} />
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md }}>
          <RippleLogo size={48} decorative />
          <Text style={{ ...type.heading, color: c.text }}>Ripple</Text>
        </View>
        <Text style={styles.sectionNote}>
          Ripple watches public disclosure feeds — congressional trade filings, SEC Form 4s and
          presidential actions — and puts them in one reverse-chronological list.
        </Text>
        <Text style={styles.disclaimer}>
          Not investment advice. Disclosure filings are self-reported, often report a range rather
          than an exact figure, and can arrive weeks after the trade they describe.
        </Text>

        <PageRow icon="sparkles-outline" label="Show introduction" href="/onboarding" />
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

/**
 * A labelled segmented control, with optional help copy underneath.
 *
 * The control itself is `Segmented`, which owns the radio semantics.
 */
function ChoiceRow<T extends string>({
  label,
  value,
  onChange,
  options,
  help,
  preview,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; spoken?: string }[];
  help?: string;
  preview?: React.ReactNode;
}) {
  const styles = useStyles();

  return (
    <View style={styles.choiceBlock}>
      <View style={styles.choiceHeader}>
        <Text style={styles.rowLabelStrong}>{label}</Text>
        {preview}
      </View>

      <Segmented label={label} value={value} onChange={onChange} options={options} fill />

      {/* Announced on change, because the copy is what explains the choice the
          user just made and nothing else on screen says it. */}
      {help ? (
        <Text style={styles.help} accessibilityLiveRegion="polite">
          {help}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Live swatches for the current tone pair.
 *
 * The words "teal" and "orange" mean nothing next to the actual colours, and
 * this is the one setting whose whole point is what it looks like. Marked
 * decorative: the choice is already announced by the radio it sits beside.
 */
function TonePreview() {
  const c = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.swatches} accessibilityElementsHidden importantForAccessibility="no">
      <View style={[styles.swatch, { backgroundColor: c.up }]} />
      <View style={[styles.swatch, { backgroundColor: c.down }]} />
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
  disabled = false,
  help,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  help?: string;
}) {
  const c = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.switchBlock}>
      <View style={styles.switchRow}>
        <Text style={[styles.rowLabelStrong, disabled && styles.disabledText]}>{label}</Text>
        <Switch
          value={value}
          onValueChange={(next) => {
            tapFeedback();
            onChange(next);
          }}
          disabled={disabled}
          trackColor={{ false: c.surfaceAlt, true: c.accent }}
          // White in both themes, like the platform switches. `onAccent` is
          // near-black in dark, which drew a dark knob on a dark track.
          thumbColor="#FFFFFF"
          // react-native-web ignores `thumbColor` once on and paints its own
          // Material teal unless told otherwise. Not in RN's types.
          {...({ activeThumbColor: '#FFFFFF' } as object)}
          ios_backgroundColor={c.surfaceAlt}
          accessibilityRole="switch"
          accessibilityLabel={label}
          accessibilityState={{ checked: value, disabled }}
        />
      </View>
      {help ? <Text style={styles.help}>{help}</Text> : null}
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
function PageRow({ icon, label, href }: { icon: string; label: string; href: '/terms' | '/onboarding' }) {
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
      <Ionicons name={iconName(icon)} size={16} color={c.textMuted} />
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
      onPress={() => void openLink(url, label)}
      style={({ pressed }) => [styles.row, styles.linkRow, pressed && styles.rowPressed]}
      accessibilityRole="link"
      accessibilityLabel={`${label}. Opens the page.`}
    >
      <Ionicons name={iconName(icon)} size={16} color={c.textMuted} />
      <Text style={styles.linkLabel}>{label}</Text>
      <Ionicons name="open-outline" size={14} color={c.textFaint} />
    </Pressable>
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
    ...type.label,
    color: c.textMuted,
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
    color: c.textMuted,
  },
  sourceRight: {
    alignItems: 'flex-end',
    gap: space.xs,
  },
  sourceCount: {
    ...type.caption,
    color: c.textMuted,
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
  choiceBlock: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  choiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  swatches: {
    flexDirection: 'row',
    gap: space.xs,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  switchBlock: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    gap: space.xs,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  disabledText: {
    color: c.textFaint,
  },
  help: {
    ...type.caption,
    color: c.textMuted,
    lineHeight: 17,
  },
  rowLabel: {
    ...type.bodyTight,
    color: c.textMuted,
    flexShrink: 1,
  },
  rowLabelStrong: {
    ...type.bodyTight,
    color: c.text,
    flexShrink: 1,
  },
  rowValue: {
    ...type.bodyTight,
    color: c.text,
    fontFamily: font.semibold,
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
  // Ink: the red-orange icon marks it destructive; the shared `down` tone is
  // below AA as small text on White.
  buttonText: {
    ...type.label,
    color: c.text,
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
    color: c.textMuted,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    lineHeight: 17,
  },
}));
