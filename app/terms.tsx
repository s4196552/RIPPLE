import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Text, View } from 'react-native';
import {
  TERMS_CONTACT,
  TERMS_EFFECTIVE_DATE,
  TERMS_JURISDICTION,
  TERMS_SECTIONS,
} from '@/legal/terms';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { radius, space, type } from '@/ui/theme';

/**
 * Terms of Service.
 *
 * Rendered from `src/legal/terms.ts` rather than written inline, so the text
 * has one home and the screen stays a layout. Long-form legal copy is the one
 * place in the app where line length and leading matter more than density, so
 * the measure is wider and the line height taller than `type.body` gives.
 */
export default function TermsScreen() {
  const styles = useStyles();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.effective}>Effective {TERMS_EFFECTIVE_DATE}</Text>

      <Text style={styles.lede}>
        Ripple is a reader for public disclosure records. It is not a broker, and nothing in it is
        financial advice. The rest of this page says that at greater length.
      </Text>

      {__DEV__ && <PlaceholderWarning />}

      {TERMS_SECTIONS.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {section.title}
          </Text>
          {section.body.map((paragraph, i) => (
            <Text key={i} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

/**
 * Development-only. The terms carry two placeholders that cannot be invented,
 * and a release that shipped them would show a user the literal string
 * "TODO: support email address" as the way to reach us. The test suite already
 * fails on this; the banner is the same fact where it will actually be seen.
 */
function PlaceholderWarning() {
  const c = useTheme();
  const styles = useStyles();
  const unfilled = [
    TERMS_CONTACT.startsWith('TODO') && 'contact address',
    TERMS_JURISDICTION.startsWith('TODO') && 'governing jurisdiction',
  ].filter(Boolean);

  if (unfilled.length === 0) return null;

  return (
    <View style={styles.warning}>
      <Ionicons name="construct-outline" size={15} color={c.warning} />
      <Text style={styles.warningText}>
        Unfilled before release: {unfilled.join(' and ')}. This draft has not been reviewed by a
        lawyer.
      </Text>
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
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  effective: {
    ...type.micro,
    color: c.textMuted,
    textTransform: 'uppercase',
  },
  lede: {
    ...type.body,
    color: c.text,
    lineHeight: 23,
  },
  section: {
    gap: space.sm,
  },
  sectionTitle: {
    ...type.label,
    color: c.text,
  },
  paragraph: {
    ...type.bodyTight,
    color: c.textSubtle,
    // Legal copy is read in long runs rather than scanned, and the body
    // leading is tuned for two-line cards.
    lineHeight: 21,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: c.surfaceAlt,
    borderLeftWidth: 3,
    borderLeftColor: c.warning,
  },
  // Ink, not the warning colour: the icon and the bar carry the colour, and
  // the shared warning tone is below AA as small text on White.
  warningText: {
    ...type.caption,
    color: c.text,
    flex: 1,
    lineHeight: 17,
  },
}));
