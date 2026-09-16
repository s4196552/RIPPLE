import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { hostLabel } from '@/lib/format';
import { useBrowser } from '@/store/browser';
import { makeStyles, useTheme } from '../ThemeProvider';
import { radius, space, tapSlop, type } from '../theme';

/**
 * The in-app browser window.
 *
 * Mounted once, at the root, and driven by `useBrowser`. Replaces
 * `expo-web-browser`'s system sheet for the "In app" link preference: a Safari
 * View Controller or a Chrome Custom Tab is the OS's window, styled by the OS,
 * and it cannot carry the app's own chrome or theme.
 *
 * NATIVE ONLY, and the caller enforces that rather than this component hiding
 * it. On web `react-native-webview` renders a red "does not support this
 * platform" box, and even a hand-rolled iframe would be blank for exactly the
 * documents Ripple links to: the Federal Register sends
 * `frame-ancestors 'none'` and the House Clerk sends `X-Frame-Options: DENY`.
 * So `openLink` sends web users to a real browser tab instead, which is the
 * only thing that actually works there.
 */
export function BrowserWindow() {
  const c = useTheme();
  const styles = useStyles();

  const target = useBrowser((s) => s.target);
  const close = useBrowser((s) => s.close);

  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  // Every open is a fresh document, so the chrome must not inherit the last
  // one's title or its error.
  const onOpen = useCallback(() => {
    setLoading(true);
    setFailed(false);
    setPageTitle(null);
    setCanGoBack(false);
  }, []);

  const onNavigate = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    if (nav.title) setPageTitle(nav.title);
  }, []);

  if (!target) return null;

  const host = hostLabel(target.url);
  const heading = pageTitle || target.title || host;

  return (
    <Modal
      visible
      animationType="slide"
      onShow={onOpen}
      // Android's hardware back closes the window rather than the app, and iOS
      // gets the swipe-down sheet its users already expect.
      onRequestClose={close}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      statusBarTranslucent={false}
    >
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable
            onPress={close}
            hitSlop={tapSlop(28)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Close this document and go back to Ripple"
          >
            <Ionicons name="close" size={20} color={c.text} />
          </Pressable>

          {/* Grouped, or a screen reader reads the title and the host as two
              unrelated stops with no way to tell which is the source. */}
          <View style={styles.headings} accessible accessibilityLabel={`${heading}, at ${host}`}>
            <Text style={styles.title} numberOfLines={1}>
              {heading}
            </Text>
            <Text style={styles.host} numberOfLines={1}>
              {host}
            </Text>
          </View>

          <Pressable
            onPress={() => void Linking.openURL(target.url)}
            hitSlop={tapSlop(28)}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Open this document in your browser instead"
          >
            <Ionicons name="open-outline" size={18} color={c.textMuted} />
          </Pressable>
        </View>

        {/* A determinate bar would be a lie about a load whose size is unknown;
            this just says something is happening, and takes no layout height so
            the page does not jump when it goes. */}
        {loading && !failed && (
          <View style={styles.progress}>
            <ActivityIndicator size="small" color={c.accent} />
          </View>
        )}

        {failed ? (
          <View style={styles.failure}>
            <Ionicons name="cloud-offline-outline" size={26} color={c.textMuted} />
            <Text style={styles.failureTitle} accessibilityRole="header">
              Couldn&apos;t load this document
            </Text>
            <Text style={styles.failureBody}>
              {host} did not respond. It may be down, or blocking this connection.
            </Text>

            <View style={styles.failureActions}>
              <Pressable
                onPress={() => {
                  setFailed(false);
                  setLoading(true);
                  webRef.current?.reload();
                }}
                style={({ pressed }) => [styles.button, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Try loading this document again"
              >
                <Text style={styles.buttonText}>Try again</Text>
              </Pressable>

              <Pressable
                onPress={() => void Linking.openURL(target.url)}
                style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Open this document in your browser instead"
              >
                <Text style={[styles.buttonText, styles.primaryText]}>Open in browser</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <WebView
            ref={webRef}
            source={{ uri: target.url }}
            style={styles.web}
            // The page paints its own background; without this the app's dark
            // ground shows through every white document while it loads.
            containerStyle={styles.webContainer}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false);
              setFailed(true);
            }}
            onNavigationStateChange={onNavigate}
            // These are public documents, not an app surface: no reason to run
            // anything the page wants to store or install.
            thirdPartyCookiesEnabled={false}
            sharedCookiesEnabled={false}
            allowsInlineMediaPlayback
            // A filing that links out should still work, but a download is the
            // OS's job rather than something to render in a sheet.
            onFileDownload={({ nativeEvent }) => void Linking.openURL(nativeEvent.downloadUrl)}
          />
        )}

        {canGoBack && !failed && (
          <Pressable
            onPress={() => webRef.current?.goBack()}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Go back to the previous page in this document"
          >
            <Ionicons name="chevron-back" size={18} color={c.onAccent} />
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  screen: {
    flex: 1,
    backgroundColor: c.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    backgroundColor: c.bg,
  },
  iconButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headings: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...type.label,
    color: c.text,
  },
  host: {
    ...type.caption,
    color: c.textMuted,
  },
  progress: {
    position: 'absolute',
    top: 54,
    alignSelf: 'center',
    zIndex: 2,
  },
  web: {
    flex: 1,
  },
  webContainer: {
    backgroundColor: c.logoPlate,
  },
  failure: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xl,
  },
  failureTitle: {
    ...type.title,
    color: c.text,
    textAlign: 'center',
  },
  failureBody: {
    ...type.bodyTight,
    color: c.textMuted,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 20,
  },
  failureActions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.sm,
  },
  button: {
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  primary: {
    backgroundColor: c.accent,
    borderColor: c.accent,
  },
  buttonText: {
    ...type.label,
    color: c.text,
  },
  primaryText: {
    color: c.onAccent,
  },
  back: {
    position: 'absolute',
    left: space.lg,
    bottom: space.xl,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accent,
  },
  pressed: {
    opacity: 0.7,
  },
}));
