import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Redirect, Slot, useSegments, Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AuthColors } from '@/constants/theme';

// Settings for Expo Router
export const unstable_settings = {
  initialRouteName: '(tabs)',
};

function AuthGate() {
  const { session, isLoading, isProfileComplete, user } = useAuth();
  const segments = useSegments();

  // Debug logging
  console.log('[AuthGate] Current state:', {
    isLoading,
    hasSession: !!session,
    isProfileComplete,
    userEmail: user?.email,
    currentSegment: segments[0] || 'none',
  });

  // Show loading screen while checking auth state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={AuthColors.primary} />
      </View>
    );
  }

  // Determine current route group
  const inAuthGroup = segments[0] === '(auth)';
  const inOnboardingGroup = segments[0] === '(onboarding)';
  const inTabsGroup = segments[0] === '(tabs)';

  // ROUTING LOGIC:
  // 1. No session -> must be in auth group
  // 2. Has session, no profile -> must be in onboarding group
  // 3. Has session + profile -> must be in tabs group

  if (!session) {
    // User is not authenticated
    if (!inAuthGroup) {
      console.log('[AuthGate] No session, redirecting to auth');
      return <Redirect href={'/(auth)/sign-in' as Href} />;
    }
  } else if (!isProfileComplete) {
    // User is authenticated but hasn't completed onboarding
    if (!inOnboardingGroup) {
      console.log('[AuthGate] No profile, redirecting to onboarding');
      return <Redirect href={'/(onboarding)' as Href} />;
    }
  } else {
    // User is fully authenticated with complete profile
    if (inAuthGroup || inOnboardingGroup) {
      console.log('[AuthGate] Has profile, redirecting to tabs');
      return <Redirect href={'/(tabs)' as Href} />;
    }
  }

  // Render the appropriate screen
  return <Slot />;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthGate />
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AuthColors.background,
  },
});
