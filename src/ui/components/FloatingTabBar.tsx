import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Tabs } from 'expo-router';
import { useProfile } from '@/store/profile';
import { makeStyles, useTheme } from '../ThemeProvider';
import { TAB_ICONS, type TabName } from '../tabIcons';
import { font, tint, type } from '../theme';
import { TabIcon } from './TabIcon';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** The pill's own height. */
const BAR_HEIGHT = 68;
/** Gap between the pill and the bottom edge, above any home-indicator inset. */
const BAR_GAP = 10;
/** The pill's inner padding and the gap between tabs. */
const BAR_PADDING = 6;
const TAB_GAP = 2;
/** How long the selector takes to slide from one tab to the next. */
const SLIDE_MS = 260;

/**
 * Room a tab screen must leave at the bottom of its scroll content, so the
 * last row can scroll clear of the floating bar instead of ending under it.
 */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + Math.max(insets.bottom, BAR_GAP) + BAR_GAP + 8;
}

/**
 * The tab bar: one rounded pill floating above the bottom edge, the same on
 * every tab, with the content scrolling underneath it.
 *
 * Replaces the navigator's default bar so the shape and the icons are ours.
 * It keeps the default's behaviour: a press emits `tabPress` (so a screen can
 * still scroll-to-top on a second tap) and only navigates when not already
 * there, and each button is a `tab` with its selected state, inside a
 * `tablist`, so a screen reader announces it as a tab bar.
 *
 * The selected tab's highlight is one shared selector that slides to the new
 * tab rather than jumping, so the move from page to page reads as one motion.
 * With Reduce Motion on, it moves instantly.
 */
export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const c = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const avatarUri = useProfile((s) => s.avatarUri);
  const reduceMotion = useReducedMotion();

  // Every tab is the same width (flex: 1), so the selector's position is the
  // index times one tab plus its gap. Measured from the bar, because the pill
  // spans the screen less its margins and that varies by device.
  const [innerWidth, setInnerWidth] = useState(0);
  const count = state.routes.length;
  const tabWidth = innerWidth > 0 ? (innerWidth - TAB_GAP * (count - 1)) / count : 0;
  const offset = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (tabWidth === 0) return;
    const target = state.index * (tabWidth + TAB_GAP);
    // The first placement is instant, so the selector never slides in from
    // the left edge on launch.
    if (!placed.current || reduceMotion) {
      offset.value = target;
      placed.current = true;
      return;
    }
    offset.value = withTiming(target, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) });
  }, [state.index, tabWidth, reduceMotion, offset]);

  const onBarLayout = (e: LayoutChangeEvent) =>
    setInnerWidth(e.nativeEvent.layout.width - BAR_PADDING * 2);

  const selectorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={[styles.dock, { bottom: Math.max(insets.bottom, BAR_GAP) }]}
    >
      <View style={styles.bar} accessibilityRole="tablist" onLayout={onBarLayout}>
        {tabWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.selector, { width: tabWidth }, selectorStyle]}
          />
        ) : null}
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const options = descriptors[route.key]?.options ?? {};
          const label = typeof options.title === 'string' ? options.title : route.name;
          const spec = TAB_ICONS[route.name as TabName];
          const iconColor = focused ? c.accent : c.textSubtle;
          const showPhoto = route.name === 'profile' && avatarUri;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
            >
              {showPhoto ? (
                <View style={[styles.photoRing, focused && { borderColor: c.accent }]}>
                  <Image source={{ uri: avatarUri }} style={styles.photo} accessibilityIgnoresInvertColors />
                </View>
              ) : spec ? (
                <TabIcon spec={spec} color={iconColor} knockColor={c.surface} selected={focused} />
              ) : null}
              <Text
                style={[styles.label, { color: focused ? c.text : c.textSubtle, fontFamily: focused ? font.bold : font.semibold }]}
                numberOfLines={1}
                // Scales with the system size, capped so the label still fits
                // the pill's fixed height.
                maxFontSizeMultiplier={1.3}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  dock: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  bar: {
    flexDirection: 'row',
    gap: TAB_GAP,
    height: BAR_HEIGHT,
    padding: BAR_PADDING,
    borderRadius: BAR_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    backgroundColor: c.surface,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: (BAR_HEIGHT - BAR_PADDING * 2) / 2,
  },
  // Sits behind the tabs, inside the padding, and slides between them.
  selector: {
    position: 'absolute',
    top: BAR_PADDING,
    bottom: BAR_PADDING,
    left: BAR_PADDING,
    borderRadius: (BAR_HEIGHT - BAR_PADDING * 2) / 2,
    backgroundColor: tint(c.accent, 0.16),
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    ...type.micro,
    letterSpacing: 0,
  },
  photoRing: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.surfaceAlt,
  },
}));
