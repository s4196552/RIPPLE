import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useFeedSync } from '@/hooks/useFeedSync';
import { NavControls } from '@/ui/components/NavControls';
import { useTheme } from '@/ui/ThemeProvider';
import { space, tapSlop, type } from '@/ui/theme';

export default function TabsLayout() {
  const c = useTheme();
  // Mounted here, not on the feed screen: this component outlives all three
  // tabs, so the data is loading whichever tab the user opens first. Landing on
  // Timeline used to show an empty axis until you had visited Signals.
  useFeedSync();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.bg },
        headerTintColor: c.text,
        headerTitleStyle: { ...type.title, color: c.text },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: c.bg },
        // The tabs have their own headers, so the root Stack's copy of the
        // controls never renders here — they have to be added again.
        headerLeft: () => <NavControls />,
        headerRight: () => <SettingsButton />,
        tabBarStyle: {
          backgroundColor: c.bg,
          borderTopColor: c.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarActiveTintColor: c.accent,
        // Was `textFaint` (3.3:1), which fails AA. An unselected tab is not a
        // disabled control — it is the label of a place you can still go, and
        // it has to be readable to be worth going to. `textSubtle` clears 4.5:1
        // while staying clearly quieter than the selected tab.
        tabBarInactiveTintColor: c.textSubtle,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ripple',
          tabBarLabel: 'Signals',
          tabBarIcon: ({ color, size }) => <Ionicons name="pulse" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="trades"
        options={{
          title: 'Trades',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="swap-horizontal" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: 'Timeline',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="git-commit-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Watchlist',
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

/**
 * Settings lives in the header rather than as a third tab: it is not a
 * destination anyone visits often, and a tab bar earns its place by holding
 * the places they do.
 */
function SettingsButton() {
  const c = useTheme();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      hitSlop={tapSlop(32)}
      style={{ paddingHorizontal: space.lg }}
      accessibilityRole="button"
      accessibilityLabel="Settings"
    >
      <Ionicons name="settings-outline" size={20} color={c.textMuted} />
    </Pressable>
  );
}
