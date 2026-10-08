import { Text, View } from 'react-native';
import { describe } from '@/providers/registry';
import type { SourceId } from '@/providers/types';
import { glyph } from '../icons';
import { makeStyles, useTheme } from '../ThemeProvider';
import { Glyph } from './Glyph';
import { radius, space, type } from '../theme';

interface Props {
  source: SourceId;
  /** Icon only vs icon + label. */
  showLabel?: boolean;
  size?: number;
}

/**
 * A source's icon on a neutral plate.
 *
 * Neutral, as everywhere in the redesign: sources are told apart by icon and
 * name, so colour stays free to mean direction. It used to be the source's own
 * colour on a tint of itself.
 *
 * Decorative: the source is always named beside it or in the row's label, so
 * this is hidden from assistive tech rather than announced twice.
 */
export function SourceBadge({ source, showLabel = false, size = 20 }: Props) {
  const c = useTheme();
  const styles = useStyles();
  const { icon, label } = describe(source);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.badge,
        {
          borderRadius: showLabel ? radius.pill : radius.sm,
          paddingHorizontal: showLabel ? space.sm : 0,
          width: showLabel ? undefined : size,
          height: size,
        },
      ]}
    >
      <Glyph glyph={glyph(icon)} size={size * 0.62} color={c.textMuted} />
      {showLabel && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    backgroundColor: c.surfaceAlt,
  },
  label: {
    ...type.micro,
    color: c.text,
  },
}));
