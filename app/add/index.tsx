import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ALL_DESCRIPTORS, getProvider } from '@/providers/registry';
import type { ProviderMode } from '@/providers/types';
import { useWatchlist } from '@/store/watchlist';
import { iconName } from '@/ui/icons';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { radius, space, tint, type } from '@/ui/theme';

/**
 * Step 1 of the add flow: the source picker.
 *
 * The grid is generated from the provider registry, so a newly registered
 * source appears here with no change to this file.
 */
export default function SourcePickerScreen() {
  const styles = useStyles();
  const router = useRouter();
  const subjects = useWatchlist((s) => s.subjects);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.lede}>What do you want to keep an eye on?</Text>

      <View style={styles.grid}>
        {ALL_DESCRIPTORS.map((s) => {
          const count = subjects.filter((w) => w.source === s.id).length;
          const mode = getProvider(s.id).mode();

          return (
            <Pressable
              key={s.id}
              onPress={() => router.push(`/add/${s.id}`)}
              style={({ pressed }) => [
                styles.tile,
                { borderColor: tint(s.color, 0.35), backgroundColor: tint(s.color, 0.07) },
                pressed && styles.tilePressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                `${s.label}. ${s.blurb}. Source: ${s.provenance}. ` +
                // The mode tag is a colour-coded pill and nothing else, so
                // without this a screen reader could not tell live data from an
                // offline sample — the one thing the tag exists to say.
                `${MODE_SPOKEN[mode]}. ` +
                `${count > 0 ? `${count} already followed.` : 'None followed yet.'}`
              }
            >
              <View style={[styles.tileIcon, { backgroundColor: tint(s.color, 0.18) }]}>
                <Ionicons name={iconName(s.icon)} size={24} color={s.color} />
              </View>

              <Text style={styles.tileLabel}>{s.label}</Text>
              <Text style={styles.tileBlurb} numberOfLines={3}>
                {s.blurb}
              </Text>

              <View style={styles.tileFooter}>
                <ModeTag mode={mode} color={s.color} />
                <Text style={styles.tileMeta} numberOfLines={1}>
                  {count > 0 ? `${count} following` : s.provenance}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* The last sentence used to read "See src/providers/registry.ts to add
          more" — a note to whoever was building the app, shipped to whoever is
          using it. */}
      <Text style={styles.note}>
        Every source above is public data. Congress trade filings come from the House Clerk;
        insider trades from SEC EDGAR; executive actions from the Federal Register.
      </Text>
    </ScrollView>
  );
}

/** Spoken form of each mode, for the tile's accessibility label. */
const MODE_SPOKEN: Record<ProviderMode, string> = {
  live: 'Live data, using your API key',
  public: 'Live data, no key needed',
  mock: 'Offline sample data, not live',
};

/**
 * Honest labelling of where a source's data is coming from, so degraded data is
 * never mistaken for the real thing.
 */
function ModeTag({ mode, color }: { mode: ProviderMode; color: string }) {
  const c = useTheme();
  const styles = useStyles();
  const config: Record<ProviderMode, { label: string; tone: string }> = {
    live: { label: 'LIVE · KEYED', tone: color },
    public: { label: 'LIVE · NO KEY', tone: c.up },
    mock: { label: 'OFFLINE SAMPLE', tone: c.warning },
  };
  const { label, tone } = config[mode];

  return (
    // Spoken as part of the tile's own label, so it is skipped here rather than
    // read out a second time in its abbreviated, punctuation-heavy form.
    <View
      style={[styles.modeTag, { backgroundColor: tint(tone, 0.16) }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.modeTagText, { color: tone }]}>{label}</Text>
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
    gap: space.lg,
  },
  lede: {
    ...type.body,
    color: c.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  tile: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: 186,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: space.sm,
  },
  tilePressed: {
    opacity: 0.75,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    ...type.heading,
    color: c.text,
  },
  tileBlurb: {
    ...type.caption,
    color: c.textMuted,
    flex: 1,
    lineHeight: 17,
  },
  tileFooter: {
    gap: space.xs,
  },
  modeTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  modeTagText: {
    ...type.tag,
  },
  tileMeta: {
    ...type.caption,
    color: c.textMuted,
  },
  note: {
    ...type.caption,
    color: c.textMuted,
    lineHeight: 17,
  },
}));
