import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { describe } from '@/providers/registry';
import type { SourceId } from '@/providers/types';
import { iconName } from '../icons';
import { radius, space, tint, type } from '../theme';

interface Props {
  source: SourceId;
  /** Icon only (feed cards) vs icon + label (section headers). */
  showLabel?: boolean;
  size?: number;
}

/**
 * The "where did this come from" marker, on every feed card.
 *
 * Decorative: the source is already named in the card's own accessibility
 * label, so this is hidden from assistive tech rather than announced twice.
 */
export function SourceBadge({ source, showLabel = false, size = 20 }: Props) {
  const { color, icon, label } = describe(source);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.badge,
        {
          backgroundColor: tint(color, 0.16),
          borderRadius: showLabel ? radius.pill : radius.sm,
          paddingHorizontal: showLabel ? space.sm : 0,
          width: showLabel ? undefined : size,
          height: size,
        },
      ]}
    >
      <Ionicons name={iconName(icon)} size={size * 0.62} color={color} />
      {showLabel && <Text style={[styles.label, { color }]}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  label: {
    ...type.micro,
  },
});
