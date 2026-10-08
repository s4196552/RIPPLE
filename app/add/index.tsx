import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useLayoutEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ALL_DESCRIPTORS, getProvider } from '@/providers/registry';
import type { ProviderMode } from '@/providers/types';
import { useWatchlist } from '@/store/watchlist';
import { Glyph } from '@/ui/components/Glyph';
import { ProvenanceTag } from '@/ui/components/ProvenanceTag';
import { FOLLOW_COPY } from '@/ui/followCopy';
import { glyph } from '@/ui/icons';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { font, space, tint, type } from '@/ui/theme';

/**
 * Step 1 of the Follow flow: pick a source.
 *
 * The list is generated from the provider registry, so a newly registered
 * source appears here with no change to this file.
 */
export default function SourcePickerScreen() {
  const c = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const navigation = useNavigation();
  const subjects = useWatchlist((s) => s.subjects);

  // The design's header: where you are on the left, a way out on the right.
  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerLeft: () => <Text style={styles.step}>Step 1 of 2</Text>,
      headerRight: () => (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={24} color={c.text} />
        </Pressable>
      ),
    });
  }, [navigation, router, styles, c]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">
        Follow something
      </Text>
      <Text style={styles.lede}>Pick a source. You’ll choose who or what next.</Text>

      {ALL_DESCRIPTORS.map((s) => {
        const count = subjects.filter((w) => w.source === s.id).length;
        const mode = getProvider(s.id).mode();
        const copy = FOLLOW_COPY[s.id];

        return (
          <Pressable
            key={s.id}
            onPress={() => router.push(`/add/${s.id}`)}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={
              `${s.label}. ${copy.pick} ${copy.example}. Source: ${s.provenance}. ` +
              // The mode tag is visual only, so without this a screen reader
              // could not tell live data from an offline sample.
              `${MODE_SPOKEN[mode]}. ` +
              `${count > 0 ? `${count} already followed.` : ''}`
            }
          >
            <View style={styles.icon}>
              <Glyph glyph={glyph(s.icon)} size={24} color={c.accent} />
            </View>

            <View style={styles.body}>
              <View style={styles.nameLine}>
                <Text style={styles.name}>{s.label}</Text>
                {count > 0 ? <Text style={styles.count}>{count} following</Text> : null}
              </View>
              <Text style={styles.desc}>{copy.pick}</Text>
              <Text style={styles.example}>{copy.example}</Text>
              {/* Only when it matters: an offline sample has to say so. */}
              {mode === 'mock' ? <ProvenanceTag mode={mode} /> : null}
            </View>

            <Ionicons name="chevron-forward" size={20} color={c.text} />
          </Pressable>
        );
      })}

      <Text style={styles.note}>
        Every source is public data. Congress trade filings come from the House Clerk; insider
        trades from SEC EDGAR; executive actions from the Federal Register.
      </Text>
    </ScrollView>
  );
}

/** Spoken form of each mode, for the option's accessibility label. */
const MODE_SPOKEN: Record<ProviderMode, string> = {
  live: 'Live data, using your API key',
  public: 'Live data, no key needed',
  mock: 'Offline sample data, not live',
};

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.bg,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.xxl,
  },
  step: {
    ...type.eyebrow,
    textTransform: 'uppercase',
    color: c.textSubtle,
    paddingLeft: space.lg,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space.sm,
  },
  title: {
    ...type.display,
    color: c.text,
    marginBottom: 6,
  },
  lede: {
    ...type.body,
    lineHeight: 22,
    color: c.textMuted,
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: space.lg,
    minHeight: 88,
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  pressed: {
    backgroundColor: c.surfaceAlt,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tint(c.accent, 0.16),
  },
  body: {
    flex: 1,
    gap: 2,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  name: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: font.semibold,
    color: c.text,
  },
  count: {
    ...type.caption,
    fontFamily: font.semibold,
    color: c.textMuted,
  },
  desc: {
    ...type.bodyTight,
    lineHeight: 19,
    color: c.textMuted,
  },
  example: {
    fontFamily: font.mono,
    fontSize: 12,
    lineHeight: 16,
    color: c.textSubtle,
    marginTop: 4,
  },
  note: {
    ...type.caption,
    lineHeight: 17,
    color: c.textSubtle,
    paddingHorizontal: space.xs,
    marginTop: space.sm,
  },
}));
