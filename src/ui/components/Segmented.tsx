import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tapFeedback } from '@/lib/feedback';
import { makeStyles } from '../ThemeProvider';
import { font, radius, space, type } from '../theme';

interface Props<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string; spoken?: string }[];
  fill?: boolean;
  /** Set the labels in mono — for figures like 30D and 1Y. */
  mono?: boolean;
}

/** Shared single-choice control used by Settings and the timeline range. */
export function Segmented<T extends string>({ label, value, onChange, options, fill = false, mono = false }: Props<T>) {
  const styles = useStyles();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.group, fill && styles.fill]}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${option.spoken ?? option.label}`}
            accessibilityState={{ checked: selected }}
            onPress={() => {
              if (!selected) {
                tapFeedback();
                onChange(option.value);
              }
            }}
            style={({ pressed }) => [styles.option, fill && styles.grow, selected && styles.selected, pressed && styles.pressed]}
          >
            <Text style={[styles.text, mono && styles.mono, selected && styles.selectedText]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(c => ({
  group: { flexDirection: 'row', flexWrap: 'wrap', padding: 3, gap: 3, borderRadius: radius.md, backgroundColor: c.surfaceAlt },
  fill: { alignSelf: 'stretch' },
  option: { minHeight: 44, paddingHorizontal: space.md, paddingVertical: space.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  grow: { flexGrow: 1 },
  selected: { backgroundColor: c.raised, borderWidth: StyleSheet.hairlineWidth, borderColor: c.borderStrong },
  pressed: { opacity: 0.75 },
  text: { ...type.label, color: c.textMuted },
  mono: { fontFamily: font.monoSemibold, fontSize: 14 },
  selectedText: { color: c.text },
}));
