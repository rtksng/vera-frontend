import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, Href } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { AuthColors } from '@/constants/theme';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSignUp = async () => {
    // Clear previous error
    setError('');

    // Validation
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    if (!password) {
      setError('Please enter a password');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    const { error: signUpError } = await signUp(email, password);

    setLoading(false);

    if (signUpError) {
      setError(signUpError);
    }
    // Navigation is handled automatically by the root layout based on auth state
  };

  const getPasswordStrength = () => {
    if (!password) return null;
    if (password.length < 6) return { text: 'Too short', color: AuthColors.error };
    if (password.length < 8) return { text: 'Weak', color: '#FFA500' };
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      return { text: 'Strong', color: AuthColors.success };
    }
    return { text: 'Medium', color: '#FFD700' };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={AuthColors.background} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Logo/Icon */}
            <View style={styles.logoContainer}>
              <Text style={styles.logo}>🚀</Text>
            </View>

            {/* Header */}
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Start your personal AI journey today
            </Text>

            {/* Form */}
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) setError('');
                  }}
                  placeholder="Enter your email"
                  placeholderTextColor={AuthColors.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (error) setError('');
                  }}
                  placeholder="Create a password"
                  placeholderTextColor={AuthColors.placeholder}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password-new"
                  editable={!loading}
                />
                {passwordStrength && (
                  <View style={styles.passwordStrength}>
                    <View style={[styles.strengthDot, { backgroundColor: passwordStrength.color }]} />
                    <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                      {passwordStrength.text}
                    </Text>
                  </View>
                )}
                <Text style={styles.passwordHint}>
                  Must be at least 6 characters
                </Text>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                <TextInput
                  style={[
                    styles.input,
                    confirmPassword && password !== confirmPassword && styles.inputError,
                  ]}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (error) setError('');
                  }}
                  placeholder="Confirm your password"
                  placeholderTextColor={AuthColors.placeholder}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password-new"
                  editable={!loading}
                />
                {confirmPassword && password !== confirmPassword && (
                  <Text style={styles.matchError}>Passwords do not match</Text>
                )}
              </View>

              {/* Error Message */}
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Sign Up Button */}
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleSignUp}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={AuthColors.textPrimary} size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Create Account</Text>
                )}
              </TouchableOpacity>

              {/* Sign In Link */}
              <View style={styles.switchContainer}>
                <Text style={styles.switchText}>Already have an account? </Text>
                <Link href={'/(auth)/sign-in' as Href} asChild>
                  <TouchableOpacity disabled={loading}>
                    <Text style={styles.switchLink}>Sign In</Text>
                  </TouchableOpacity>
                </Link>
              </View>

              {/* Terms */}
              <Text style={styles.terms}>
                By creating an account, you agree to our{' '}
                <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: AuthColors.background,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    fontSize: 72,
  },
  title: {
    color: AuthColors.textPrimary,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: AuthColors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 24,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    color: AuthColors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: AuthColors.inputBackground,
    color: AuthColors.inputText,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: AuthColors.inputBorder,
  },
  inputError: {
    borderColor: AuthColors.error,
  },
  passwordStrength: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  strengthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  passwordHint: {
    color: AuthColors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  matchError: {
    color: AuthColors.errorLight,
    fontSize: 12,
    marginTop: 6,
  },
  errorBox: {
    backgroundColor: AuthColors.errorBackground,
    borderWidth: 1,
    borderColor: AuthColors.error,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  errorText: {
    color: AuthColors.errorLight,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: AuthColors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  btnDisabled: {
    opacity: AuthColors.buttonDisabledOpacity,
  },
  primaryBtnText: {
    color: AuthColors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  switchText: {
    color: AuthColors.textSecondary,
    fontSize: 15,
  },
  switchLink: {
    color: AuthColors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  terms: {
    color: AuthColors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: AuthColors.primary,
  },
});
