import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const NEEDS_ONBOARDING_KEY = 'needsOnboarding';

function getWebStorage(): Storage | null {
  if (Platform.OS !== 'web') {
    return null;
  }

  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
      return null;
    }
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export async function getNeedsOnboardingFlag(): Promise<string | null> {
  const webStorage = getWebStorage();
  if (webStorage) {
    return webStorage.getItem(NEEDS_ONBOARDING_KEY);
  }

  return SecureStore.getItemAsync(NEEDS_ONBOARDING_KEY);
}

export async function setNeedsOnboardingFlag(needsOnboarding: boolean): Promise<void> {
  const value = needsOnboarding ? 'true' : 'false';
  const webStorage = getWebStorage();

  if (webStorage) {
    webStorage.setItem(NEEDS_ONBOARDING_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(NEEDS_ONBOARDING_KEY, value);
}

export async function clearNeedsOnboardingFlag(): Promise<void> {
  const webStorage = getWebStorage();
  if (webStorage) {
    webStorage.removeItem(NEEDS_ONBOARDING_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(NEEDS_ONBOARDING_KEY);
}
