import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useFeedSync } from '@/hooks/useFeedSync';
import { usePreferences } from '@/store/preferences';
import { useTheme } from '@/ui/ThemeProvider';
import { space, tapSlop, type } from '@/ui/theme';
import { FloatingTabBar } from '@/ui/components/FloatingTabBar';

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
      // Our own floating pill, the same on every tab. See FloatingTabBar.
      tabBar={(props) => <FloatingTabBar {...props} />}
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
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Signals' }} />
      <Tabs.Screen name="trades" options={{ title: 'Trades' }} />
      <Tabs.Screen name="timeline" options={{ title: 'Timeline' }} />
      <Tabs.Screen name="watchlist" options={{ title: 'Watchlist' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
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
