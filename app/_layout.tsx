import { useCallback, useEffect, useRef } from 'react';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Slot, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { AppState, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import {
  CormorantGaramond_600SemiBold,
  CormorantGaramond_700Bold,
} from '@expo-google-fonts/cormorant-garamond';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import { registerForPushNotifications } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({
  duration: 250,
  fade: true,
});

function ensureNativeDocumentShim() {
  if (Platform.OS === 'web') {
    return;
  }

  const globalScope = globalThis as typeof globalThis & {
    Event?: new (
      type: string,
      eventInitDict?: {
        bubbles?: boolean;
        cancelable?: boolean;
        composed?: boolean;
      }
    ) => {
      type: string;
      bubbles: boolean;
      cancelable: boolean;
      composed: boolean;
      defaultPrevented: boolean;
      preventDefault: () => void;
      stopPropagation: () => void;
      stopImmediatePropagation: () => void;
    };
    CustomEvent?: new (
      type: string,
      eventInitDict?: {
        bubbles?: boolean;
        cancelable?: boolean;
        composed?: boolean;
        detail?: unknown;
      }
    ) => {
      type: string;
      detail?: unknown;
      bubbles: boolean;
      cancelable: boolean;
      composed: boolean;
      defaultPrevented: boolean;
      preventDefault: () => void;
      stopPropagation: () => void;
      stopImmediatePropagation: () => void;
    };
    window?: {
      addEventListener?: (...args: unknown[]) => void;
      removeEventListener?: (...args: unknown[]) => void;
      dispatchEvent?: (event: unknown) => boolean;
    };
    document?: {
      hasFocus?: () => boolean;
      visibilityState?: string;
      addEventListener?: (...args: unknown[]) => void;
      removeEventListener?: (...args: unknown[]) => void;
      dispatchEvent?: (event: unknown) => boolean;
      title?: string;
    };
  };

  if (typeof globalScope.Event !== 'function') {
    class EventShim {
      type: string;
      bubbles: boolean;
      cancelable: boolean;
      composed: boolean;
      defaultPrevented: boolean;

      constructor(
        type: string,
        eventInitDict?: {
          bubbles?: boolean;
          cancelable?: boolean;
          composed?: boolean;
        },
      ) {
        this.type = type;
        this.bubbles = eventInitDict?.bubbles ?? false;
        this.cancelable = eventInitDict?.cancelable ?? false;
        this.composed = eventInitDict?.composed ?? false;
        this.defaultPrevented = false;
      }

      preventDefault() {
        if (this.cancelable) {
          this.defaultPrevented = true;
        }
      }

      stopPropagation() {}

      stopImmediatePropagation() {}
    }

    globalScope.Event = EventShim;
  }

  if (typeof globalScope.CustomEvent !== 'function') {
    class CustomEventShim extends globalScope.Event {
      detail: unknown;

      constructor(
        type: string,
        eventInitDict?: {
          bubbles?: boolean;
          cancelable?: boolean;
          composed?: boolean;
          detail?: unknown;
        },
      ) {
        super(type, eventInitDict);
        this.detail = eventInitDict?.detail;
      }
    }

    globalScope.CustomEvent = CustomEventShim;
  }

  const windowRef = globalScope.window;
  if (windowRef) {
    if (typeof windowRef.addEventListener !== 'function') {
      windowRef.addEventListener = () => {};
    }

    if (typeof windowRef.removeEventListener !== 'function') {
      windowRef.removeEventListener = () => {};
    }

    if (typeof windowRef.dispatchEvent !== 'function') {
      windowRef.dispatchEvent = () => true;
    }
  }

  const documentRef = globalScope.document;
  if (!documentRef) {
    return;
  }

  if (typeof documentRef.hasFocus !== 'function') {
    documentRef.hasFocus = () => AppState.currentState === 'active';
  }

  if (typeof documentRef.addEventListener !== 'function') {
    documentRef.addEventListener = () => {};
  }

  if (typeof documentRef.removeEventListener !== 'function') {
    documentRef.removeEventListener = () => {};
  }

  if (typeof documentRef.dispatchEvent !== 'function') {
    documentRef.dispatchEvent = () => true;
  }

  if (typeof documentRef.title !== 'string') {
    documentRef.title = 'Vera';
  }

  if (typeof documentRef.visibilityState === 'undefined') {
    try {
      Object.defineProperty(documentRef, 'visibilityState', {
        configurable: true,
        enumerable: true,
        get: () => (AppState.currentState === 'active' ? 'visible' : 'hidden'),
      });
    } catch {
      documentRef.visibilityState = 'visible';
    }
  }
}

ensureNativeDocumentShim();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
if (!publishableKey) throw new Error('Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to .env');

function PushNotificationHandler() {
  const { getToken, isSignedIn } = useAuth();
  const router = useRouter();
  const hasRegistered = useRef(false);

  useEffect(() => {
    if (!isSignedIn || hasRegistered.current) return;
    hasRegistered.current = true;
    registerForPushNotifications(getToken).catch(() => {});
  }, [isSignedIn, getToken]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === "ai_initiate" || data?.type?.toString().startsWith("ritual_")) {
        router.push("/(home)");
      }
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  const splashHiddenRef = useRef(false);
  const [fontsLoaded] = useFonts({
    CormorantGaramond_600SemiBold,
    CormorantGaramond_700Bold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  const onLayoutRootView = useCallback(() => {
    if (splashHiddenRef.current || !fontsLoaded) {
      return;
    }

    splashHiddenRef.current = true;
    void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <PushNotificationHandler />
          <Slot />
        </ClerkProvider>
      </View>
    </SafeAreaProvider>
  );
}
