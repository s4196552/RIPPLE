import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ALL_RECIPIENTS,
  PRIVACY_CONTACT,
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_SECTIONS,
  type DataRecipient,
} from '@/legal/privacy';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { radius, space, tapSlop, type } from '@/ui/theme';
import { openLink } from '@/lib/feedback';

/**
 * Privacy Policy.
 *
 * Rendered from `src/legal/privacy.ts` for the same reason the terms are: the
 * text has one home and this screen stays a layout.
 *
 * The one thing this screen does that the terms screen does not is render the
 * recipient list as real rows with working links. Apple 5.1.1(i) requires the
 * policy to name third parties that receive user data and to let the user
 * reach their policies; a paragraph naming them in prose satisfies the letter
 * of that and is materially worse to actually use.
 */
export default function PrivacyScreen() {
  const styles = useStyles();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.effective}>Effective {PRIVACY_EFFECTIVE_DATE}</Text>

      <Text style={styles.lede}>
        Ripple keeps your watchlist on your device and has no server of its own. It does fetch
        public records straight from the agencies that publish them, and this page says exactly
        who that is and what they see.
      </Text>

      {__DEV__ && <PlaceholderWarning />}

      {PRIVACY_SECTIONS.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {section.title}
          </Text>
          {section.body.map((paragraph, i) => (
            <Text key={i} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}

          {/* The recipient table belongs inside the section that introduces
              it, not appended after the whole policy where it reads as an
              afterthought. */}
          {section.id === 'third-parties' && (
            <View style={styles.recipients}>
              {/* Indexed: EDGAR is listed under both Insiders and Funds. */}
              {ALL_RECIPIENTS.map((recipient, i) => (
                <RecipientRow key={`${i}:${recipient.host}`} recipient={recipient} />
              ))}
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

/**
 * One third party, what it sees, and a way to read its own policy.
 *
 * The whole row is the tap target rather than a link inside a row: a nested
 * Pressable renders as a `<button>` inside a `<button>` on web, and a row this
 * tall with one small link in it is a worse target than the row itself.
 */
function RecipientRow({ recipient }: { recipient: DataRecipient }) {
  const c = useTheme();
  const styles = useStyles();
  const open = () =>
    openLink(recipient.policyUrl, recipient.name);

  return (
    <Pressable
      onPress={open}
      hitSlop={tapSlop(38)}
      style={({ pressed }) => [styles.recipient, pressed && styles.recipientPressed]}
      accessibilityRole="link"
      // The "optional" tag and the arrow glyph are the only things saying this
      // connection is conditional and that the row opens an external page.
      // Both are visual-only, so they are spoken here instead.
      accessibilityLabel={
        `${recipient.name}${recipient.optional ? ', contacted only when an API key is set' : ''}. ` +
        `Receives ${recipient.receives}. ` +
        `Double tap to open their privacy policy at ${recipient.host}.`
      }
    >
      <View style={styles.recipientBody}>
        <View style={styles.recipientHead}>
          <Text style={styles.recipientName}>{recipient.name}</Text>
          {recipient.optional && (
            <View style={styles.optionalTag}>
              <Text style={styles.optionalTagText}>OPTIONAL</Text>
            </View>
          )}
        </View>
        <Text style={styles.recipientHost}>{recipient.host}</Text>
        <Text style={styles.recipientReceives}>Receives {recipient.receives}.</Text>
      </View>

      <Ionicons name="open-outline" size={15} color={c.textMuted} style={styles.openIcon} />
    </Pressable>
  );
}

/**
 * Development-only, and the same gate the terms screen carries: the contact
 * address is shared with the terms, so shipping it unfilled would print
 * "TODO: support email address" as the way to raise a privacy question.
 */
function PlaceholderWarning() {
  const c = useTheme();
  const styles = useStyles();
  if (!PRIVACY_CONTACT.startsWith('TODO')) return null;

  return (
    <View style={styles.warning}>
      <Ionicons name="construct-outline" size={15} color={c.warning} />
      <Text style={styles.warningText}>
        Unfilled before release: contact address. This draft has not been reviewed by a lawyer.
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
  recipients: {
    marginTop: space.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    overflow: 'hidden',
  },
  recipient: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    padding: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    backgroundColor: c.surface,
  },
  recipientPressed: {
    backgroundColor: c.surfaceAlt,
  },
  recipientBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  recipientHead: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  recipientName: {
    ...type.label,
    color: c.text,
    flexShrink: 1,
  },
  optionalTag: {
    paddingHorizontal: space.sm,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: c.warning,
  },
  optionalTagText: {
    ...type.tag,
    color: c.onAccent,
  },
  recipientHost: {
    ...type.caption,
    color: c.textMuted,
  },
  recipientReceives: {
    ...type.caption,
    color: c.textSubtle,
    lineHeight: 17,
  },
  openIcon: {
    marginTop: 2,
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
