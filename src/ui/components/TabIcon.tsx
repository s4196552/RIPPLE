import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { TabIconSpec } from '../tabIcons';

interface Props {
  spec: TabIconSpec;
  color: string;
  /** The bar's background, used to cut detail out of a solid selected fill. */
  knockColor: string;
  selected: boolean;
  size?: number;
}

/** One tab icon: its outline, plus the shape that fills when selected. */
export function TabIcon({
  spec,
  color,
  knockColor,
  selected,
  size = 24,
}: Props) {
  const fillOpacity = selected ? spec.fillSelected : spec.fillIdle;
  return (
    // Hidden from screen readers on the wrapping View: the tab's own label
    // says what it is. (On web, Svg passes these props to the DOM, where they
    // are not attributes.)
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {fillOpacity > 0 ? (
          <Path d={spec.fill} fill={color} fillOpacity={fillOpacity} />
        ) : null}
        <Path
          d={spec.stroke}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {spec.knock && selected ? (
          <Path
            d={spec.knock}
            fill="none"
            stroke={knockColor}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </Svg>
    </View>
  );
}
