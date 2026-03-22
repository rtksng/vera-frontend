import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Href, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth } from '@clerk/expo';
import { EtherealScreen } from '@/components/ethereal-screen';
import { EtherealColors, EtherealSurface } from '@/constants/ethereal-theme';
import { Fonts } from '@/constants/theme';
import { postJson, transcribeAudio } from '@/lib/api';
import { LOW_LATENCY_RECORDING_OPTIONS } from '@/lib/audio';

type OnboardingState = 'idle' | 'recording' | 'transcribing' | 'confirming' | 'saving';

type MetaChipProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: 'primary' | 'accent';
};

type StepPillProps = {
  label: string;
  active: boolean;
  complete: boolean;
};

function MetaChip({ icon, label, tone = 'primary' }: MetaChipProps) {
  const color = tone === 'accent' ? EtherealColors.accent : EtherealColors.primary;

  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={styles.metaChipText}>{label}</Text>
    </View>
  );
}

function StepPill({ label, active, complete }: StepPillProps) {
  return (
    <View style={[styles.stepPill, active && styles.stepPillActive, complete && styles.stepPillComplete]}>
      <Ionicons
        name={complete ? 'checkmark-outline' : active ? 'radio-button-on-outline' : 'ellipse-outline'}
        size={14}
        color={
          complete ? EtherealColors.success : active ? EtherealColors.accent : EtherealColors.textMuted
        }
      />
      <Text style={[styles.stepPillText, active && styles.stepPillTextActive]}>{label}</Text>
    </View>
  );
}

export default function OnboardingScreen() {
  const [appState, setAppState] = useState<OnboardingState>('idle');
  const [transcribedText, setTranscribedText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const router = useRouter();
  const { getToken } = useAuth();

  useEffect(() => {
    if (appState === 'recording') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 520, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 520, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }

    pulseAnim.setValue(1);
  }, [appState, pulseAnim]);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const getAuthHeaders = async (): Promise<Record<string, string>> => {
    try {
      const token = await getToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  };

  const startRecording = async () => {
    try {
      setErrorMsg('');
      const { granted } = await Audio.requestPermissionsAsync();

      if (!granted) {
        setErrorMsg('Microphone access is required to use voice onboarding.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(LOW_LATENCY_RECORDING_OPTIONS);
      recordingRef.current = recording;
      setAppState('recording');
    } catch (err) {
      console.error('Failed to start recording:', err);
      setErrorMsg('Failed to start recording. Please try again.');
      setAppState('idle');
    }
  };

  const stopRecordingAndTranscribe = async () => {
    if (!recordingRef.current) {
      return;
    }

    setAppState('transcribing');

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        throw new Error('No audio URI found');
      }

      const headers = await getAuthHeaders();
      const { text } = await transcribeAudio(uri, headers, 'onboarding.m4a');
      setTranscribedText(text);
      setAppState('confirming');
    } catch (err) {
      console.error('Transcription failed:', err);
      setErrorMsg('Failed to transcribe audio. You can try again or type your introduction manually.');
      setAppState('confirming');
    } finally {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    }
  };

  const skipOnboarding = () => {
    router.replace('/(home)' as Href);
  };

  const saveContextAndComplete = async () => {
    if (!transcribedText.trim()) {
      skipOnboarding();
      return;
    }

    setAppState('saving');
    setErrorMsg('');

    try {
      const headers = await getAuthHeaders();
      await postJson(
        '/memories/add',
        { content: `User Onboarding Context: ${transcribedText.trim()}` },
        headers,
      );

      router.replace('/(home)' as Href);
    } catch (err) {
      console.error('Failed to save context:', err);
      setErrorMsg('Failed to save your introduction. Please try again.');
      setAppState('confirming');
    }
  };

  const handleRecordButton = () => {
    if (appState === 'idle') {
      startRecording();
    } else if (appState === 'recording') {
      stopRecordingAndTranscribe();
    }
  };

  const isRecordingView =
    appState === 'idle' || appState === 'recording' || appState === 'transcribing';

  const currentStep = appState === 'saving' ? 3 : isRecordingView ? 1 : 2;
  const heroIcon =
    appState === 'recording'
      ? 'radio-button-on-outline'
      : appState === 'transcribing'
        ? 'hourglass-outline'
        : appState === 'saving'
          ? 'checkmark-done-outline'
          : isRecordingView
            ? 'mic-outline'
            : 'create-outline';

  const previewText = useMemo(() => {
    const trimmed = transcribedText.trim();
    if (!trimmed) {
      return '';
    }

    return trimmed.length > 220 ? `${trimmed.slice(0, 217).trim()}...` : trimmed;
  }, [transcribedText]);

  return (
    <EtherealScreen contentContainerStyle={styles.scrollContent}>
      <View style={styles.hero}>
        <Text style={styles.brandName}>VERA</Text>
        <Text style={styles.title}>Tell me about{'\n'}yourself</Text>
       
      </View>

      <View style={styles.stepRow}>
        <StepPill label="Speak" active={currentStep === 1} complete={currentStep > 1} />
        <StepPill label="Review" active={currentStep === 2} complete={currentStep > 2} />
        <StepPill label="Start" active={currentStep === 3} complete={false} />
      </View>

      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {isRecordingView ? (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Just talk</Text>
            <Text style={styles.panelSubtitle}>
              Say your name, what you do, what you&apos;re working toward, and what Vera should keep in
              mind.
            </Text>
          </View>

         

          <View style={styles.recordArea}>
            <Animated.View style={[styles.recordHalo, { transform: [{ scale: pulseAnim }] }]} />
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleRecordButton}
              disabled={appState === 'transcribing'}
              style={styles.recordTouch}
            >
              <Animated.View
                style={[
                  styles.recordButton,
                  appState === 'recording' && styles.recordButtonActive,
                  appState === 'transcribing' && styles.recordButtonBusy,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                {appState === 'transcribing' ? (
                  <ActivityIndicator color={EtherealColors.textPrimary} size="large" />
                ) : (
                  <Ionicons
                    name={appState === 'recording' ? 'stop-outline' : 'mic-outline'}
                    size={34}
                    color={EtherealColors.textPrimary}
                  />
                )}
              </Animated.View>
            </TouchableOpacity>

            <Text style={styles.statusText}>
              {appState === 'idle'
                ? 'Tap to start speaking'
                : appState === 'recording'
                  ? 'Recording... tap again when you are done'
                  : 'Transcribing your introduction...'}
            </Text>

            <TouchableOpacity
              onPress={() => setAppState('confirming')}
              style={styles.textModeButton}
              activeOpacity={0.86}
              disabled={appState === 'transcribing'}
            >
              <Ionicons name="create-outline" size={16} color={EtherealColors.textSecondary} />
              <Text style={styles.textModeText}>I&apos;d rather type</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.panel}>
          {previewText ? (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Ionicons name="sparkles-outline" size={16} color={EtherealColors.accent} />
                <Text style={styles.previewLabel}>I heard</Text>
              </View>
              <Text style={styles.previewText}>{previewText}</Text>
            </View>
          ) : null}

          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Edit the details</Text>
            <Text style={styles.panelSubtitle}>
              Refine the text below so Vera starts with the right context about you.
            </Text>
          </View>

          <TextInput
            style={styles.textInput}
            multiline
            value={transcribedText}
            onChangeText={setTranscribedText}
            placeholder="Hi, I want Vera to help me stay focused on..."
            placeholderTextColor={EtherealColors.textMuted}
            editable={appState !== 'saving'}
            textAlignVertical="top"
          />

          <View style={styles.actionStack}>
            <TouchableOpacity
              style={[styles.primaryButton, appState === 'saving' && styles.disabledButton]}
              onPress={saveContextAndComplete}
              disabled={appState === 'saving'}
              activeOpacity={0.9}
            >
              {appState === 'saving' ? (
                <ActivityIndicator color="#07060E" />
              ) : (
                <>
                  <Ionicons name="arrow-forward-outline" size={18} color="#07060E" />
                  <Text style={styles.primaryButtonText}>Looks right, continue</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={startRecording}
              disabled={appState === 'saving'}
              activeOpacity={0.9}
            >
              <Ionicons name="mic-outline" size={18} color={EtherealColors.textPrimary} />
              <Text style={styles.secondaryButtonText}>Record again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tertiaryButton}
              onPress={() => setAppState('idle')}
              disabled={appState === 'saving'}
              activeOpacity={0.82}
            >
              <Text style={styles.tertiaryButtonText}>Back to voice</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {appState !== 'saving' ? (
        <TouchableOpacity style={styles.skipButton} onPress={skipOnboarding} activeOpacity={0.82}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      ) : null}
    </EtherealScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 18,
    paddingVertical: 32,
  },
  hero: {
    alignItems: 'center',
    gap: 14,
    paddingTop: 8,
    paddingHorizontal: 10,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaChip: {
    ...EtherealSurface.pill,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  metaChipText: {
    color: EtherealColors.textSecondary,
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
  },
  heroOrbFrame: {
    width: 122,
    height: 122,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOrbGlow: {
    position: 'absolute',
    width: 122,
    height: 122,
    borderRadius: 999,
    backgroundColor: EtherealColors.primary,
    opacity: 0.22,
  },
  heroOrbCore: {
    width: 94,
    height: 94,
    borderRadius: 999,
    backgroundColor: EtherealColors.surfaceRaised,
    borderWidth: 1,
    borderColor: EtherealColors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: EtherealColors.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.38,
    shadowRadius: 28,
    elevation: 18,
  },
  // ── Hero ───────────────────────────────────────────────────
  brandName: {
    color: EtherealColors.textPrimary,
    fontSize: 13,
    fontFamily: Fonts.bodyBold,
    letterSpacing: 20.5,
    opacity: 0.7,
  },
  eyebrow: {
    color: EtherealColors.accent,
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    color: EtherealColors.textPrimary,
    fontSize: 40,
    fontFamily: Fonts.heading,
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 48,
  },
  subtitle: {
    color: EtherealColors.textSecondary,
    fontSize: 15,
    fontFamily: Fonts.body,
    lineHeight: 23,
    textAlign: 'center',
    maxWidth: 340,
  },
  stepRow: {
    ...EtherealSurface.card,
    borderRadius: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  stepPill: {
    ...EtherealSurface.pill,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  stepPillActive: {
    borderColor: 'rgba(254, 193, 110, 0.3)',
    backgroundColor: 'rgba(254, 193, 110, 0.08)',
  },
  stepPillComplete: {
    borderColor: 'rgba(125, 211, 168, 0.24)',
    backgroundColor: 'rgba(125, 211, 168, 0.08)',
  },
  stepPillText: {
    color: EtherealColors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
  },
  stepPillTextActive: {
    color: EtherealColors.accent,
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
    textAlign: 'center',
  },
  panel: {
    ...EtherealSurface.cardRaised,
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 22,
    gap: 18,
  },
  panelHeader: {
    gap: 8,
  },
  panelTitle: {
    color: EtherealColors.textPrimary,
    fontSize: 28,
    fontFamily: Fonts.heading,
    letterSpacing: -0.2,
  },
  panelSubtitle: {
    color: EtherealColors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.body,
    lineHeight: 22,
  },
  promptList: {
    gap: 12,
  },
  promptItem: {
    ...EtherealSurface.pill,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  promptText: {
    flex: 1,
    color: EtherealColors.textSecondary,
    fontSize: 13,
    fontFamily: Fonts.body,
    lineHeight: 19,
  },
  recordArea: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  recordHalo: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: EtherealColors.primary,
    opacity: 0.14,
  },
  recordTouch: {
    borderRadius: 999,
  },
  recordButton: {
    width: 116,
    height: 116,
    borderRadius: 999,
    backgroundColor: EtherealColors.primaryStrong,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: EtherealColors.primary,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.34,
    shadowRadius: 30,
    elevation: 18,
  },
  recordButtonActive: {
    backgroundColor: EtherealColors.accent,
    shadowColor: EtherealColors.accent,
  },
  recordButtonBusy: {
    backgroundColor: EtherealColors.surfaceRaised,
    shadowColor: EtherealColors.shadow,
  },
  statusText: {
    color: EtherealColors.textPrimary,
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 260,
  },
  textModeButton: {
    ...EtherealSurface.pill,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  textModeText: {
    color: EtherealColors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
  },
  previewCard: {
    ...EtherealSurface.pill,
    borderRadius: 20,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewLabel: {
    color: EtherealColors.accent,
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  previewText: {
    color: EtherealColors.textPrimary,
    fontSize: 14,
    fontFamily: Fonts.body,
    lineHeight: 22,
  },
  textInput: {
    backgroundColor: EtherealColors.inputBackground,
    borderWidth: 1,
    borderColor: EtherealColors.inputBorder,
    borderRadius: 22,
    color: EtherealColors.textPrimary,
    minHeight: 230,
    paddingHorizontal: 18,
    paddingVertical: 18,
    fontSize: 16,
    fontFamily: Fonts.body,
    lineHeight: 24,
  },
  actionStack: {
    gap: 12,
  },
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
  },
  primaryButtonText: {
    color: '#07060E',
    fontSize: 16,
    fontFamily: Fonts.bodyBold,
    letterSpacing: 0.2,
  },
  secondaryButton: {
    ...EtherealSurface.pill,
    borderRadius: 999,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButtonText: {
    color: EtherealColors.textPrimary,
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
  },
  tertiaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tertiaryButtonText: {
    color: EtherealColors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
  },
  disabledButton: {
    opacity: 0.48,
  },
  skipButton: {
    ...EtherealSurface.pill,
    borderRadius: 999,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 4,
  },
  skipText: {
    color: EtherealColors.textSecondary,
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
  },
});
