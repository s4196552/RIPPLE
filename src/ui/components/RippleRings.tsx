import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { BRAND } from './BrandBackdrop';

interface Props {
  /** Diameter of the widest ring. */
  size: number;
  color?: string;
}

const RINGS = 3;
const PERIOD_MS = 4800;

/**
 * The logo's ripple, moving: rings that leave the mark and fade as they widen.
 *
 * Decorative only — hidden from assistive tech. With Reduce Motion on, the
 * rings hold still at evenly spaced sizes, which keeps the motif without the
 * movement.
 */
export function RippleRings({ size, color = BRAND.sky }: Props) {
  const reduceMotion = useReducedMotion();
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { width: size, height: size }]}
    >
      {Array.from({ length: RINGS }, (_, i) => (
        <Ring key={i} index={i} size={size} color={color} still={reduceMotion} />
      ))}
    </View>
  );
}

function Ring({ index, size, color, still }: { index: number; size: number; color: string; still: boolean }) {
  // Progress through one ring's life, 0 (at the mark) to 1 (gone).
  const progress = useSharedValue(still ? (index + 1) / (RINGS + 1) : 0);

  useEffect(() => {
    if (still) return;
    progress.value = withDelay(
      (index * PERIOD_MS) / RINGS,
      withRepeat(withTiming(1, { duration: PERIOD_MS, easing: Easing.out(Easing.quad) }), -1, false),
    );
  }, [index, progress, still]);

  const style = useRingStyle(progress, still);
  return (
    <Animated.View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, borderColor: color },
        style,
      ]}
    />
  );
}

function useRingStyle(progress: SharedValue<number>, still: boolean) {
  return useAnimatedStyle(() => {
    const p = progress.value;
    return {
      transform: [{ scale: 0.42 + 0.58 * p }],
      // Still rings keep a steady, quiet presence; moving ones fade as they go.
      opacity: still ? 0.32 - 0.18 * p : 0.55 * (1 - p),
    };
  });
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
});
