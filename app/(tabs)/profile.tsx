import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { clearAvatar, pickAvatar } from '@/lib/avatar';
import { successFeedback } from '@/lib/feedback';
import { useProfile } from '@/store/profile';
import { useWatchlist } from '@/store/watchlist';
import { TabIcon } from '@/ui/components/TabIcon';
import { useTabBarSpace } from '@/ui/components/FloatingTabBar';
import { TAB_ICONS } from '@/ui/tabIcons';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { font, radius, space, tint, type } from '@/ui/theme';

/**
 * The Profile tab: your photo, and the places that are about you rather than
 * the markets — settings, your backup, the policies.
 *
 * Ripple has no account, so the photo is the whole profile. It is chosen with
 * the system photo picker and kept on the device; nothing is uploaded.
 */
export default function ProfileScreen() {
  const c = useTheme();
  const styles = useStyles();
  const tabSpace = useTabBarSpace();
  const avatarUri = useProfile((s) => s.avatarUri);
  const following = useWatchlist((s) => s.subjects.length);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const choose = async () => {
    setBusy(true);
    setFailed(false);
    try {
      if (await pickAvatar()) {
        successFeedback();
        AccessibilityInfo.announceForAccessibility('Profile photo updated');
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    clearAvatar();
    AccessibilityInfo.announceForAccessibility('Profile photo removed');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingBottom: tabSpace }]}>
      <View style={styles.identity}>
        <Pressable
          onPress={choose}
          disabled={busy}
          style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={avatarUri ? 'Change profile photo' : 'Add a profile photo'}
          accessibilityHint="Opens your photo library"
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.photo} accessibilityIgnoresInvertColors />
          ) : (
            <TabIcon spec={TAB_ICONS.profile} color={c.textMuted} knockColor={c.surface} selected={false} size={56} />
          )}
        </Pressable>

        <View style={styles.photoActions}>
          <Pressable
            onPress={choose}
            disabled={busy}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="image-outline" size={18} color={c.onAccent} />
            <Text style={styles.primaryText}>{avatarUri ? 'Change photo' : 'Add photo'}</Text>
          </Pressable>
          {avatarUri ? (
            <Pressable
              onPress={remove}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Remove profile photo"
            >
              <Text style={styles.secondaryText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>

        {failed ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            Couldn’t use that photo. Try another one.
          </Text>
        ) : null}
        <Text style={styles.note}>
          Your photo stays on this device. Ripple has no account, so it is never uploaded.
        </Text>
      </View>

      <View style={styles.card}>
        <Row icon="options-outline" label="Settings" detail="Theme, colours, refresh" href="/settings" />
        <Row icon="bookmark-outline" label="Back up your watchlist" detail={`${following} followed`} href="/backup" />
        <Row icon="shield-checkmark-outline" label="Privacy Policy" href="/privacy" />
        <Row icon="reader-outline" label="Terms of Service" href="/terms" last />
      </View>
    </ScrollView>
  );
}

function Row({
  icon,
  label,
  detail,
  href,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  href: Href;
  last?: boolean;
}) {
  const c = useTheme();
  const styles = useStyles();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.row, !last && styles.rule, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
    >
      <Ionicons name={icon} size={20} color={c.textMuted} />
      <Text style={styles.rowLabel}>{label}</Text>
      {detail ? <Text style={styles.rowDetail}>{detail}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={c.textSubtle} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.bg,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    gap: space.xl,
  },
  identity: {
    alignItems: 'center',
    gap: space.md,
    paddingTop: space.lg,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    overflow: 'hidden',
  },
  photo: {
    width: 112,
    height: 112,
  },
  photoActions: {
    flexDirection: 'row',
    gap: space.sm,
  },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: 22,
    backgroundColor: c.accent,
  },
  primaryText: {
    ...type.label,
    fontSize: 15,
    color: c.onAccent,
  },
  secondary: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: 22,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  secondaryText: {
    ...type.label,
    fontSize: 15,
    color: c.text,
  },
  pressed: {
    opacity: 0.8,
  },
  error: {
    ...type.caption,
    color: c.textMuted,
  },
  note: {
    ...type.caption,
    color: c.textSubtle,
    textAlign: 'center',
    maxWidth: 280,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    paddingHorizontal: space.lg,
  },
  rule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  rowPressed: {
    backgroundColor: tint(c.accent, 0.08),
  },
  rowLabel: {
    ...type.body,
    fontFamily: font.medium,
    color: c.text,
    flex: 1,
  },
  rowDetail: {
    ...type.caption,
    color: c.textSubtle,
  },
}));
