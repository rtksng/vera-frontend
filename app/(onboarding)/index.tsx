import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
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
import axios from 'axios';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AuthColors } from '@/constants/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.9:8000';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingStep {
  key: string;
  emoji: string;
  title: string;
  subtitle: string;
  placeholder: string;
  multiline?: boolean;
  required?: boolean;
}

const STEPS: OnboardingStep[] = [
  {
    key: 'name',
    emoji: '👋',
    title: 'What should I call you?',
    subtitle: 'Your first name is enough.',
    placeholder: 'e.g. Ritik',
    required: true,
  },
  {
    key: 'age',
    emoji: '🎂',
    title: 'How old are you?',
    subtitle: 'This helps me tailor my advice.',
    placeholder: 'e.g. 21',
  },
  {
    key: 'background',
    emoji: '🎓',
    title: 'Tell me about yourself',
    subtitle: 'What do you do? Student, working, freelancing?',
    placeholder: 'e.g. CS student, interested in AI and startups',
    multiline: true,
  },
  {
    key: 'goals',
    emoji: '🎯',
    title: 'What are your current goals?',
    subtitle: 'What are you working towards right now?',
    placeholder: 'e.g. Build an AI product, get fit, learn DSA',
    multiline: true,
  },
  {
    key: 'weaknesses',
    emoji: '⚡',
    title: 'What do you struggle with?',
    subtitle: 'Be honest — I\'ll help you work on these.',
    placeholder: 'e.g. Procrastination, overthinking, consistency',
    multiline: true,
  },
  {
    key: 'values',
    emoji: '💎',
    title: 'What matters most to you?',
    subtitle: 'Your core values guide how I talk to you.',
    placeholder: 'e.g. Honesty, growth, family, discipline',
    multiline: true,
  },
  {
    key: 'patterns',
    emoji: '🔄',
    title: 'Any patterns to call out?',
    subtitle: 'Bad habits or cycles I should flag when I notice them.',
    placeholder: 'e.g. Late-night scrolling, skipping meals, avoiding hard tasks',
    multiline: true,
  },
];

export default function OnboardingScreen() {
  const { completeOnboarding, signOut, user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Ensure step is within bounds
  const safeStep = Math.max(0, Math.min(currentStep, STEPS.length - 1));
  const step = STEPS[safeStep];
  const isLastStep = safeStep === STEPS.length - 1;
  const isFirstStep = safeStep === 0;
  const currentValue = answers[step?.key] || '';
  const progress = (safeStep + 1) / STEPS.length;

  // Animate transition between steps
  const animateTransition = (direction: 1 | -1, callback: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: direction * -30,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      callback();
      slideAnim.setValue(direction * 30);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const goToNextStep = () => {
    if (isLastStep) {
      handleFinish();
      return;
    }
    setError('');
    animateTransition(1, () => setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1)));
  };

  const goToPreviousStep = () => {
    if (isFirstStep) return;
    setError('');
    animateTransition(-1, () => setCurrentStep((s) => Math.max(s - 1, 0)));
  };

  const handleFinish = async () => {
    // Validate required fields
    const nameValue = answers['name']?.trim();
    if (!nameValue) {
      setError('Please enter your name to continue');
      // Navigate back to name step
      animateTransition(-1, () => setCurrentStep(0));
      return;
    }

    setSaving(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        setError('Session expired. Please sign in again.');
        setSaving(false);
        return;
      }

      // Build profile payload
      const payload: Record<string, any> = {};
      for (const s of STEPS) {
        const value = (answers[s.key] || '').trim();
        if (!value) continue;
        // Convert age to number
        payload[s.key] = s.key === 'age' ? (parseInt(value, 10) || value) : value;
      }

      console.log('[Onboarding] Saving profile:', JSON.stringify(payload));

      await axios.put(`${API_URL}/profile`, payload, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000,
      });

      console.log('[Onboarding] Profile saved successfully');
      
      // Mark onboarding as complete - navigation will be handled by root layout
      completeOnboarding();
    } catch (e: any) {
      console.error('[Onboarding] Save error:', e);
      
      if (e.code === 'ECONNABORTED') {
        setError('Request timed out. Please check your connection and try again.');
      } else if (e.response?.status === 401 || e.response?.status === 403) {
        setError('Session expired. Please sign in again.');
      } else {
        setError('Failed to save profile. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleSignOut = async () => {
    setSaving(true);
    await signOut();
    setSaving(false);
  };

  // Safety check
  if (!step) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={AuthColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={AuthColors.background} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                { width: `${progress * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.stepIndicator}>
            {safeStep + 1} of {STEPS.length}
          </Text>
        </View>

        {/* Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.stepContent,
              {
                opacity: fadeAnim,
                transform: [{ translateX: slideAnim }],
              },
            ]}
          >
            {/* Emoji */}
            <Text style={styles.emoji}>{step.emoji}</Text>

            {/* Title & Subtitle */}
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.subtitle}>{step.subtitle}</Text>

            {/* Input */}
            <TextInput
              style={[styles.input, step.multiline && styles.inputMultiline]}
              value={currentValue}
              onChangeText={(text) => {
                setAnswers((prev) => ({ ...prev, [step.key]: text }));
                if (error) setError('');
              }}
              placeholder={step.placeholder}
              placeholderTextColor={AuthColors.placeholder}
              multiline={step.multiline}
              textAlignVertical={step.multiline ? 'top' : 'center'}
              keyboardType={step.key === 'age' ? 'number-pad' : 'default'}
              autoCapitalize={step.key === 'name' ? 'words' : 'sentences'}
              returnKeyType={step.multiline ? 'default' : 'done'}
              editable={!saving}
              maxLength={step.key === 'age' ? 3 : 500}
            />

            {/* Required indicator */}
            {step.required && (
              <Text style={styles.requiredHint}>* Required</Text>
            )}
          </Animated.View>
        </ScrollView>

        {/* Error Message */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Navigation */}
        <View style={styles.navigation}>
          <View style={styles.navRow}>
            {!isFirstStep ? (
              <TouchableOpacity
                onPress={goToPreviousStep}
                style={styles.backButton}
                disabled={saving}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.backButton} />
            )}

            <TouchableOpacity
              onPress={goToNextStep}
              style={[styles.nextButton, saving && styles.buttonDisabled]}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color={AuthColors.textPrimary} size="small" />
              ) : (
                <Text style={styles.nextButtonText}>
                  {isLastStep ? 'Finish' : 'Next'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Skip option */}
          {!isLastStep && (
            <TouchableOpacity
              onPress={handleSkip}
              style={styles.skipButton}
              disabled={saving}
            >
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </TouchableOpacity>
          )}

          {/* Sign out option */}
          <TouchableOpacity
            onPress={handleSignOut}
            style={styles.signOutButton}
            disabled={saving}
          >
            <Text style={styles.signOutButtonText}>
              {user?.email ? `Not ${user.email}? Sign out` : 'Sign out'}
            </Text>
          </TouchableOpacity>
        </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Progress
  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: AuthColors.surfaceLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: AuthColors.primary,
    borderRadius: 2,
  },
  stepIndicator: {
    color: AuthColors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
  },

  // Content
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  stepContent: {
    alignItems: 'center',
  },
  emoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    color: AuthColors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 32,
  },
  subtitle: {
    color: AuthColors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  input: {
    width: '100%',
    backgroundColor: AuthColors.inputBackground,
    color: AuthColors.inputText,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: AuthColors.inputBorder,
  },
  inputMultiline: {
    minHeight: 120,
    paddingTop: 16,
    textAlignVertical: 'top',
  },
  requiredHint: {
    color: AuthColors.textMuted,
    fontSize: 12,
    marginTop: 8,
    alignSelf: 'flex-start',
  },

  // Error
  errorBox: {
    backgroundColor: AuthColors.errorBackground,
    borderWidth: 1,
    borderColor: AuthColors.error,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 32,
    marginBottom: 12,
  },
  errorText: {
    color: AuthColors.errorLight,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Navigation
  navigation: {
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    minWidth: 80,
  },
  backButtonText: {
    color: AuthColors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: AuthColors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 36,
    minWidth: 120,
    alignItems: 'center',
  },
  nextButtonText: {
    color: AuthColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: AuthColors.buttonDisabledOpacity,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  skipButtonText: {
    color: AuthColors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  signOutButtonText: {
    color: AuthColors.errorLight,
    fontSize: 13,
    fontWeight: '500',
  },
});
