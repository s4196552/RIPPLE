import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PLATFORM_LABEL } from '@/lib/social';
import type { SocialLink, SocialPlatform, SubjectProfile } from '@/providers/types';
import { makeStyles, useTheme } from '@/ui/ThemeProvider';
import { font, radius, space, type } from '@/ui/theme';

/** FontAwesome6's brand marks. Truth Social and a plain website have none. */
const BRAND_ICON: Partial<Record<SocialPlatform, string>> = {
  x: 'x-twitter',
  instagram: 'instagram',
  facebook: 'facebook',
  youtube: 'youtube',
  threads: 'threads',
  bluesky: 'bluesky',
  mastodon: 'mastodon',
  tiktok: 'tiktok',
};

interface Props {
  profile: SubjectProfile;
  onOpen: (link: SocialLink) => void;
}

/**
 * Who a subject is and where they post: a few facts, then one chip per public
 * account. Each chip is its own button, side by side, never nested.
 */
export function ProfileCard({ profile, onOpen }: Props) {
  const styles = useStyles();
  if (profile.facts.length === 0 && profile.links.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        Profile
      </Text>
      {profile.facts.map((fact) => (
        <Text key={fact} style={styles.fact}>
          {fact}
        </Text>
      ))}
      {profile.links.length > 0 && (
        <>
          <View style={styles.links}>
            {profile.links.map((link) => (
              <LinkChip key={link.url} link={link} onOpen={onOpen} />
            ))}
          </View>
          <Text style={styles.provenance}>{profile.provenance}</Text>
        </>
      )}
    </View>
  );
}

function LinkChip({ link, onOpen }: { link: SocialLink; onOpen: (link: SocialLink) => void }) {
  const styles = useStyles();
  const platform = PLATFORM_LABEL[link.platform];
  // Spoken as one phrase: "President Trump on Truth Social, @realDonaldTrump".
  const whose = link.owner ? `${link.owner} on ${platform}` : platform;

  return (
    <Pressable
      onPress={() => onOpen(link)}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
      accessibilityRole="link"
      accessibilityLabel={`${whose}, ${link.handle}`}
      accessibilityHint="Opens in the browser"
    >
      <PlatformMark platform={link.platform} />
      <View style={styles.chipBody}>
        <Text style={styles.chipHandle} numberOfLines={1}>
          {link.handle}
        </Text>
        {link.owner ? (
          <Text style={styles.chipOwner} numberOfLines={1}>
            {link.owner}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function PlatformMark({ platform }: { platform: SocialPlatform }) {
  const c = useTheme();
  const styles = useStyles();
  const brand = BRAND_ICON[platform];
  if (brand) return <FontAwesome6 name={brand} size={15} color={c.text} brand />;
  if (platform === 'website') return <Ionicons name="globe-outline" size={16} color={c.text} />;
  // Truth Social: a lettered badge rather than a borrowed logo.
  return (
    <View style={styles.letterBadge}>
      <Text style={styles.letter}>T</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    marginTop: 14,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    borderRadius: radius.lg,
    padding: space.md,
    gap: 2,
  },
  title: {
    ...type.body,
    fontFamily: font.semibold,
    color: c.text,
    marginBottom: 2,
  },
  fact: {
    ...type.bodyTight,
    color: c.textMuted,
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.sm,
  },
  chip: {
    minHeight: 44,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.bg,
  },
  chipBody: {
    flexShrink: 1,
  },
  chipHandle: {
    ...type.bodyTight,
    fontFamily: font.semibold,
    color: c.text,
  },
  chipOwner: {
    ...type.caption,
    color: c.textMuted,
  },
  pressed: {
    opacity: 0.8,
  },
  letterBadge: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: c.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontFamily: font.bold,
    fontSize: 11,
    lineHeight: 13,
    color: c.bg,
  },
  provenance: {
    ...type.caption,
    color: c.textSubtle,
    marginTop: space.sm,
  },
}));
