import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { iconName } from '../icons';
import { makeStyles, useTheme } from '../ThemeProvider';
import { radius, space, tint, type } from '../theme';

interface Props {
  icon: string;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
  children?: ReactNode;
}

export function EmptyState({ icon, title, body, action, children }: Props) {
  const c = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      {/* The ring restates the screen's own icon and says nothing the title
          does not — announcing it would just delay reaching the title. */}
      <View style={styles.iconRing} accessibilityElementsHidden importantForAccessibility="no">
        <Ionicons name={iconName(icon)} size={26} color={c.accent} />
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
    paddingTop: 72,
    gap: space.md,
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tint(c.accent, 0.12),
  },
  title: {
    ...type.title,
    color: c.text,
    textAlign: 'center',
  },
  body: {
    ...type.body,
    color: c.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
  button: {
    marginTop: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  buttonText: {
    ...type.label,
    color: c.onAccent,
  },
}));
