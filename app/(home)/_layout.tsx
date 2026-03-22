import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/expo';
import { Redirect, Stack, useRootNavigationState } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { AmbientBackground } from '@/components/ambient-background';
import { AuthColors, Glass } from '@/constants/theme';
import { clearNeedsOnboardingFlag, getNeedsOnboardingFlag } from '@/lib/onboarding-flag';
import { EngagementProvider } from '@/contexts/EngagementContext';

export default function HomeLayout() {
  const { isSignedIn } = useAuth();
  const rootNavigationState = useRootNavigationState();
  const [isChecking, setIsChecking] = useState(true);
  const [initialRoute, setInitialRoute] = useState<string>('index');

  useEffect(() => {
    if (!isSignedIn) {
      setIsChecking(false);
      return;
    }

    getNeedsOnboardingFlag().then(val => {
      if (val === 'true') {
        clearNeedsOnboardingFlag();
        setInitialRoute('onboarding');
      } else {
        setInitialRoute('index');
      }
      setIsChecking(false);
    }).catch(() => {
      setInitialRoute('index');
      setIsChecking(false);
    });
  }, [isSignedIn]);

  if (!isSignedIn) {
    return <Redirect href="/(auth)" />;
  }

  // Prevent rendering the Stack until we know whether to navigate to onboarding
  // Wait for root navigation state (router tree) to mount
  if (isChecking || !rootNavigationState?.key) {
    return (
      <View style={styles.loadingScreen}>
        <AmbientBackground />
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={AuthColors.primary} />
          <Text style={styles.loadingText}>Setting up your conversation view...</Text>
        </View>
      </View>
    );
  }

  return (
    <EngagementProvider>
      <Stack
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: AuthColors.background },
        }}
      />
    </EngagementProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: AuthColors.background,
  },
  loadingCard: {
    ...Glass.card,
    width: '100%',
    maxWidth: 340,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: 28,
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    color: AuthColors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
});
