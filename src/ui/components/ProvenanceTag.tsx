import { Text, View } from 'react-native';
import type { ProviderMode } from '@/providers/types';
import { makeStyles } from '../ThemeProvider';
import { space, type } from '../theme';

const labels: Record<ProviderMode, string> = {
  live: 'Live · keyed',
  public: 'Live · no key',
  mock: 'Offline sample',
};

/** Explicit provenance text: data status stays readable without colour cues. */
export function ProvenanceTag({ mode }: { mode: ProviderMode }) {
  const styles = useStyles();
  return (
    <View style={styles.tag}>
      {/* The word says it; the warning dot only draws the eye. The shared
          warning colour is below AA as small text on White. */}
      {mode === 'mock' ? <View style={styles.dot} /> : null}
      <Text style={[styles.text, mode === 'mock' && styles.offline]}>{labels[mode]}</Text>
    </View>
  );
}

const useStyles = makeStyles(c => ({
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 2, paddingHorizontal: space.xs },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.warning },
  text: { ...type.caption, color: c.textMuted },
  offline: { color: c.text },
}));
