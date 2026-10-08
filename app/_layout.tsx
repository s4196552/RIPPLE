import {
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useNavHistoryRecorder } from '@/hooks/useNavControls';
import { usePreferences } from '@/store/preferences';
import { NavControls } from '@/ui/components/NavControls';
import { ThemeProvider, useTheme, useThemeName } from '@/ui/ThemeProvider';
import { isDark, type } from '@/ui/theme';
import { BRAND, BrandBackdrop } from '@/ui/components/BrandBackdrop';
import { RippleLogo } from '@/ui/components/RippleLogo';

/**
 * Root layout.
 *
 * Split in two on purpose: the provider has to be mounted above anything that
 * calls `useTheme`, and this component is the top of the tree, so the chrome
 * that needs a palette lives in `Chrome` underneath it.
 */
export default function RootLayout() {
  // Recorded here rather than per screen: this component outlives every route,
  // so it sees the whole trail.
  useNavHistoryRecorder();

  const hydrated = usePreferences((s) => s.hydrated);
  // Keyed by the names `font` in `@/ui/theme` refers to. A font that fails to
  // load falls back to the system face rather than holding the app hostage,
  // hence `|| fontError`.
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  /*
   * Nothing renders until the theme preference is back from disk.
   *
   * Preferences rehydrate asynchronously, and the default is 'system'. Without
   * this gate, someone who explicitly chose light would get a dark flash on
   * every cold start while the stored value loaded — the app briefly overriding
   * a choice they made. It is one AsyncStorage read, the same gate the feed
   * already waits on, and the placeholder is painted so the gap reads as the
   * app starting rather than as a blank frame.
   */
  if (!hydrated || !(fontsLoaded || fontError)) {
    // The same brand backdrop the introduction opens on, so a first launch
    // reads as one continuous moment rather than a flash and then a screen.
    return (
      <BrandBackdrop glowAt={0.5}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <RippleLogo size={160} />
        </View>
      </BrandBackdrop>
    );
  }

  return (
    <ThemeProvider>
      <Chrome />
    </ThemeProvider>
  );
}

function Chrome() {
  const c = useTheme();
  const themeName = useThemeName();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaProvider>
        {/* Inverted against the page: dark page wants light glyphs. */}
        <StatusBar style={isDark(themeName) ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: c.bg },
            headerTintColor: c.text,
            headerTitleStyle: { ...type.heading, color: c.text },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: c.bg },
            // Replaces the native back chevron: our cluster already leads with
            // back, and two back buttons on one header is one too many.
            headerLeft: () => <NavControls />,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="onboarding"
            options={{
              headerShown: false,
              animation: 'fade',
              // Leaving is a choice the screen offers (Skip, Get started), not a
              // swipe that could happen by accident mid-page.
              gestureEnabled: false,
              contentStyle: { backgroundColor: BRAND.ink },
            }}
          />
          <Stack.Screen
            name="add/index"
            options={{ title: 'Add a subject', presentation: 'modal' }}
          />
          <Stack.Screen name="add/[source]" options={{ title: 'Search' }} />
          <Stack.Screen name="subject/[source]/[handle]" options={{ title: '' }} />
          <Stack.Screen name="filing/[id]" options={{ title: '' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="terms" options={{ title: 'Terms of Service' }} />
          <Stack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
