import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { partyTag, withoutParty } from '@/lib/filing';
import { shortDate } from '@/lib/timeline';
import type { WatchedSubject } from '@/store/watchlist';
import { groupGlyph } from '../groupGlyph';
import { makeStyles, useTheme } from '../ThemeProvider';
import { font, radius, space, type } from '../theme';
import { Avatar } from './Avatar';

const WEEK = 7 * 86_400_000;

type Choice = 'off' | 'week' | 'forever';

interface Props {
  subject: WatchedSubject | null;
  onClose: () => void;
  /** `false` unmutes, `null` mutes until unmuted, a time mutes until then. */
  onSaveMute: (until: number | null | false) => void;
  onUnfollow: () => void;
}

/**
 * What you can do to a follow: mute it for a while, or for good, or stop
 * following. A sheet rather than an alert, because muting now has a length to
 * choose, and an alert's buttons do not render on web.
 */
export function WatchActionsSheet({ subject, onClose, onSaveMute, onUnfollow }: Props) {
  const c = useTheme();
  const styles = useStyles();
  const [choice, setChoice] = useState<Choice>('off');
  const now = Date.now();

  // Opens on the follow's current state, not the last one picked.
  useEffect(() => {
    if (!subject) return;
    setChoice(!subject.muted ? 'off' : subject.mutedUntil != null ? 'week' : 'forever');
  }, [subject]);

  if (!subject) return null;
  const party = partyTag(subject.subtitle);
  const place = party ? withoutParty(subject.subtitle) : subject.subtitle;
  const weekEnd = subject.muted && subject.mutedUntil != null ? subject.mutedUntil : now + WEEK;
  const until = new Date(weekEnd).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const options: { value: Choice; label: string; detail?: string }[] = [
    { value: 'off', label: 'Not muted', detail: 'Filings show in Signals' },
    { value: 'week', label: 'Mute for 7 days', detail: `Until ${until}` },
    { value: 'forever', label: 'Mute until I unmute' },
  ];

  const save = () => {
    onSaveMute(choice === 'off' ? false : choice === 'week' ? weekEnd : null);
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} />
        </Pressable>

        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <Avatar
              uri={subject.avatarUrl}
              name={subject.displayName}
              glyph={groupGlyph(subject.source, subject.handle)?.glyph}
              size={44}
              square={subject.source === 'stocks' || subject.source === 'insider'}
            />
            <View style={styles.headBody}>
              <Text style={styles.name} accessibilityRole="header" numberOfLines={1}>
                {subject.displayName}
              </Text>
              <View style={styles.subLine}>
                {party ? (
                  <View style={styles.party}>
                    <Text style={styles.partyText}>{party}</Text>
                  </View>
                ) : null}
                <Text style={styles.sub} numberOfLines={1}>
                  {[place, subject.addedAt > 0 ? `following since ${shortDate(subject.addedAt)}` : '']
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={c.text} />
            </Pressable>
          </View>

          <Text style={styles.section}>Mute</Text>
          <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Mute">
            {options.map((o, i) => {
              const on = o.value === choice;
              return (
                <Pressable
                  key={o.value}
                  onPress={() => setChoice(o.value)}
                  style={({ pressed }) => [styles.option, i > 0 && styles.rule, pressed && styles.pressed]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={o.detail ? `${o.label}. ${o.detail}` : o.label}
                >
                  <View style={styles.optionBody}>
                    <Text style={styles.optionLabel}>{o.label}</Text>
                    {o.detail ? <Text style={styles.optionDetail}>{o.detail}</Text> : null}
                  </View>
                  <View style={[styles.radio, on && styles.radioOn]} />
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.note}>
            Muted follows stay in Watchlist, but leave Signals and stop being fetched.
          </Text>

          <Pressable onPress={save} style={({ pressed }) => [styles.primary, pressed && styles.pressedButton]} accessibilityRole="button">
            <Text style={styles.primaryText}>Save</Text>
          </Pressable>
          {/* Outlined in the down colour; the words stay ink. */}
          <Pressable
            onPress={onUnfollow}
            style={({ pressed }) => [styles.danger, pressed && styles.pressedButton]}
            accessibilityRole="button"
          >
            <Ionicons name="remove-circle-outline" size={18} color={c.down} />
            <Text style={styles.dangerText} numberOfLines={1}>
              Unfollow {subject.displayName}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: space.lg,
    paddingBottom: 40,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.border,
    marginBottom: 14,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xs,
    paddingBottom: 14,
  },
  headBody: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: font.bold,
    color: c.text,
  },
  subLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    color: c.textMuted,
  },
  sub: {
    ...type.label,
    fontFamily: font.regular,
    color: c.textSubtle,
    flexShrink: 1,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    ...type.caption,
    fontFamily: font.semibold,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: c.textSubtle,
    paddingHorizontal: space.xs,
    paddingBottom: space.sm,
  },
  options: {
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 56,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  rule: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
  },
  pressed: {
    backgroundColor: c.surfaceAlt,
  },
  optionBody: {
    flex: 1,
  },
  optionLabel: {
    ...type.body,
    fontSize: 16,
    fontFamily: font.semibold,
    color: c.text,
  },
  optionDetail: {
    ...type.label,
    fontFamily: font.medium,
    color: c.textSubtle,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: c.textSubtle,
  },
  radioOn: {
    borderWidth: 7,
    borderColor: c.accent,
  },
  note: {
    ...type.label,
    fontFamily: font.regular,
    lineHeight: 19,
    color: c.textMuted,
    marginTop: space.sm,
    marginBottom: space.lg,
    marginHorizontal: space.xs,
  },
  pressedButton: {
    opacity: 0.85,
  },
  primary: {
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    ...type.body,
    fontSize: 16,
    fontFamily: font.semibold,
    color: c.onAccent,
  },
  danger: {
    minHeight: 52,
    marginTop: space.sm,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: c.down,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: 20,
  },
  dangerText: {
    ...type.body,
    fontSize: 16,
    fontFamily: font.semibold,
    color: c.text,
    flexShrink: 1,
  },
}));
