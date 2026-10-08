import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * The logo's own colours, as a page: the indigo at its core falling away to
 * the app's ink, with a royal-blue bloom where the eye should land.
 *
 * Always these colours, in either theme. This is the brand moment — first
 * launch and cold start — and it reads as the logo, not as a themed screen.
 */
export const BRAND = {
  indigo: '#1F0766',
  core: '#150438',
  royal: '#1B42A9',
  sky: '#21A1E4',
  /** `darkPalette.bg`: the page the rest of the app sits on, so the hand-off is seamless. */
  ink: '#0B0918',
  text: '#F4F3FB',
  /** 7.9:1 on the indigo, 9.6:1 on the ink. */
  muted: '#B2ADCE',
} as const;

interface Props {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Where the bloom centres, as a fraction of the height. */
  glowAt?: number;
}

export function BrandBackdrop({ children, style, glowAt = 0.32 }: Props) {
  return (
    <View style={[styles.fill, style]}>
      <LinearGradient
        colors={[BRAND.indigo, BRAND.core, BRAND.ink]}
        locations={[0, 0.48, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* A soft radial bloom, built from stacked translucent discs: React
          Native has no radial gradient, and a single disc reads as a hard-edged
          coin rather than light. */}
      <View pointerEvents="none" style={[styles.glowAnchor, { top: `${glowAt * 100}%` }]}>
        {GLOW.map(([size, opacity]) => (
          <View
            key={size}
            style={[
              styles.glow,
              { width: size, height: size, borderRadius: size / 2, marginLeft: -size / 2, marginTop: -size / 2, opacity },
            ]}
          />
        ))}
      </View>
      {children}
    </View>
  );
}

/** [diameter, opacity], widest and faintest first. */
const GLOW: [number, number][] = [
  [620, 0.05],
  [500, 0.06],
  [390, 0.07],
  [290, 0.08],
  [200, 0.09],
];

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: BRAND.ink,
    overflow: 'hidden',
  },
  glowAnchor: {
    position: 'absolute',
    left: '50%',
    width: 0,
    height: 0,
  },
  glow: {
    position: 'absolute',
    backgroundColor: BRAND.royal,
  },
});
