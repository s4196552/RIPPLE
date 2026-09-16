import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  StyleSheet,
  useColorScheme,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { usePreferences } from '@/store/preferences';
import { PALETTES, darkPalette, type Palette, type ThemeName } from './theme';

/**
 * Runtime theming.
 *
 * Palettes are reached through this module rather than imported, because a
 * palette imported at module scope is captured by `StyleSheet.create` at import
 * time and can never change again. `makeStyles` is the replacement: it takes
 * the same style object the file used to declare statically, but as a function
 * of the palette, and caches the result per palette so switching themes is not
 * paying to rebuild every stylesheet on every render.
 */

const ThemeContext = createContext<Palette>(darkPalette);
const ThemeNameContext = createContext<ThemeName>('dark');

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = usePreferences((s) => s.theme);
  // `useColorScheme` re-renders on OS theme changes, so 'system' tracks the
  // device live rather than only at launch.
  const system = useColorScheme();

  const name: ThemeName =
    preference === 'system' ? (system === 'light' ? 'light' : 'dark') : preference;

  const palette = PALETTES[name];

  return (
    <ThemeNameContext.Provider value={name}>
      <ThemeContext.Provider value={palette}>{children}</ThemeContext.Provider>
    </ThemeNameContext.Provider>
  );
}

/** The colours to paint with right now. */
export function useTheme(): Palette {
  return useContext(ThemeContext);
}

/**
 * Which palette is actually rendering.
 *
 * Distinct from the preference: a user on 'system' is on one or the other, and
 * things like the status bar style need to know which, not what was picked.
 */
export function useThemeName(): ThemeName {
  return useContext(ThemeNameContext);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Mirrors `StyleSheet.create`'s own generic.
 *
 * A plain `Record<string, any>` looks equivalent but is not: it widens every
 * literal, so `alignItems: 'center'` infers as `string` and no longer satisfies
 * `FlexAlignType`. Constraining `T` by itself is what makes TypeScript keep the
 * literal types, exactly as the real `StyleSheet.create` does.
 */
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * Declares a stylesheet as a function of the palette.
 *
 * Returns a hook, so a file keeps the same shape it had before:
 *
 *   const useStyles = makeStyles((c) => ({ wrap: { backgroundColor: c.bg } }));
 *   // ...then inside the component:
 *   const styles = useStyles();
 *
 * The cache is keyed on the palette object identity. There are exactly two of
 * those and they are module constants, so it holds at most two entries per
 * call site and never grows.
 */
export function makeStyles<T extends NamedStyles<T> | NamedStyles<any>>(
  factory: (palette: Palette) => T & NamedStyles<any>,
): () => T {
  const cache = new Map<Palette, T>();

  return function useStyles(): T {
    const palette = useTheme();

    return useMemo(() => {
      const cached = cache.get(palette);
      if (cached) return cached;

      const created = StyleSheet.create(factory(palette)) as T;
      cache.set(palette, created);
      return created;
    }, [palette]);
  };
}
