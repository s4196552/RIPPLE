import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  createBackup,
  parseBackup,
  restorePreview,
  serializeBackup,
  type BackupSubject,
} from '@/lib/backup';
import { useWatchlist } from '@/store/watchlist';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { radius, space, toneChip, type } from '@/ui/theme';

/**
 * Back up and restore the watchlist.
 *
 * Ripple has no account and no server, which keeps the watchlist private and
 * means it exists in exactly one place. This is the escape hatch for the day
 * that place is a phone in a river: a block of text the user keeps, rather
 * than a sync service the app would have to become something else to offer.
 *
 * Text rather than a file because a file needs a picker, a picker needs
 * `expo-document-picker`, and that is a native module and a rebuild for
 * something a note app already does well.
 */
export default function BackupScreen() {
  const c = useTheme();
  const styles = useStyles();

  const subjects = useWatchlist((s) => s.subjects);
  const restore = useWatchlist((s) => s.restore);

  const [pasted, setPasted] = useState('');
  const [result, setResult] = useState<{ tone: 'up' | 'down'; message: string } | null>(null);

  const backupText = useMemo(() => serializeBackup(createBackup(subjects)), [subjects]);

  // Parsed as you type so the preview is honest before anything is committed —
  // "Restore" should never be the moment you find out the paste was truncated.
  const parsed = useMemo(() => (pasted.trim() ? parseBackup(pasted) : null), [pasted]);
  const preview =
    parsed?.ok ? restorePreview(parsed.subjects, subjects) : null;

  const onShare = async () => {
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { message: backupText }
          : { message: backupText, title: 'Ripple watchlist backup' },
      );
    } catch {
      // The user dismissing the sheet throws on some platforms. Nothing failed.
    }
  };

  const onRestore = () => {
    if (!parsed?.ok) return;

    const added = restore(parsed.subjects);
    const skipped = parsed.subjects.length - added;

    setPasted('');
    setResult({
      tone: 'up',
      message:
        added === 0
          ? 'Everything in that backup was already on your watchlist.'
          : `Added ${added} subject${added === 1 ? '' : 's'}` +
            (skipped > 0 ? `, skipped ${skipped} already followed.` : '.'),
    });
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.lede}>
        Your watchlist lives on this device and nowhere else. Copy this text somewhere safe, and
        paste it back to rebuild the list on another phone.
      </Text>

      <Section title="Back up">
        {subjects.length === 0 ? (
          <Text style={styles.note}>
            There is nothing to back up yet — your watchlist is empty.
          </Text>
        ) : (
          <>
            <Text style={styles.note}>
              {subjects.length} subject{subjects.length === 1 ? '' : 's'}. Select the text to copy
              it, or send it to yourself.
            </Text>

            <TextInput
              value={backupText}
              editable={false}
              multiline
              scrollEnabled={false}
              style={styles.code}
              // Read-only, but selectable: on web and Android this is the only
              // way to copy without adding a clipboard native module.
              accessibilityLabel={`Backup text for ${subjects.length} watched subjects. Select to copy.`}
            />

            <Pressable
              onPress={onShare}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Send this backup to yourself"
            >
              <Ionicons name="share-outline" size={16} color={c.accent} />
              <Text style={styles.buttonText}>Send backup</Text>
            </Pressable>
          </>
        )}
      </Section>

      <Section title="Restore">
        <Text style={styles.note}>
          Paste a backup below. Restoring only adds — nothing you already follow is removed or
          changed.
        </Text>

        <TextInput
          value={pasted}
          onChangeText={(text) => {
            setPasted(text);
            setResult(null);
          }}
          multiline
          placeholder="Paste your backup here"
          placeholderTextColor={c.textFaint}
          style={[styles.code, styles.codeInput]}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Paste a Ripple backup to restore"
        />

        {/* Announced, because it changes as a consequence of typing and is the
            only thing telling the user whether the paste was any good. */}
        {parsed && !parsed.ok && (
          <Text style={[styles.status, { color: c.down }]} accessibilityLiveRegion="polite">
            {parsed.error}
          </Text>
        )}

        {preview && (
          <Text style={[styles.status, { color: c.textMuted }]} accessibilityLiveRegion="polite">
            {preview.total} subject{preview.total === 1 ? '' : 's'} found · {preview.summary}
          </Text>
        )}

        <Pressable
          onPress={onRestore}
          disabled={!parsed?.ok}
          style={({ pressed }) => [
            styles.button,
            styles.primary,
            !parsed?.ok && styles.disabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !parsed?.ok }}
          accessibilityLabel={
            preview
              ? `Restore ${preview.added} new subject${preview.added === 1 ? '' : 's'}`
              : 'Restore. Paste a valid backup first.'
          }
        >
          <Text style={[styles.buttonText, styles.primaryText]}>
            {preview && preview.added > 0 ? `Add ${preview.added}` : 'Restore'}
          </Text>
        </Pressable>

        {result && (
          <View style={styles.result} accessibilityLiveRegion="polite">
            <Ionicons name="checkmark-circle" size={15} color={c.up} />
            <Text style={styles.resultText}>{result.message}</Text>
          </View>
        )}
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

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.bg,
  },
  content: {
    padding: space.lg,
    paddingBottom: space.xxl,
    gap: space.xl,
  },
  lede: {
    ...type.bodyTight,
    color: c.textMuted,
    lineHeight: 20,
  },
  section: {
    gap: space.sm,
  },
  sectionTitle: {
    ...type.micro,
    color: c.textMuted,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    padding: space.lg,
    gap: space.md,
  },
  note: {
    ...type.caption,
    color: c.textMuted,
    lineHeight: 17,
  },
  code: {
    ...type.caption,
    color: c.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.md,
    padding: space.md,
    // Tall enough to show that something is there, short enough not to bury the
    // controls under it.
    maxHeight: 220,
  },
  codeInput: {
    minHeight: 120,
    color: c.text,
  },
  status: {
    ...type.caption,
    lineHeight: 17,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  primary: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  disabled: {
    opacity: 0.4,
  },
  buttonText: {
    ...type.label,
    color: c.accent,
  },
  primaryText: {
    color: c.onAccent,
  },
  pressed: {
    opacity: 0.8,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: toneChip(c.up),
  },
  resultText: {
    ...type.caption,
    color: c.up,
    flex: 1,
    lineHeight: 17,
  },
}));
