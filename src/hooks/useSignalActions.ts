import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import type { Signal } from '@/providers/types';
import { shareSignal } from '@/ui/signalActions';

/**
 * The long-press menu on a feed card.
 *
 * Uses each platform's own presentation rather than one custom sheet:
 * `ActionSheetIOS` is the control iOS users already know — including the
 * destructive/cancel semantics and the dismiss gesture — and Android gets an
 * alert with the same choices, which is its closest built-in equivalent.
 *
 * A long press has no visual affordance, so it always fires a haptic: without
 * that there is no way to tell a menu opened from a press that did nothing.
 */
export function useSignalActions(onOpen: (signal: Signal) => void) {
  const router = useRouter();

  const openSubject = useCallback(
    (signal: Signal) => {
      router.push({
        pathname: '/subject/[source]/[handle]',
        params: { source: signal.source, handle: signal.actor.handle },
      });
    },
    [router],
  );

  return useCallback(
    (signal: Signal) => {
      if (Platform.OS !== 'web') {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      const options = ['Open filing', `More from ${signal.actor.displayName}`, 'Share', 'Cancel'];
      const run = (index: number) => {
        if (index === 0) onOpen(signal);
        else if (index === 1) openSubject(signal);
        else if (index === 2) void shareSignal(signal);
      };

      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options, cancelButtonIndex: options.length - 1, userInterfaceStyle: 'dark' },
          run,
        );
        return;
      }

      Alert.alert(signal.actor.displayName, signal.text, [
        { text: options[0]!, onPress: () => run(0) },
        { text: options[1]!, onPress: () => run(1) },
        { text: options[2]!, onPress: () => run(2) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [onOpen, openSubject],
  );
}
