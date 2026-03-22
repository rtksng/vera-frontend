import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { EtherealBackdrop } from '@/components/ethereal-screen';
import { EtherealColors, EtherealSurface } from '@/constants/ethereal-theme';
import { getNeedsOnboardingFlag } from '@/lib/onboarding-flag';

export default function AuthLayout() {
  const { isSignedIn } = useAuth();
  const [redirectTarget, setRedirectTarget] = useState<'/(home)' | '/(home)/onboarding' | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!isSignedIn) {
      setRedirectTarget(null);
      return () => {
        mounted = false;
      };
    }

    getNeedsOnboardingFlag()
      .then((value) => {
        if (!mounted) {
          return;
        }
        setRedirectTarget(value === 'true' ? '/(home)/onboarding' : '/(home)');
      })
      .catch(() => {
        if (!mounted) {
          return;
        }
        setRedirectTarget('/(home)');
      });

    return () => {
      mounted = false;
    };
  }, [isSignedIn]);

  if (isSignedIn) {
    if (!redirectTarget) {
      return (
        <View style={styles.loadingScreen}>
          <EtherealBackdrop />
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={EtherealColors.primary} />
            <Text style={styles.loadingEyebrow}>Vera</Text>
            <Text style={styles.loadingText}>Preparing your sanctuary...</Text>
          </View>
        </View>
      );
    }

    return <Redirect href={redirectTarget} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: EtherealColors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: EtherealColors.background,
  },
  loadingCard: {
    ...EtherealSurface.cardRaised,
    width: '100%',
    maxWidth: 320,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: 28,
    alignItems: 'center',
    gap: 14,
  },
  loadingEyebrow: {
    color: EtherealColors.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  loadingText: {
    color: EtherealColors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
});
