import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View, type ColorValue } from 'react-native';
import { useFeedSync } from '@/hooks/useFeedSync';
import { usePreferences } from '@/store/preferences';
import { useTheme } from '@/ui/ThemeProvider';
import { font, space, tapSlop, type } from '@/ui/theme';
import { Glyph } from '@/ui/components/Glyph';

export default function TabsLayout() {
  const c = useTheme();
  // Mounted here, not on the feed screen: this component outlives all three
  // tabs, so the data is loading whichever tab the user opens first. Landing on
  // Timeline used to show an empty axis until you had visited Signals.
  useFeedSync();

  // First launch: the introduction, before any tab. The feed is already
  // syncing above, so it has content waiting by the time it is finished.
  const onboarded = usePreferences((s) => s.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerTitleAlign: 'left',
        // The redesign's header: a large plain title, with Follow and Settings
        // on the right. The logo stays on the launch screen and onboarding.
        headerTitle: ({ children }) => (
          <Text accessibilityRole="header" style={{ ...type.display, color: c.text }}>
            {children}
          </Text>
        ),
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: c.bg },
        // No back/forward/home cluster on the tabs. Back is always inert at a
        // tab root and home duplicates the first tab. Stack screens still get
        // it from the root layout.
        headerRight: () => <HeaderActions />,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          // On web the bar is a fixed 49 with no safe-area inset to grow into,
          // and the label box was squeezed to 10px under the icon — every
          // descender clipped. Native keeps the navigator's own inset-aware
          // height, which setting `height` here would throw away.
          ...(Platform.OS === 'web' ? { height: 60, paddingTop: 6, paddingBottom: 6 } : null),
        },
        // The icon takes the accent; the label stays in ink. Small text never
        // sits in an accent colour (see `@/ui/theme`), and the accent fill on
        // the icon plus the heavier label still mark the selected tab.
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textSubtle,
        tabBarLabel: ({ focused, children }) => (
          <Text
            style={{
              ...type.micro,
              letterSpacing: 0,
              fontFamily: focused ? font.bold : font.semibold,
              color: focused ? c.text : c.textSubtle,
              // `flexShrink: 0` because on web the label is a flex child under
              // a growing icon slot, and it was the one that shrank.
              flexShrink: 0,
            }}
          >
            {children}
          </Text>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Signals',
          // The logo's ripple, as a mark: three rings.
          tabBarIcon: ({ color }) => <RingsIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="trades"
        options={{
          title: 'Trades',
          tabBarIcon: ({ color, size }) => (
            <Glyph glyph={{ family: 'mci', name: 'swap-vertical' }} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: 'Timeline',
          tabBarIcon: ({ color, size }) => (
            <Glyph glyph={{ family: 'mci', name: 'chart-timeline-variant' }} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Watchlist',
          tabBarIcon: ({ color, size }) => <Ionicons name="bookmark-outline" size={size - 2} color={color} />,
        }}
      />
    </Tabs>
  );
}

/** Three concentric rings, drawn rather than borrowed from an icon font. */
function RingsIcon({ color }: { color: ColorValue }) {
  return (
    <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
      {[20, 12, 4].map((d) => (
        <View
          key={d}
          style={{
            position: 'absolute',
            width: d,
            height: d,
            borderRadius: d / 2,
            borderWidth: 1.75,
            borderColor: color,
          }}
        />
      ))}
    </View>
  );
}

/**
 * Follow and Settings, on every tab.
 *
 * Follow is the one primary action in the app, so it lives in the header
 * where every tab can reach it — it was a floating button on Signals alone.
 * Settings is not a destination anyone visits often, so it is an icon.
 */
function HeaderActions() {
  const c = useTheme();
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingRight: space.sm }}>
      <Pressable
        onPress={() => router.push('/add')}
        style={({ pressed }) => ({
          height: 40,
          paddingLeft: space.md,
          paddingRight: space.lg,
          borderRadius: 20,
          backgroundColor: c.accent,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          opacity: pressed ? 0.85 : 1,
        })}
        hitSlop={tapSlop(40)}
        accessibilityRole="button"
        accessibilityLabel="Follow a subject"
      >
        <Ionicons name="add" size={20} color={c.onAccent} />
        <Text style={{ ...type.label, fontSize: 15, color: c.onAccent }}>Follow</Text>
      </Pressable>
      <Pressable
        onPress={() => router.push('/settings')}
        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <Ionicons name="options-outline" size={24} color={c.text} />
      </Pressable>
    </View>
  );
}
