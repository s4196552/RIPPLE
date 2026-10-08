import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { glyph, iconName } from '../icons';
import { makeStyles, useTheme } from '../ThemeProvider';
import { radius, space, type } from '../theme';
import { Glyph } from './Glyph';

interface Props {
  icon: string;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void; icon?: string };
  children?: ReactNode;
}

export function EmptyState({ icon, title, body, action, children }: Props) {
  const c = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      {/* Restates the screen's own icon and says nothing the title does not —
          announcing it would just delay reaching the title. A bare glyph in a
          quiet tone, not a tinted ring: the title is what should catch the eye. */}
      <View accessibilityElementsHidden importantForAccessibility="no">
        <Glyph glyph={glyph(icon)} size={28} color={c.textSubtle} />
      </View>

      {/* Marked as a heading so screen-reader users can jump straight to what
          the screen is telling them rather than reading down to it. */}
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.body}>{body}</Text>

      {action && (
        <Pressable
          onPress={action.onPress}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          accessibilityRole="button"
        >
          {action.icon ? (
            <Ionicons name={iconName(action.icon)} size={17} color={c.onAccent} />
          ) : null}
          <Text style={styles.buttonText}>{action.label}</Text>
        </Pressable>
      )}
      {children}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingTop: 96,
    gap: space.sm,
  },
  title: {
    ...type.heading,
    fontSize: 17,
    color: c.text,
    textAlign: 'center',
    marginTop: space.xs,
  },
  body: {
    ...type.bodyTight,
    color: c.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.md,
    paddingHorizontal: space.lg,
    minHeight: 44,
    borderRadius: radius.md,
    backgroundColor: c.accent,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    ...type.label,
    color: c.onAccent,
  },
}));
