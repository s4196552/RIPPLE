import { Image, type ImageStyle, type StyleProp } from 'react-native';

interface Props {
  size?: number;
  /** Hide the image from accessibility when neighbouring text names the brand. */
  decorative?: boolean;
  style?: StyleProp<ImageStyle>;
}

/** Ripple's approved Original 1 mark, shared by native and web branding. */
export function RippleLogo({ size = 32, decorative = false, style }: Props) {
  return (
    <Image
      source={require('../../../assets/logo/ripple-original-1.png')}
      style={[{ width: size, height: size, flexShrink: 0 }, style]}
      resizeMode="contain"
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : 'Ripple logo'}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no' : 'auto'}
      accessibilityIgnoresInvertColors
    />
  );
}
