import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Height of the on-screen keyboard, or 0 when it is closed.
 *
 * `KeyboardAvoidingView` is the usual answer and it does not work here. This
 * app is edge-to-edge — always-on since SDK 54 — so Android never resizes the
 * window and the keyboard simply draws over the content; `behavior="padding"`
 * then under-shoots, because the height it reasons about is not the height the
 * content actually occupies. Measured on a Pixel 7: a bottom bar that needed to
 * rise 870px rose 600, leaving it still buried under the keys.
 *
 * The keyboard events report the real height, so this uses them directly.
 *
 * `will*` on iOS so the layout moves with the keyboard's animation rather than
 * snapping after it; Android only emits `did*`.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const isIOS = Platform.OS === 'ios';
    const show = Keyboard.addListener(isIOS ? 'keyboardWillShow' : 'keyboardDidShow', (event) =>
      setInset(event.endCoordinates.height),
    );
    const hide = Keyboard.addListener(isIOS ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setInset(0),
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return inset;
}
