import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tapFeedback } from '@/lib/feedback';
import { ALL_DESCRIPTORS } from '@/providers/registry';
import { usePreferences } from '@/store/preferences';
import { Avatar } from '@/ui/components/Avatar';
import { BRAND, BrandBackdrop } from '@/ui/components/BrandBackdrop';
import { Glyph } from '@/ui/components/Glyph';
import { RippleLogo } from '@/ui/components/RippleLogo';
import { RippleRings } from '@/ui/components/RippleRings';
import { TonePill } from '@/ui/components/TonePill';
import { FOLLOW_COPY } from '@/ui/followCopy';
import { glyph } from '@/ui/icons';
import { makeStyles, useTheme, useThemeName } from '@/ui/ThemeProvider';
import { font, isDark, radius, space, tint, type } from '@/ui/theme';

const PAGES = 4;

/**
 * First-launch introduction: the mark and the promise, what Ripple reads, what
 * a trade card tells you, and how to start.
 *
 * The first page is the logo's moment and is drawn on the brand backdrop in
 * any theme. The three after it are ordinary themed screens, as the design
 * draws them, so the hand-off into the app is seamless. Skippable from every
 * page, and replayable from Settings.
 */
export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const themeName = useThemeName();
  const { width } = useWindowDimensions();
  const setPreference = usePreferences((s) => s.set);
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const goTo = (next: number) => {
    tapFeedback();
    scroller.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
    AccessibilityInfo.announceForAccessibility(`Page ${next + 1} of ${PAGES}`);
  };

  const finish = (then?: 'follow') => {
    tapFeedback();
    setPreference('onboarded', true);
    // From Settings ("Show introduction") there is somewhere to go back to; on
    // first launch this screen replaced the tabs, so put them back.
    if (router.canGoBack()) router.back();
    else router.replace('/');
    if (then === 'follow') router.push('/add');
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / Math.max(width, 1));
    if (next !== page) setPage(Math.min(PAGES - 1, Math.max(0, next)));
  };

  const pad = { paddingTop: insets.top, paddingBottom: insets.bottom };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={page === 0 || isDark(themeName) ? 'light' : 'dark'} />
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        <View style={{ width }}>
          <Welcome pad={pad} onSkip={() => finish()} onNext={() => goTo(1)} />
        </View>
        <ThemedPage
          width={width}
          pad={pad}
          step={2}
          onBack={() => goTo(0)}
          onSkip={() => finish()}
          onNext={() => goTo(2)}
        >
          <Sources />
        </ThemedPage>
        <ThemedPage
          width={width}
          pad={pad}
          step={3}
          onBack={() => goTo(1)}
          onSkip={() => finish()}
          onNext={() => goTo(3)}
        >
          <Measured />
        </ThemedPage>
        <ThemedPage width={width} pad={pad} step={4} onBack={() => goTo(2)}>
          <Start onFollow={() => finish('follow')} onExplore={() => finish()} />
        </ThemedPage>
      </ScrollView>
    </View>
  );
}

type Pad = { paddingTop: number; paddingBottom: number };

/** The mark and the promise, on the brand backdrop. */
function Welcome({ pad, onSkip, onNext }: { pad: Pad; onSkip: () => void; onNext: () => void }) {
  return (
    <BrandBackdrop glowAt={0.36}>
      <View style={[brand.page, pad]}>
        <View style={brand.topBar}>
          <Pressable
            onPress={onSkip}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip the introduction"
            style={({ pressed }) => [brand.skip, pressed && brand.pressed]}
          >
            <Text style={brand.skipText}>Skip</Text>
          </Pressable>
        </View>

        <View style={brand.welcome}>
          <View style={brand.markWrap}>
            <RippleRings size={300} />
            <View style={brand.mark}>
              <RippleLogo size={112} decorative />
            </View>
          </View>
          <Text style={brand.eyebrow}>PUBLIC MONEY · MADE LEGIBLE</Text>
          <Text style={brand.wordmark} accessibilityRole="header">
            Ripple
          </Text>
          <Text style={brand.tagline}>See the signal behind the noise.</Text>
        </View>

        <View style={brand.footer}>
          <View style={brand.dots} accessible accessibilityRole="text" accessibilityLabel={`Page 1 of ${PAGES}`}>
            {Array.from({ length: PAGES }, (_, i) => (
              <View key={i} style={[brand.dot, i === 0 && brand.dotOn]} />
            ))}
          </View>
          <Pressable
            onPress={onNext}
            accessibilityRole="button"
            accessibilityLabel={`Get started, page 2 of ${PAGES}`}
            style={({ pressed }) => [brand.primary, pressed && brand.primaryPressed]}
          >
            <Text style={brand.primaryText}>Get started</Text>
            <Ionicons name="arrow-forward" size={18} color={BRAND.ink} />
          </Pressable>
        </View>
      </View>
    </BrandBackdrop>
  );
}

/** Back and Skip above, the page, then the step dots and Continue below. */
function ThemedPage({
  width,
  pad,
  step,
  onBack,
  onSkip,
  onNext,
  children,
}: {
  width: number;
  pad: Pad;
  step: number;
  onBack: () => void;
  onSkip?: () => void;
  onNext?: () => void;
  children: ReactNode;
}) {
  const c = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.page, pad, { width }]}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </Pressable>
        {onSkip ? (
          <Pressable
            onPress={onSkip}
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Skip the introduction"
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        {children}
      </ScrollView>

      <View style={[styles.footer, !onNext && styles.footerCentred]}>
        <View
          style={styles.dots}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`Page ${step} of ${PAGES}`}
        >
          {Array.from({ length: PAGES }, (_, i) => (
            <View key={i} style={[styles.dot, i === step - 1 && styles.dotOn]} />
          ))}
        </View>
        {onNext ? (
          <Pressable
            onPress={onNext}
            style={({ pressed }) => [styles.continue, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Continue, page ${step + 1} of ${PAGES}`}
          >
            <Text style={styles.continueText}>Continue</Text>
            <Ionicons name="arrow-forward" size={20} color={c.onAccent} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Heading({ eyebrow, title, lede }: { eyebrow: string; title: string; lede: string }) {
  const styles = useStyles();
  return (
    <>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.lede}>{lede}</Text>
    </>
  );
}

function Sources() {
  const c = useTheme();
  const styles = useStyles();
  return (
    <>
      <Heading
        eyebrow="What Ripple watches"
        title="Five public sources, one feed."
        lede="Every item links to the original filing, so you can always check the source."
      />
      <View style={styles.sourceList}>
        {ALL_DESCRIPTORS.map((s) => (
          <View
            key={s.id}
            style={styles.sourceRow}
            accessible
            accessibilityLabel={`${s.label}: ${FOLLOW_COPY[s.id].explain}`}
          >
            <View style={styles.sourceIcon}>
              <Glyph glyph={glyph(s.icon)} size={22} color={c.accent} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.sourceName}>{s.label}</Text>
              <Text style={styles.sourceText}>{FOLLOW_COPY[s.id].explain}</Text>
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

/**
 * How a trade card reads, on one worked example: the trade, the filing, today,
 * and the two measurements between them.
 */
function Measured() {
  const c = useTheme();
  const styles = useStyles();
  return (
    <>
      <Heading
        eyebrow="Measured against the market"
        title="Did it matter? We measure it."
        lede="For every trade, Ripple shows how the stock moved — and how it did against the S&P 500 over the same days."
      />

      <View
        style={styles.example}
        accessible
        accessibilityLabel={
          'Example: Nancy Pelosi, Democrat, CA-11. Buy BE, Bloom Energy, spouse, $1,000,001 to $5,000,000. ' +
          'Traded 24 July, filed 21 August, 28 days to file. Up 9.51% between trade and filing. ' +
          'Up 43.02 percentage points against SPY since the trade.'
        }
      >
        <Text style={styles.exampleTag}>Example</Text>
        <View style={styles.exampleHead}>
          <Avatar name="Nancy Pelosi" size={40} />
          <View style={styles.flex}>
            <View style={styles.inline}>
              <Text style={styles.exampleName}>Nancy Pelosi</Text>
              <View style={styles.tag}>
                <Text style={styles.tagText}>DEM</Text>
              </View>
              <Text style={styles.exampleWhere}>CA-11</Text>
            </View>
            <View style={[styles.inline, { marginTop: 5 }]}>
              <TonePill tone="up" label="Buy" variant="tag" />
              <Text style={styles.ticker}>BE</Text>
              <Text style={styles.exampleAsset}>Bloom Energy</Text>
              <View style={styles.tag}>
                <Text style={styles.tagText}>Spouse</Text>
              </View>
            </View>
          </View>
        </View>
        <Text style={styles.exampleAmount}>$1,000,001–$5,000,000</Text>

        {/* Trade → filed → today, with the wait the public had drawn in the accent. */}
        <View style={styles.line}>
          <View style={styles.lineLabels}>
            <Text style={styles.lineLabel}>TRADE</Text>
            <Text style={[styles.lineLabel, { left: '34%' }]}>FILED</Text>
            <Text style={[styles.lineLabel, { right: 0 }]}>TODAY</Text>
          </View>
          <View style={styles.track} />
          <View style={styles.trackFill} />
          <View style={[styles.node, { left: 0, borderColor: c.accent }]} />
          <View style={[styles.node, { left: '38%', borderColor: c.accent }]} />
          <View style={[styles.node, { right: 0 }]} />
          <Text style={[styles.lineDate, { left: 0 }]}>24 Jul</Text>
          <Text style={[styles.lineDate, { left: '34%' }]}>21 Aug</Text>
          <Text style={[styles.lineDate, { right: 0 }]}>7 Oct</Text>
          <Text style={styles.lineWait}>28 days to file</Text>
        </View>

        <View style={styles.tiles}>
          <View style={styles.tile}>
            <TonePill tone="up" label="+9.51%" />
            <Text style={styles.tileText}>stock move between trade and filing</Text>
          </View>
          <View style={styles.tile}>
            <TonePill tone="up" label="+43.02pp" />
            <Text style={styles.tileText}>vs SPY since the trade</Text>
          </View>
        </View>
      </View>

      <Text style={styles.note}>
        <Text style={styles.noteStrong}>pp</Text> = percentage points ahead of (+) or behind (−) the S&amp;P 500 over the
        same period. Ripple reports what the price did; it doesn’t say why.
      </Text>
    </>
  );
}

function Start({ onFollow, onExplore }: { onFollow: () => void; onExplore: () => void }) {
  const c = useTheme();
  const styles = useStyles();
  return (
    <>
      <Heading
        eyebrow="Get started"
        title="How do you want to start?"
        lede="You can change what you follow at any time from Watchlist."
      />

      <Pressable
        onPress={onFollow}
        style={({ pressed }) => [styles.choice, styles.choicePrimary, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Follow someone now. A member, a party, an insider, a topic or a ticker."
      >
        <View style={[styles.choiceIcon, { backgroundColor: tint(c.onAccent, 0.14) }]}>
          <Ionicons name="add" size={24} color={c.onAccent} />
        </View>
        <View style={styles.flex}>
          <Text style={[styles.choiceTitle, { color: c.onAccent }]}>Follow someone now</Text>
          <Text style={[styles.choiceText, { color: c.onAccent }]}>
            A member, a party, an insider, a topic or a ticker.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.onAccent} />
      </Pressable>

      <Pressable
        onPress={onExplore}
        style={({ pressed }) => [styles.choice, styles.choiceSecondary, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Explore a starter feed. A sample of recent filings from every source."
      >
        <View style={[styles.choiceIcon, { backgroundColor: tint(c.accent, 0.16) }]}>
          <RingsGlyph color={c.accent} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.choiceTitle}>Explore a starter feed</Text>
          <Text style={[styles.choiceText, { color: c.textMuted }]}>
            A sample of recent filings from every source.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={c.text} />
      </Pressable>

      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={20} color={c.textMuted} />
        <Text style={styles.disclaimerText}>
          <Text style={styles.noteStrong}>Public record, not advice.</Text> Ripple republishes public disclosures
          and measures price moves. It is not investment advice and is not affiliated with Congress, the SEC, the
          White House or any government agency. Filings can be late, amended or incomplete.
        </Text>
      </View>
    </>
  );
}

/** The Signals tab's three rings, at icon size. */
function RingsGlyph({ color }: { color: string }) {
  return (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      {[20, 12, 4].map((d) => (
        <View
          key={d}
          style={{ position: 'absolute', width: d, height: d, borderRadius: d / 2, borderWidth: 1.75, borderColor: color }}
        />
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  page: {
    flex: 1,
    backgroundColor: c.bg,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: space.sm,
    paddingRight: space.md,
    paddingTop: space.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skip: {
    minHeight: 44,
    paddingHorizontal: space.md,
    justifyContent: 'center',
  },
  skipText: {
    ...type.body,
    fontFamily: font.semibold,
    color: c.textMuted,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.lg,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    paddingBottom: 44,
  },
  footerCentred: {
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.border,
  },
  dotOn: {
    width: 20,
    backgroundColor: c.text,
  },
  continue: {
    minWidth: 160,
    minHeight: 52,
    borderRadius: 26,
    paddingHorizontal: 20,
    backgroundColor: c.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  continueText: {
    ...type.body,
    fontSize: 16,
    fontFamily: font.semibold,
    color: c.onAccent,
  },
  eyebrow: {
    ...type.eyebrow,
    textTransform: 'uppercase',
    color: c.textSubtle,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: font.bold,
    letterSpacing: -0.45,
    color: c.text,
    marginTop: 10,
    marginBottom: 6,
  },
  lede: {
    ...type.body,
    lineHeight: 22,
    color: c.textMuted,
    marginBottom: 20,
  },

  sourceList: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  sourceIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceName: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: font.semibold,
    color: c.text,
  },
  sourceText: {
    ...type.bodyTight,
    color: c.textMuted,
    marginTop: 2,
  },

  example: {
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  exampleTag: {
    ...type.eyebrow,
    textTransform: 'uppercase',
    color: c.textSubtle,
    marginBottom: space.sm,
  },
  exampleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  inline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  exampleName: {
    ...type.heading,
    color: c.text,
  },
  exampleWhere: {
    ...type.label,
    fontFamily: font.medium,
    color: c.textSubtle,
  },
  tag: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: c.border,
  },
  tagText: {
    ...type.micro,
    fontFamily: font.bold,
    color: c.textMuted,
  },
  ticker: {
    ...type.mono,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: c.surfaceAlt,
    color: c.text,
  },
  exampleAsset: {
    ...type.bodyTight,
    color: c.textMuted,
  },
  exampleAmount: {
    fontFamily: font.mono,
    fontSize: 14,
    lineHeight: 20,
    color: c.text,
    marginTop: 10,
    marginLeft: 52,
    marginBottom: 18,
  },
  line: {
    height: 92,
    marginHorizontal: space.xs,
  },
  lineLabels: {
    height: 16,
  },
  lineLabel: {
    position: 'absolute',
    top: 0,
    ...type.micro,
    letterSpacing: 0.66,
    color: c.textSubtle,
  },
  track: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 33,
    height: 2,
    backgroundColor: c.border,
  },
  trackFill: {
    position: 'absolute',
    left: 6,
    width: '38%',
    top: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.accent,
  },
  node: {
    position: 'absolute',
    top: 28,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: c.textMuted,
    backgroundColor: c.surface,
  },
  lineDate: {
    position: 'absolute',
    top: 48,
    fontFamily: font.mono,
    fontSize: 12,
    lineHeight: 16,
    color: c.textMuted,
  },
  lineWait: {
    position: 'absolute',
    top: 68,
    left: '8%',
    fontFamily: font.monoSemibold,
    fontSize: 12,
    lineHeight: 16,
    color: c.text,
  },
  tiles: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.xs,
  },
  tile: {
    flex: 1,
    gap: 6,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: space.md,
    backgroundColor: c.bg,
  },
  tileText: {
    ...type.label,
    fontFamily: font.regular,
    lineHeight: 17,
    color: c.textMuted,
  },
  note: {
    ...type.bodyTight,
    color: c.textMuted,
    marginTop: space.lg,
    marginHorizontal: 2,
  },
  noteStrong: {
    fontFamily: font.bold,
    color: c.text,
  },

  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: space.lg,
    minHeight: 96,
    borderRadius: 16,
  },
  choicePrimary: {
    backgroundColor: c.accent,
  },
  choiceSecondary: {
    marginTop: 10,
    marginBottom: space.xl,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  choiceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontFamily: font.semibold,
    color: c.text,
  },
  choiceText: {
    ...type.bodyTight,
    marginTop: 2,
  },
  // Settles at the foot of the page, as the design has it, below whatever
  // room the choices leave.
  disclaimer: {
    flexDirection: 'row',
    gap: space.md,
    marginTop: 'auto',
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    borderRadius: 12,
    backgroundColor: c.surfaceAlt,
  },
  disclaimerText: {
    ...type.label,
    fontFamily: font.regular,
    lineHeight: 19,
    color: c.textMuted,
    flex: 1,
  },
}));

/** The brand page's styles: fixed colours, the same in every theme. */
const brand = StyleSheet.create({
  page: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  skip: {
    minHeight: 44,
    minWidth: 56,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    ...type.label,
    fontSize: 15,
    color: BRAND.muted,
  },
  pressed: {
    opacity: 0.6,
  },
  welcome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  markWrap: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.lg,
  },
  // No shadow here: on web a shadow draws as the box's square, not the mark's
  // rounded shape. The backdrop's bloom and the rings already light it.
  mark: {
    position: 'absolute',
  },
  eyebrow: {
    ...type.micro,
    color: BRAND.sky,
    letterSpacing: 3,
    marginBottom: space.sm,
  },
  wordmark: {
    fontSize: 52,
    fontFamily: font.bold,
    letterSpacing: -1.5,
    color: BRAND.text,
  },
  tagline: {
    ...type.body,
    fontSize: 18,
    lineHeight: 25,
    color: BRAND.muted,
    marginTop: space.sm,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: space.xl,
    paddingBottom: space.lg,
    gap: space.lg,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(244,243,251,0.28)',
  },
  dotOn: {
    width: 22,
    backgroundColor: BRAND.sky,
  },
  primary: {
    width: '100%',
    maxWidth: 460,
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: BRAND.sky,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  primaryPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  primaryText: {
    ...type.heading,
    fontSize: 16,
    color: BRAND.ink,
  },
});
