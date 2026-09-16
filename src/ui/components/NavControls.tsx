import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { useNavControls } from '@/hooks/useNavControls';
import { makeStyles, useTheme } from '../ThemeProvider';
import { radius, space } from '../theme';

const ICON_SIZE = 20;
const BUTTON_SIZE = 32;
/** Pads the 32pt button out to the ~44pt minimum touch target. */
const SLOP = (44 - BUTTON_SIZE) / 2;

interface ButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

function NavButton({ icon, label, onPress, disabled = false }: ButtonProps) {
  const c = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={SLOP}
      style={({ pressed }) => [styles.button, pressed && !disabled && styles.buttonPressed]}
      accessibilityRole="button"
      // Icon-only, so the label is the only thing assistive tech can announce.
      accessibilityLabel={label}
      // Announced as dimmed rather than silently doing nothing when tapped.
      accessibilityState={{ disabled }}
    >
      <Ionicons
        name={icon}
        size={ICON_SIZE}
        // `textFaint` is 3.3:1 against the background, below the 4.5:1 AA needs
        // for text — but WCAG 1.4.11 exempts genuinely inactive controls, and
        // dimming is what makes "unavailable" legible to everyone else.
        // Enabled icons use `text` at 16.5:1.
        color={disabled ? c.textFaint : c.text}
      />
    </Pressable>
  );
}

/**
 * Back, forward and home, as a single cluster in the header.
 *
 * Placed on every screen — including the tabs, where back is usually inert —
 * so the controls never move or reorder between screens. A control that
 * relocates is harder to find than one that is simply dimmed.
 */
export function NavControls() {
  const styles = useStyles();
  const { canGoBack, canGoForward, goBack, goForward, goHome } = useNavControls();

  return (
    <View style={styles.row}>
      <NavButton icon="chevron-back" label="Go back" onPress={goBack} disabled={!canGoBack} />
      <NavButton
        icon="chevron-forward"
        label="Go forward"
        onPress={goForward}
        disabled={!canGoForward}
      />
      <NavButton icon="home-outline" label="Go to Signals home" onPress={goHome} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingRight: space.sm,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  buttonPressed: {
    backgroundColor: c.surfaceAlt,
  },
}));
