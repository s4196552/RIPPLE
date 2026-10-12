import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { useProfile } from '@/store/profile';

/**
 * Choosing and clearing the profile photo.
 *
 * The system photo picker needs no library permission on current iOS and
 * Android: the user picks one image and only that image is shared with the
 * app. It is cropped square and compressed before it is kept.
 *
 * On native the picked file sits in a cache folder the OS may empty, so it is
 * copied into the document folder under a fresh name (a new name, not an
 * overwrite, so an `<Image>` showing the old photo is not served it from its
 * cache), and the previous copy is deleted. On web the picker hands back a
 * data URI, which is stored as it is.
 *
 * Resolves true when a photo was set, false when the user cancelled.
 */
export async function pickAvatar(): Promise<boolean> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
  });
  if (result.canceled || !result.assets?.[0]) return false;

  const picked = result.assets[0].uri;
  if (Platform.OS === 'web') {
    useProfile.getState().setAvatarUri(picked);
    return true;
  }

  const kept = new File(Paths.document, `avatar-${Date.now()}.jpg`);
  await new File(picked).copy(kept);
  const previous = useProfile.getState().avatarUri;
  useProfile.getState().setAvatarUri(kept.uri);
  deleteLocal(previous);
  return true;
}

/** Forget the photo, and delete the app's copy of it. */
export function clearAvatar(): void {
  const previous = useProfile.getState().avatarUri;
  useProfile.getState().setAvatarUri(null);
  deleteLocal(previous);
}

function deleteLocal(uri: string | null): void {
  if (!uri || Platform.OS === 'web' || !uri.startsWith('file:')) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // An orphaned file in the app's own folder is harmless; a crash is not.
  }
}
