import React from 'react';
import { useAuth, useClerk, useSignIn, useSignUp } from '@clerk/expo';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Animated,
  Easing,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { EtherealScreen } from '@/components/ethereal-screen';
import { GoogleAuthButton } from '@/components/google-auth-button';
import { EtherealColors } from '@/constants/ethereal-theme';
import { Fonts } from '@/constants/theme';
import { setNeedsOnboardingFlag } from '@/lib/onboarding-flag';

type AuthTab = 'sign-in' | 'sign-up';

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== 'object') {
    return 'Failed to complete account setup. Please try again.';
  }

  const candidate = error as {
    message?: string;
    longMessage?: string;
    errors?: { message?: string; longMessage?: string }[];
  };

  return (
    candidate.errors?.[0]?.longMessage ||
    candidate.errors?.[0]?.message ||
    candidate.longMessage ||
    candidate.message ||
    'Failed to complete account setup. Please try again.'
  );
}

function getInitialTab(tab?: string | string[]): AuthTab {
  const value = Array.isArray(tab) ? tab[0] : tab;
  return value === 'sign-up' ? 'sign-up' : 'sign-in';
}

export function AuthScreen() {
  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const router = useRouter();
  const { signIn, errors: signInErrors, fetchStatus: signInFetchStatus } = useSignIn();
  const { signUp, errors: signUpErrors, fetchStatus: signUpFetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const { setActive } = useClerk();

  const [activeTab, setActiveTab] = React.useState<AuthTab>(() => getInitialTab(params.tab));
  const [tabRowWidth, setTabRowWidth] = React.useState(0);
  const indicatorAnim = React.useRef(new Animated.Value(activeTab === 'sign-up' ? 1 : 0)).current;
  const contentAnim = React.useRef(new Animated.Value(1)).current;

  const [signInEmail, setSignInEmail] = React.useState('');
  const [signInPassword, setSignInPassword] = React.useState('');
  const [signInCode, setSignInCode] = React.useState('');

  const [signUpEmail, setSignUpEmail] = React.useState('');
  const [signUpPassword, setSignUpPassword] = React.useState('');
  const [signUpCode, setSignUpCode] = React.useState('');
  const [isCompletingSignUp, setIsCompletingSignUp] = React.useState(false);
  const [completionError, setCompletionError] = React.useState<string | null>(null);
  const [verificationStepRequested, setVerificationStepRequested] = React.useState(false);

  React.useEffect(() => {
    const nextTab = getInitialTab(params.tab);
    setActiveTab(nextTab);
  }, [params.tab]);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(indicatorAnim, {
        toValue: activeTab === 'sign-up' ? 1 : 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(contentAnim, {
          toValue: 0,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(contentAnim, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [activeTab, contentAnim, indicatorAnim]);

  const signInNeedsMfa =
    signIn.status === 'needs_second_factor' || signIn.status === 'needs_client_trust';
  const signInIsFetching = signInFetchStatus === 'fetching';
  const signInIdentifierError = signInErrors?.fields?.identifier?.message;
  const signInPasswordError = signInErrors?.fields?.password?.message;
  const signInCodeError = signInErrors?.fields?.code?.message;

  const signUpIsFetching = signUpFetchStatus === 'fetching';
  const signUpEmailError = signUpErrors?.fields?.emailAddress?.message;
  const signUpPasswordError = signUpErrors?.fields?.password?.message;
  const signUpCodeError = signUpErrors?.fields?.code?.message;
  const signUpNeedsVerification =
    verificationStepRequested &&
    signUp.status === 'missing_requirements' &&
    signUp.unverifiedFields?.includes('email_address') &&
    signUp.missingFields.length === 0;

  const onTabLayout = React.useCallback((event: LayoutChangeEvent) => {
    setTabRowWidth(event.nativeEvent.layout.width);
  }, []);

  const switchTab = React.useCallback((tab: AuthTab) => {
    setActiveTab(tab);
  }, []);

  const navigateHome = React.useCallback(
    (decorateUrl: (url: string) => string) => {
      router.replace(decorateUrl('/(home)') as Href);
    },
    [router],
  );

  const navigateToOnboarding = React.useCallback(
    async (decorateUrl: (url: string) => string) => {
      const target = decorateUrl('/(home)/onboarding');

      if (target.startsWith('http') && typeof window !== 'undefined') {
        window.location.assign(target);
        return;
      }

      router.replace(target as Href);
    },
    [router],
  );

  const completeSignUp = React.useCallback(async () => {
    if (isCompletingSignUp) {
      return;
    }

    if (!signUp.createdSessionId) {
      setCompletionError('Your account was verified, but no session was created. Please try again.');
      return;
    }

    setCompletionError(null);
    setIsCompletingSignUp(true);

    try {
      await setNeedsOnboardingFlag(true);
      await setActive({
        session: signUp.createdSessionId,
        navigate: async ({ session, decorateUrl }) => {
          if (session?.currentTask) {
            return;
          }

          await navigateToOnboarding(decorateUrl);
        },
      });
    } catch (error) {
      setCompletionError(getErrorMessage(error));
      setIsCompletingSignUp(false);
    }
  }, [isCompletingSignUp, navigateToOnboarding, setActive, signUp.createdSessionId]);

  const handleSignInSubmit = React.useCallback(async () => {
    try {
      const { error } = await signIn.password({
        emailAddress: signInEmail,
        password: signInPassword,
      });

      if (error) {
        return;
      }

      if (signIn.status === 'complete') {
        await signIn.finalize({
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) {
              return;
            }

            navigateHome(decorateUrl);
          },
        });
      } else if (
        signIn.status === 'needs_second_factor' ||
        signIn.status === 'needs_client_trust'
      ) {
        const emailCodeFactor = signIn.supportedSecondFactors?.find(
          (factor: { strategy?: string }) => factor.strategy === 'email_code',
        );

        if (emailCodeFactor) {
          await signIn.mfa.sendEmailCode();
        }
      }
    } catch (error) {
      console.error('Sign-in error:', error);
    }
  }, [navigateHome, signIn, signInEmail, signInPassword]);

  const handleSignInVerify = React.useCallback(async () => {
    try {
      await signIn.mfa.verifyEmailCode({ code: signInCode });

      if (signIn.status === 'complete') {
        await signIn.finalize({
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) {
              return;
            }

            navigateHome(decorateUrl);
          },
        });
      }
    } catch (error) {
      console.error('MFA verification error:', error);
    }
  }, [navigateHome, signIn, signInCode]);

  const handleSignUpSubmit = React.useCallback(async () => {
    try {
      const { error } = await signUp.password({
        emailAddress: signUpEmail,
        password: signUpPassword,
      });

      if (error) {
        return;
      }

      await signUp.verifications.sendEmailCode();
      setVerificationStepRequested(true);
    } catch (error) {
      console.error('Sign-up error:', error);
    }
  }, [signUp, signUpEmail, signUpPassword]);

  const handleSignUpVerify = React.useCallback(async () => {
    try {
      setCompletionError(null);

      const { error } = await signUp.verifications.verifyEmailCode({ code: signUpCode });

      if (error) {
        return;
      }

      if (signUp.status === 'complete') {
        await completeSignUp();
      }
    } catch (error) {
      console.error('Verification error:', error);
    }
  }, [completeSignUp, signUp, signUpCode]);

  const passwordStrength = React.useMemo(() => {
    if (!signUpPassword) {
      return null;
    }

    if (signUpPassword.length < 6) {
      return { text: 'Too short', color: EtherealColors.error };
    }

    if (signUpPassword.length < 8) {
      return { text: 'Weak', color: EtherealColors.accent };
    }

    if (/[A-Z]/.test(signUpPassword) && /[0-9]/.test(signUpPassword)) {
      return { text: 'Strong', color: EtherealColors.success };
    }

    return { text: 'Medium', color: EtherealColors.primary };
  }, [signUpPassword]);

  const showTabs = !signInNeedsMfa && !signUpNeedsVerification && signUp.status !== 'complete' && !isCompletingSignUp;

  const indicatorWidth = tabRowWidth > 0 ? tabRowWidth / 2 - 4 : 0;
  const indicatorTranslateX = indicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, indicatorWidth],
  });

  const animatedCardStyle = {
    opacity: contentAnim,
    transform: [
      {
        translateY: contentAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 0],
        }),
      },
    ],
  };

  const renderSignInBase = () => (
    <>
      <GoogleAuthButton mode="sign-in" />

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email</Text>
        <View style={styles.inputShell}>
          <Ionicons name="mail-outline" size={18} color={EtherealColors.textMuted} />
          <TextInput
            style={styles.input}
            value={signInEmail}
            onChangeText={setSignInEmail}
            placeholder="you@example.com"
            placeholderTextColor={EtherealColors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={!signInIsFetching}
          />
        </View>
        {signInIdentifierError ? <Text style={styles.fieldError}>{signInIdentifierError}</Text> : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Password</Text>
        <View style={styles.inputShell}>
          <Ionicons name="lock-closed-outline" size={18} color={EtherealColors.textMuted} />
          <TextInput
            style={styles.input}
            value={signInPassword}
            onChangeText={setSignInPassword}
            placeholder="••••••••"
            placeholderTextColor={EtherealColors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            editable={!signInIsFetching}
          />
        </View>
        {signInPasswordError ? <Text style={styles.fieldError}>{signInPasswordError}</Text> : null}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          (!signInEmail || !signInPassword || signInIsFetching) && styles.disabledButton,
          pressed && styles.pressedButton,
        ]}
        onPress={() => {
          void handleSignInSubmit();
        }}
        disabled={!signInEmail || !signInPassword || signInIsFetching}
      >
        <Ionicons name="arrow-forward-outline" size={18} color="#07060E" />
        <Text style={styles.primaryButtonText}>Sign in</Text>
      </Pressable>

      <Pressable style={styles.tabFooterButton} onPress={() => switchTab('sign-up')}>
        <Text style={styles.switchText}>New?</Text>
        <Text style={styles.switchLink}>Sign up</Text>
      </Pressable>
    </>
  );

  const renderSignInMfa = () => (
    <>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Code</Text>
        <View style={styles.inputShell}>
          <Ionicons name="key-outline" size={18} color={EtherealColors.textMuted} />
          <TextInput
            style={styles.input}
            value={signInCode}
            onChangeText={setSignInCode}
            placeholder="000000"
            placeholderTextColor={EtherealColors.textMuted}
            keyboardType="numeric"
            autoComplete="one-time-code"
            editable={!signInIsFetching}
          />
        </View>
        {signInCodeError ? <Text style={styles.fieldError}>{signInCodeError}</Text> : null}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          (!signInCode.trim() || signInIsFetching) && styles.disabledButton,
          pressed && styles.pressedButton,
        ]}
        onPress={() => {
          void handleSignInVerify();
        }}
        disabled={!signInCode.trim() || signInIsFetching}
      >
        <Ionicons name="arrow-forward-outline" size={18} color="#07060E" />
        <Text style={styles.primaryButtonText}>Continue</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressedButton]}
        onPress={() => {
          void signIn.mfa.sendEmailCode();
        }}
        disabled={signInIsFetching}
      >
        <Text style={styles.secondaryButtonText}>Resend</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.ghostButton, pressed && styles.pressedButton]}
        onPress={() => signIn.reset()}
        disabled={signInIsFetching}
      >
        <Text style={styles.ghostButtonText}>Back</Text>
      </Pressable>
    </>
  );

  const renderSignUpBase = () => (
    <>
      <GoogleAuthButton mode="sign-up" />

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Email</Text>
        <View style={styles.inputShell}>
          <Ionicons name="mail-outline" size={18} color={EtherealColors.textMuted} />
          <TextInput
            style={styles.input}
            value={signUpEmail}
            onChangeText={setSignUpEmail}
            placeholder="you@example.com"
            placeholderTextColor={EtherealColors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={!signUpIsFetching}
          />
        </View>
        {signUpEmailError ? <Text style={styles.fieldError}>{signUpEmailError}</Text> : null}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Password</Text>
        <View style={styles.inputShell}>
          <Ionicons name="lock-closed-outline" size={18} color={EtherealColors.textMuted} />
          <TextInput
            style={styles.input}
            value={signUpPassword}
            onChangeText={setSignUpPassword}
            placeholder="••••••••"
            placeholderTextColor={EtherealColors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
            editable={!signUpIsFetching}
          />
        </View>
        {passwordStrength ? (
          <View style={styles.passwordStrength}>
            <View style={[styles.strengthDot, { backgroundColor: passwordStrength.color }]} />
            <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
              {passwordStrength.text}
            </Text>
          </View>
        ) : null}
        {signUpPasswordError ? <Text style={styles.fieldError}>{signUpPasswordError}</Text> : null}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          (!signUpEmail || !signUpPassword || signUpIsFetching) && styles.disabledButton,
          pressed && styles.pressedButton,
        ]}
        onPress={() => {
          void handleSignUpSubmit();
        }}
        disabled={!signUpEmail || !signUpPassword || signUpIsFetching}
      >
        <Ionicons name="arrow-forward-outline" size={18} color="#07060E" />
        <Text style={styles.primaryButtonText}>Continue</Text>
      </Pressable>

      <Pressable style={styles.tabFooterButton} onPress={() => switchTab('sign-in')}>
        <Text style={styles.switchText}>Have an account?</Text>
        <Text style={styles.switchLink}>Sign in</Text>
      </Pressable>

      <Text style={styles.footerText}>Terms &amp; Privacy apply</Text>
      <View nativeID="clerk-captcha" />
    </>
  );

  const renderSignUpVerify = () => (
    <>
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Code</Text>
        <View style={styles.inputShell}>
          <Ionicons name="key-outline" size={18} color={EtherealColors.textMuted} />
          <TextInput
            style={styles.input}
            value={signUpCode}
            onChangeText={setSignUpCode}
            placeholder="000000"
            placeholderTextColor={EtherealColors.textMuted}
            keyboardType="numeric"
            autoComplete="one-time-code"
            editable={!signUpIsFetching}
          />
        </View>
        {signUpCodeError ? <Text style={styles.fieldError}>{signUpCodeError}</Text> : null}
      </View>

      {completionError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{completionError}</Text>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          (!signUpCode.trim() || signUpIsFetching) && styles.disabledButton,
          pressed && styles.pressedButton,
        ]}
        onPress={() => {
          void handleSignUpVerify();
        }}
        disabled={!signUpCode.trim() || signUpIsFetching}
      >
        <Ionicons name="arrow-forward-outline" size={18} color="#07060E" />
        <Text style={styles.primaryButtonText}>Continue</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressedButton]}
        onPress={() => {
          void signUp.verifications.sendEmailCode();
        }}
        disabled={signUpIsFetching}
      >
        <Text style={styles.secondaryButtonText}>Resend</Text>
      </Pressable>
    </>
  );

  const renderSignUpComplete = () => (
    <>
      {completionError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{completionError}</Text>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedButton]}
        onPress={() => {
          void completeSignUp();
        }}
      >
        <Ionicons name="arrow-forward-outline" size={18} color="#07060E" />
        <Text style={styles.primaryButtonText}>Continue</Text>
      </Pressable>
    </>
  );

  const screenTitle = signInNeedsMfa
    ? 'Code'
    : signUpNeedsVerification
      ? 'Code'
      : signUp.status === 'complete'
        ? 'Verified'
        : isCompletingSignUp || isSignedIn
          ? 'Almost there'
          : activeTab === 'sign-in'
            ? 'Welcome back'
            : 'Create account';

  const screenSubtitle = signInNeedsMfa
    ? 'From your email'
    : signUpNeedsVerification
      ? signUpEmail
      : null;

  return (
    <EtherealScreen contentContainerStyle={styles.scrollContent}>
      <View style={styles.brandBar}>
        <Text style={styles.brandName}>VERA</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.title}>{screenTitle}</Text>
        {screenSubtitle ? <Text style={styles.subtitle}>{screenSubtitle}</Text> : null}
      </View>

      {showTabs ? (
        <View style={styles.tabWrap} onLayout={onTabLayout}>
          <Animated.View
            style={[
              styles.tabIndicator,
              {
                width: indicatorWidth,
                transform: [{ translateX: indicatorTranslateX }],
              },
            ]}
          />
          <Pressable style={styles.tabButton} onPress={() => switchTab('sign-in')}>
            <Text style={[styles.tabLabel, activeTab === 'sign-in' && styles.tabLabelActive]}>Sign in</Text>
          </Pressable>
          <Pressable style={styles.tabButton} onPress={() => switchTab('sign-up')}>
            <Text style={[styles.tabLabel, activeTab === 'sign-up' && styles.tabLabelActive]}>Sign up</Text>
          </Pressable>
        </View>
      ) : null}

      <Animated.View style={[styles.card, animatedCardStyle]}>
        {isCompletingSignUp || isSignedIn ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={EtherealColors.primary} />
          </View>
        ) : signInNeedsMfa ? (
          renderSignInMfa()
        ) : signUpNeedsVerification ? (
          renderSignUpVerify()
        ) : signUp.status === 'complete' ? (
          renderSignUpComplete()
        ) : activeTab === 'sign-in' ? (
          renderSignInBase()
        ) : (
          renderSignUpBase()
        )}
      </Animated.View>
    </EtherealScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // ── Brand ──────────────────────────────────────────────────
  brandBar: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  brandName: {
    color: EtherealColors.textPrimary,
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    letterSpacing: 20.5,
    opacity: 0.7,
  },

  // ── Hero ───────────────────────────────────────────────────
  hero: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingBottom: 4,
  },
  title: {
    color: EtherealColors.textPrimary,
    fontSize: 44,
    fontFamily: Fonts.heading,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 52,
  },
  subtitle: {
    color: EtherealColors.textSecondary,
    fontSize: 15,
    fontFamily: Fonts.body,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Tab switcher ───────────────────────────────────────────
  tabWrap: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    padding: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(160, 146, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(160,146,255,0.30)',
  },
  tabButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tabLabel: {
    color: EtherealColors.textMuted,
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
  },
  tabLabelActive: {
    color: EtherealColors.primary,
  },

  // ── Card ───────────────────────────────────────────────────
  card: {
    // backgroundColor: 'rgba(15, 13, 20, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 32,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
    // backdropFilter: 'blur(40px)',
  },
  centerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },

  // ── Inputs ─────────────────────────────────────────────────
  inputGroup: {
    gap: 0,
  },
  inputLabel: {
    color: EtherealColors.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  inputShell: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 22,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  input: {
    flex: 1,
    color: EtherealColors.textPrimary,
    fontSize: 16,
    fontFamily: Fonts.body,
    paddingVertical: 16,
  },
  fieldError: {
    color: EtherealColors.error,
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
    lineHeight: 19,
    paddingHorizontal: 4,
    paddingTop: 5,
  },
  passwordStrength: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  strengthDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  strengthText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
  },
  errorBox: {
    backgroundColor: EtherealColors.errorBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 142, 163, 0.22)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: EtherealColors.error,
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
    lineHeight: 19,
  },

  // ── Buttons ────────────────────────────────────────────────
  primaryButton: {
    backgroundColor: EtherealColors.textPrimary,
    borderRadius: 999,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 14,
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#07060E',
    fontSize: 16,
    fontFamily: Fonts.bodyBold,
    letterSpacing: 0.2,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 999,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: EtherealColors.textPrimary,
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
  },
  ghostButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    color: EtherealColors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
  },

  // ── Footer links ───────────────────────────────────────────
  tabFooterButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  switchText: {
    color: EtherealColors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.body,
  },
  switchLink: {
    color: EtherealColors.accent,
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
  },
  footerText: {
    color: EtherealColors.textMuted,
    fontSize: 12,
    fontFamily: Fonts.bodyMedium,
    lineHeight: 18,
    textAlign: 'center',
  },
  disabledButton: {
    opacity: 0.38,
  },
  pressedButton: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
});
