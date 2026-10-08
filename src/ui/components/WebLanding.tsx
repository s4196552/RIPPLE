import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { makeStyles, useTheme } from '../ThemeProvider';
import { font, radius, shadow, space, tint, type } from '../theme';
import { RippleLogo } from './RippleLogo';

type Section = 'signals' | 'how' | 'principles';

export function WebLanding() {
  const c = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const scrollRef = useRef<ScrollView>(null);
  const [sectionY, setSectionY] = useState<Record<Section, number>>({ signals: 0, how: 0, principles: 0 });
  const goTo = (section: Section) => scrollRef.current?.scrollTo({ y: Math.max(sectionY[section] - 16, 0), animated: true });

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.page}>
      <View style={styles.navBar}>
        <View style={[styles.container, styles.navInner]}>
          <Pressable onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} accessibilityRole="link" accessibilityLabel="Ripple home" style={styles.brand}>
            <RippleLogo size={36} decorative />
            <Text style={styles.brandName}>ripple</Text>
          </Pressable>
          <View style={[styles.navLinks, !wide && styles.hidden]}>
            <LandingLink label="Signals" onPress={() => goTo('signals')} />
            <LandingLink label="How it works" onPress={() => goTo('how')} />
            <LandingLink label="Principles" onPress={() => goTo('principles')} />
          </View>
          <Pressable onPress={() => router.push('/add')} style={({ pressed }) => [styles.navCta, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Open Ripple and add a subject">
            <Text style={styles.navCtaText}>Open Ripple</Text>
            <Ionicons name="arrow-forward" size={15} color={c.onAccent} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.container, styles.hero, wide && styles.heroWide]}>
        <View style={[styles.heroCopy, wide && styles.heroCopyWide]}>
          <View style={styles.eyebrowRow}><View style={styles.liveDot} /><Text style={styles.eyebrow}>PUBLIC SIGNALS - BUILT FOR CLARITY</Text></View>
          <Text style={[styles.heroTitle, wide && styles.heroTitleWide]}>See the signal{wide ? '\n' : ' '}behind the noise.</Text>
          <Text style={styles.heroBody}>Ripple brings public filings, policy moves, and market context into one calm, source-aware feed. Follow what matters. Verify the record. Keep moving.</Text>
          <View style={styles.heroActions}>
            <Pressable onPress={() => goTo('signals')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Explore the Ripple signals feed">
              <Text style={styles.primaryButtonText}>Explore the feed</Text><Ionicons name="arrow-down" size={16} color={c.onAccent} />
            </Pressable>
            <Pressable onPress={() => router.push('/add')} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Build a Ripple watchlist">
              <Text style={styles.secondaryButtonText}>Build a watchlist</Text>
            </Pressable>
          </View>
          <View style={styles.proofRow}><Proof value="04" label="public sources" /><View style={styles.proofDivider} /><Proof value="01" label="quiet feed" /><View style={styles.proofDivider} /><Proof value="0" label="noise added" /></View>
        </View>

        <View style={[styles.heroVisual, wide && styles.heroVisualWide]}>
          <View style={styles.glowBlue} /><View style={styles.glowGreen} />
          <View style={styles.previewWindow}>
            <View style={styles.previewBar}>
              <View style={styles.windowDots}><View style={[styles.windowDot, { backgroundColor: c.down }]} /><View style={[styles.windowDot, { backgroundColor: c.warning }]} /><View style={[styles.windowDot, { backgroundColor: c.up }]} /></View>
              <View style={styles.previewBrand}><RippleLogo size={24} decorative /><Text style={styles.previewTitle}>RIPPLE / SIGNALS</Text></View>
              <Ionicons name="ellipsis-horizontal" size={16} color={c.textMuted} />
            </View>
            <View style={styles.previewHeader}><Text style={styles.previewHeading}>Your signal feed</Text><View style={styles.livePill}><View style={styles.livePillDot} /><Text style={styles.livePillText}>LIVE</Text></View></View>
            <View style={styles.sourceTabs}><View style={[styles.sourceTab, styles.sourceTabActive]}><Text style={[styles.sourceTabText, { color: c.text }]}>All sources</Text></View><View style={styles.sourceTab}><Text style={styles.sourceTabText}>Congress</Text></View><View style={styles.sourceTab}><Text style={styles.sourceTabText}>Insiders</Text></View></View>
            <PreviewSignal icon="document-text-outline" color={c.accent} source="CONGRESS" actor="Rep. Nancy Pelosi" copy="Disclosed a purchase of Nvidia Corp." meta="2h ago - Trade disclosure" value="NVDA  +3.8%" />
            <PreviewSignal icon="briefcase-outline" color={c.up} source="INSIDERS" actor="Microsoft Corp." copy="Director added to their position." meta="5h ago - Form 4 filing" value="MSFT  +1.2%" />
            <PreviewSignal icon="megaphone-outline" color={c.warning} source="POLICY" actor="Executive Office" copy="New order signed on AI infrastructure." meta="Yesterday - Federal Register" value="Read source" />
            <View style={styles.previewFooter}><Text style={styles.previewFooterText}>Updated moments ago</Text><Ionicons name="arrow-forward" size={13} color={c.textMuted} /></View>
          </View>
          <View style={styles.floatingLabel}><Ionicons name="sparkles-outline" size={15} color={c.accent} /><Text style={styles.floatingLabelText}>Context, not predictions.</Text></View>
        </View>
      </View>

      <View style={styles.sourceRail} onLayout={(event) => setSectionY((current) => ({ ...current, signals: event.nativeEvent.layout.y }))}>
        <View style={[styles.container, styles.sourceRailInner]}>
          <Text style={styles.railLabel}>PUBLIC RECORDS, ONE VIEW</Text>
          <View style={styles.railItems}><Rail icon="people-outline" label="CONGRESS" /><Rail icon="briefcase-outline" label="INSIDERS" /><Rail icon="document-text-outline" label="POLICY" /><Rail icon="trending-up-outline" label="MARKET CONTEXT" /></View>
        </View>
      </View>

      <View style={[styles.container, styles.section]} onLayout={(event) => setSectionY((current) => ({ ...current, how: event.nativeEvent.layout.y }))}>
        <Text style={styles.eyebrow}>ONE QUIET PLACE</Text>
        <Text style={styles.sectionTitle}>From filing to context, without the tab-hopping.</Text>
        <Text style={styles.sectionBody}>Ripple is built for the moment after something happens -w^~)-t when you want the source, the person, and the market context in the same glance.</Text>
        <View style={[styles.featureGrid, wide && styles.featureGridWide]}>
          <Feature number="01" icon="funnel-outline" title="Start with the record" body="Every signal keeps its provenance close. Open the original filing or document when you want to go deeper." />
          <Feature number="02" icon="options-outline" title="Follow what matters" body="Build a personal watchlist across Congress, insiders, policy, and the tickers you care about." />
          <Feature number="03" icon="pulse-outline" title="Read the aftermath" body="See descriptive price context after the event - never a prediction disguised as certainty." />
        </View>
      </View>

      <View style={[styles.container, styles.principlesSection, wide && styles.principlesSectionWide]} onLayout={(event) => setSectionY((current) => ({ ...current, principles: event.nativeEvent.layout.y }))}>
        <View style={styles.principlesCopy}>
          <Text style={styles.eyebrow}>THE RIPPLE WAY</Text>
          <Text style={styles.sectionTitle}>A calmer relationship with information.</Text>
          <Text style={styles.sectionBody}>No hot takes. No scoreboards pretending to be certainty. Just a thoughtful layer over public data, designed to help you decide what deserves your attention next.</Text>
          <Pressable onPress={() => router.push('/privacy')} style={({ pressed }) => [styles.textLink, pressed && styles.pressed]} accessibilityRole="link" accessibilityLabel="Read Ripple's privacy promise">
            <Text style={styles.textLinkText}>Read our privacy promise</Text><Ionicons name="arrow-forward" size={15} color={c.accent} />
          </Pressable>
        </View>
        <View style={styles.principleList}><Principle icon="shield-checkmark-outline" title="Source-aware" body="The record stays visible." /><Principle icon="eye-outline" title="Descriptive" body="Context without overclaiming." /><Principle icon="phone-portrait-outline" title="Device-local" body="Your watchlist stays yours." /></View>
      </View>

      <View style={[styles.container, styles.ctaBand, wide && styles.ctaBandWide]}>
        <View style={styles.ctaCopy}><Text style={styles.ctaKicker}>READY WHEN YOU ARE</Text><Text style={styles.ctaTitle}>Make the next signal easier to see.</Text></View>
        <Pressable onPress={() => router.push('/add')} style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Open Ripple and add your first subject">
          <Text style={styles.ctaButtonText}>Open Ripple</Text><Ionicons name="arrow-forward" size={16} color={c.onAccent} />
        </Pressable>
      </View>

      <View style={[styles.container, styles.footer]}>
        <View style={styles.brand}><RippleLogo size={28} decorative /><Text style={[styles.brandName, styles.brandNameSmall]}>ripple</Text></View>
        <Text style={styles.footerNote}>Public records, made legible.</Text><Text style={styles.footerLegal}>- 2026 Ripple - Privacy - Terms</Text>
      </View>
    </ScrollView>
  );
}

function LandingLink({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  return <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={'Go to ' + label}><Text style={styles.navLink}>{label}</Text></Pressable>;
}

function Proof({ value, label }: { value: string; label: string }) {
  const styles = useStyles();
  return <View style={styles.proofItem}><Text style={styles.proofValue}>{value}</Text><Text style={styles.proofLabel}>{label}</Text></View>;
}

function PreviewSignal({ icon, color, source, actor, copy, meta, value }: { icon: keyof typeof Ionicons.glyphMap; color: string; source: string; actor: string; copy: string; meta: string; value: string }) {
  const styles = useStyles();
  return <View style={styles.previewSignal}><View style={[styles.signalIcon, { backgroundColor: tint(color, 0.13) }]}><Ionicons name={icon} size={16} color={color} /></View><View style={styles.signalCopy}><View style={styles.signalMetaRow}><Text style={[styles.signalSource, { color }]}>{source}</Text><Text style={styles.signalMeta}>{meta}</Text></View><Text style={styles.signalActor}>{actor}</Text><Text style={styles.signalBody}>{copy}</Text></View><Text style={[styles.signalValue, { color }]}>{value}</Text></View>;
}

function Rail({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const c = useTheme();
  const styles = useStyles();
  return <View style={styles.railItem}><Ionicons name={icon} size={17} color={c.textMuted} /><Text style={styles.railItemText}>{label}</Text></View>;
}

function Feature({ number, icon, title, body }: { number: string; icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  const c = useTheme();
  const styles = useStyles();
  return <View style={styles.featureCard}><View style={styles.featureTopRow}><View style={styles.featureIcon}><Ionicons name={icon} size={19} color={c.accent} /></View><Text style={styles.featureNumber}>{number}</Text></View><Text style={styles.featureTitle}>{title}</Text><Text style={styles.featureBody}>{body}</Text></View>;
}

function Principle({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  const c = useTheme();
  const styles = useStyles();
  return <View style={styles.principleRow}><View style={styles.principleIcon}><Ionicons name={icon} size={18} color={c.up} /></View><View><Text style={styles.principleTitle}>{title}</Text><Text style={styles.principleBody}>{body}</Text></View></View>;
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.bg }, page: { paddingBottom: 48 }, container: { width: '100%', maxWidth: 1180, alignSelf: 'center', paddingHorizontal: 24 }, hidden: { display: 'none' },
  navBar: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, backgroundColor: c.bg }, navInner: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.lg }, brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm }, brandMark: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: c.accent }, brandName: { fontSize: 19, fontFamily: font.bold, letterSpacing: -0.6, color: c.text }, brandMarkSmall: { width: 25, height: 25, borderRadius: 6 }, brandNameSmall: { fontSize: 16 },
  navLinks: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xl, flex: 1 }, navLink: { ...type.label, color: c.textMuted }, navCta: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: c.accent }, navCtaText: { ...type.label, color: c.onAccent },
  hero: { paddingTop: 76, paddingBottom: 80, gap: 56 }, heroWide: { flexDirection: 'row', alignItems: 'center', gap: 48 }, heroCopy: { maxWidth: 620 }, heroCopyWide: { flex: 0.92 }, eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg }, liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.up }, eyebrow: { ...type.micro, color: c.textMuted },
  heroTitle: { fontSize: 54, lineHeight: 58, fontFamily: font.bold, letterSpacing: -2.2, color: c.text }, heroTitleWide: { fontSize: 76, lineHeight: 78, letterSpacing: -3.5 }, heroBody: { ...type.body, fontSize: 17, lineHeight: 27, color: c.textMuted, maxWidth: 560, marginTop: space.xl }, heroActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, marginTop: space.xl }, primaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: c.accent }, primaryButtonText: { ...type.label, color: c.onAccent }, secondaryButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderStrong }, secondaryButtonText: { ...type.label, color: c.text }, pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: 40 }, proofItem: { gap: 2 }, proofValue: { ...type.heading, color: c.text }, proofLabel: { ...type.micro, color: c.textMuted, textTransform: 'uppercase' }, proofDivider: { width: 1, height: 26, backgroundColor: c.border },
  heroVisual: { position: 'relative', minHeight: 520, justifyContent: 'center', alignItems: 'center' }, heroVisualWide: { flex: 1.08 }, glowBlue: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: tint(c.accent, 0.13), top: 10, right: 22 }, glowGreen: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: tint(c.up, 0.1), bottom: 10, left: 12 },
  previewWindow: { width: '100%', maxWidth: 540, overflow: 'hidden', borderWidth: 1, borderColor: c.borderStrong, borderRadius: radius.lg, backgroundColor: c.surface, ...shadow.raised }, previewBar: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border, backgroundColor: c.surfaceAlt }, windowDots: { flexDirection: 'row', gap: 5, width: 64 }, windowDot: { width: 7, height: 7, borderRadius: 4 }, previewBrand: { flexDirection: 'row', alignItems: 'center', gap: space.sm }, previewPulse: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: tint(c.accent, 0.14) }, previewTitle: { ...type.micro, color: c.textMuted },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.md }, previewHeading: { ...type.heading, color: c.text }, livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: tint(c.up, 0.12) }, livePillDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.up }, livePillText: { ...type.micro, color: c.text },
  sourceTabs: { flexDirection: 'row', gap: space.xs, paddingHorizontal: space.lg, paddingBottom: space.md }, sourceTab: { paddingHorizontal: space.sm, paddingVertical: 5, borderRadius: radius.sm }, sourceTabActive: { backgroundColor: tint(c.accent, 0.14) }, sourceTabText: { ...type.micro, color: c.textMuted },
  previewSignal: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }, signalIcon: { width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' }, signalCopy: { flex: 1, minWidth: 0, gap: 2 }, signalMetaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm }, signalSource: { ...type.micro }, signalMeta: { ...type.caption, color: c.textMuted, flexShrink: 1 }, signalActor: { ...type.label, color: c.text }, signalBody: { ...type.caption, color: c.textMuted }, signalValue: { ...type.micro, alignSelf: 'center' }, previewFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }, previewFooterText: { ...type.caption, color: c.textMuted }, floatingLabel: { position: 'absolute', left: 4, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surfaceAlt }, floatingLabelText: { ...type.caption, color: c.text },
  sourceRail: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border, backgroundColor: c.surface }, sourceRailInner: { minHeight: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.lg }, railLabel: { ...type.micro, color: c.textMuted }, railItems: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 20 }, railItem: { flexDirection: 'row', alignItems: 'center', gap: space.sm }, railItemText: { ...type.micro, color: c.textMuted },
  section: { paddingTop: 112, paddingBottom: 112 }, sectionTitle: { maxWidth: 760, fontSize: 43, lineHeight: 47, fontFamily: font.bold, letterSpacing: -1.8, color: c.text, marginTop: space.md }, sectionBody: { ...type.body, color: c.textMuted, maxWidth: 620, marginTop: space.lg }, featureGrid: { gap: space.md, marginTop: 48 }, featureGridWide: { flexDirection: 'row' }, featureCard: { flex: 1, minHeight: 226, padding: space.lg, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surface }, featureTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, featureIcon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: tint(c.accent, 0.12) }, featureNumber: { ...type.micro, color: c.textMuted }, featureTitle: { ...type.heading, fontSize: 18, color: c.text, marginTop: 34 }, featureBody: { ...type.bodyTight, color: c.textMuted, marginTop: space.sm },
  principlesSection: { flexDirection: 'column', gap: 48, paddingTop: 88, paddingBottom: 88, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border }, principlesSectionWide: { flexDirection: 'row', alignItems: 'center' }, principlesCopy: { flex: 1 }, principleList: { flex: 0.82, gap: space.md }, principleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, backgroundColor: c.surface }, principleIcon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: tint(c.up, 0.11) }, principleTitle: { ...type.label, color: c.text }, principleBody: { ...type.caption, color: c.textMuted }, textLink: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-start', marginTop: space.xl }, textLinkText: { ...type.label, color: c.text, textDecorationLine: 'underline' },
  ctaBand: { marginTop: 88, paddingVertical: 34, paddingHorizontal: 34, flexDirection: 'column', gap: space.lg, borderRadius: radius.lg, backgroundColor: c.surfaceAlt }, ctaBandWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, ctaCopy: { flex: 1 }, ctaKicker: { ...type.micro, color: c.textMuted }, ctaTitle: { ...type.heading, fontSize: 25, color: c.text, marginTop: space.sm }, ctaButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'flex-start', paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: c.accent }, ctaButtonText: { ...type.label, color: c.onAccent }, footer: { minHeight: 100, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.lg, paddingTop: 30, paddingBottom: 10 }, footerNote: { ...type.caption, color: c.textMuted, flex: 1 }, footerLegal: { ...type.caption, color: c.textMuted },
}));
