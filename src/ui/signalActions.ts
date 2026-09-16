import { Platform, Share } from 'react-native';
import { shareText } from '@/lib/share';
import type { Signal } from '@/providers/types';

/**
 * Hand a signal to the system share sheet.
 *
 * Every signal is a public filing with a canonical URL, so sharing one is the
 * obvious thing to want and there was no way to do it. The system sheet rather
 * than a bespoke menu: it is the control people already know, and it inherits
 * whatever destinations they have set up.
 *
 * The message itself is built by `shareText`, which is pure and tested.
 */
export async function shareSignal(signal: Signal): Promise<void> {
  const message = shareText(signal);

  await Share.share(
    // iOS treats these as two things: `url` gets its own rich preview and the
    // message becomes the body. Android has a single text field, so the URL
    // stays inside the message (where `shareText` already put it).
    Platform.OS === 'ios' ? { message, url: signal.url } : { message },
    { dialogTitle: 'Share this filing' },
  );
}
