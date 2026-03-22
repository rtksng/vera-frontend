import React from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Href, useRouter } from 'expo-router';
import { useSSO } from '@clerk/expo';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import Svg, { Path } from 'react-native-svg';
import { EtherealColors, EtherealSurface } from '@/constants/ethereal-theme';
import { Fonts } from '@/constants/theme';
import { setNeedsOnboardingFlag } from '@/lib/onboarding-flag';

function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

WebBrowser.maybeCompleteAuthSession();

type GoogleAuthButtonProps = {
  mode: 'sign-in' | 'sign-up';
};

function isCancelledError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: string | number;
    message?: string;
  };

  return (
    candidate.code === 'SIGN_IN_CANCELLED' ||
    candidate.code === 'auth_cancelled' ||
    candidate.code === 'user_cancelled' ||
    candidate.code === -5
  );
}

export function GoogleAuthButton({ mode }: GoogleAuthButtonProps) {
  const router = useRouter();
  const { startSSOFlow } = useSSO();
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    void WebBrowser.warmUpAsync();

    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const navigateAfterAuth = React.useCallback(
    async (decorateUrl: (url: string) => string) => {
      const appPath = mode === 'sign-up' ? '/(home)/onboarding' : '/(home)';
      const target = decorateUrl(appPath);

      if (Platform.OS === 'web' && target.startsWith('http') && typeof window !== 'undefined') {
        window.location.assign(target);
        return;
      }

      router.replace(target as Href);
    },
    [mode, router],
  );

  const handlePress = React.useCallback(async () => {
    if (isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'sign-up') {
        await setNeedsOnboardingFlag(true);
      }

      const redirectUrl = Linking.createURL(`/(auth)/${mode}`);
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });

      if (createdSessionId && setActive) {
        await setActive({
          session: createdSessionId,
          navigate: async ({ decorateUrl }) => {
            await navigateAfterAuth(decorateUrl);
          },
        });
        return;
      }

      if (mode === 'sign-up') {
        await setNeedsOnboardingFlag(false);
      }

      Alert.alert('Google auth failed', 'Please try again.');
    } catch (error) {
      if (mode === 'sign-up') {
        await setNeedsOnboardingFlag(false);
      }

      if (isCancelledError(error)) {
        return;
      }

      console.error('Google auth error:', error);
      Alert.alert('Google auth failed', 'Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, mode, navigateAfterAuth, startSSOFlow]);

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          isLoading && styles.disabledButton,
          pressed && styles.pressedButton,
        ]}
        onPress={() => {
          void handlePress();
        }}
        disabled={isLoading}
      >
        <GoogleLogo size={20} />
        <Text style={styles.buttonText}>{isLoading ? 'Connecting...' : 'Continue with Google'}</Text>
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 16,
  },
  button: {
    ...EtherealSurface.input,
    minHeight: 56,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  buttonText: {
    color: EtherealColors.textPrimary,
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: EtherealColors.outline,
  },
  dividerText: {
    color: EtherealColors.textMuted,
    fontSize: 13,
    fontFamily: Fonts.body,
    textTransform: 'lowercase',
  },
  disabledButton: {
    opacity: 0.6,
  },
  pressedButton: {
    opacity: 0.88,
  },
});
