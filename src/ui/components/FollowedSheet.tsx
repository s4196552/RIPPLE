import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { AccessibilityInfo, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { partyTag, withoutParty } from '@/lib/filing';
import type { SubjectResult } from '@/providers/types';
import { FOLLOW_COPY } from '../followCopy';
import { subjectAvatar } from '../subjectAvatar';
import { makeStyles, useTheme } from '../ThemeProvider';
import { font, type } from '../theme';
import { Avatar } from './Avatar';

interface Props {
  subject: SubjectResult | null;
  onDone: () => void;
  onFollowAnother: () => void;
  onDismiss: () => void;
}

/**
 * The confirmation after a follow: who, what that means, and where next.
 *
 * A sheet rather than a toast, as the design has it, because it is the moment
 * to say what will happen now — and it offers the two ways on, so following
 * one thing doesn't strand anyone on a search screen.
 */
export function FollowedSheet({ subject, onDone, onFollowAnother, onDismiss }: Props) {
  const c = useTheme();
  const styles = useStyles();

  useEffect(() => {
    if (subject) AccessibilityInfo.announceForAccessibility(`You’re following ${subject.displayName}`);
  }, [subject]);

  if (!subject) return null;
  const party = partyTag(subject.subtitle);
  const place = withoutParty(subject.subtitle);

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onDismiss}>
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} />
        </Pressable>

        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.grabber} />

          {/* The ripple: the avatar inside a dashed outer ring and an accent
              inner one, with the tick seated on its edge. */}
          <View style={styles.art} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <View style={styles.outerRing} />
            <View style={styles.innerRing} />
            <Avatar
              {...subjectAvatar(subject.source, subject.handle, subject.avatarUrl)}
              name={subject.displayName}
              size={64}
            />
            <View style={styles.tick}>
              <Ionicons name="checkmark" size={15} color={c.onAccent} />
            </View>
          </View>

          <Text style={styles.title} accessibilityRole="header">
            You’re following {subject.displayName}
          </Text>
          <Text style={styles.body}>
            {/* Where a member sits, when this is one; a party or a ticker has
                nothing to add before the sentence. */}
            {party ? `${party} · ${place ? `${place} · ` : ''}` : ''}
            {FOLLOW_COPY[subject.source].after}
          </Text>

          <Pressable
            onPress={onDone}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Done — go to Signals</Text>
          </Pressable>
          <Pressable
            onPress={onFollowAnother}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>Follow someone else</Text>
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
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.border,
    marginBottom: 18,
  },
  art: {
    alignSelf: 'center',
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  outerRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 66,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: c.borderStrong,
  },
  innerRing: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    bottom: 18,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: c.accent,
    opacity: 0.55,
  },
  tick: {
    position: 'absolute',
    right: 30,
    bottom: 30,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: c.surface,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: font.bold,
    color: c.text,
    textAlign: 'center',
  },
  body: {
    ...type.body,
    lineHeight: 22,
    color: c.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  pressed: {
    opacity: 0.85,
  },
  primary: {
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryText: {
    ...type.body,
    fontSize: 16,
    fontFamily: font.semibold,
    color: c.onAccent,
  },
  secondary: {
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: c.text,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  secondaryText: {
    ...type.body,
    fontSize: 16,
    fontFamily: font.semibold,
    color: c.text,
  },
}));
