import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { Href, useRouter } from "expo-router";
import { Audio } from "expo-av";
import { File as ExpoFile, Paths } from "expo-file-system";
import { Asset } from "expo-asset";
import { useAuth } from "@clerk/expo";
import { SafeAreaView } from "react-native-safe-area-context";
import { EtherealBackdrop } from "@/components/ethereal-screen";
import { EtherealColors } from "@/constants/ethereal-theme";
import { postJson, transcribeAudio } from "@/lib/api";
import { LOW_LATENCY_RECORDING_OPTIONS } from "@/lib/audio";
import { useEngagement } from "@/contexts/EngagementContext";
import { type ChatMode } from "@/components/mode-toggle";
import { MilestonePopup } from "@/components/milestone-popup";
import VRoidAvatar, { visemeState } from "../../components/VRoidAvatar";
import { useLipSync } from "../../hooks/useLipSync";
import { HomeHeader } from "@/components/home-header";
import { HomeControls } from "@/components/home-controls";

const SILENCE_THRESHOLD = -40;
const SILENCE_DURATION_MS = 900;
const METERING_INTERVAL_MS = 120;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const VRM_ASSET = require("../../assets/avatar.vrm");

function useResolvedAssetUri(moduleId: number): string | null {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    Asset.fromModule(moduleId)
      .downloadAsync()
      .then((asset) => {
        if (!cancelled) setUri(asset.localUri ?? asset.uri);
      });
    return () => { cancelled = true; };
  }, [moduleId]);
  return uri;
}

interface ChatResponse {
  reply: string;
  memories_count?: number;
  tokens_used?: number;
  audio?: string;
  emotion?: string;
  mode?: string;
  response_delay_ms?: number;
  offer_calm_sounds?: boolean;
  celebrate?: boolean;
  time_of_day?: string;
  new_milestones?: Array<{ id: string; type: string; value: string }>;
}

type AppState = "idle" | "listening" | "thinking" | "speaking";

function getEmotionStyle(emotion: string): { color: string; emoji: string; label: string } {
  switch (emotion) {
    case "happy":       return { color: "#FFD700", emoji: "\u{1F60A}", label: "Happy" };
    case "serious":     return { color: "#8892B0", emoji: "\u{1F3AF}", label: "Serious" };
    case "curious":     return { color: "#1A6DFF", emoji: "\u{1F914}", label: "Curious" };
    case "encouraging": return { color: "#00C48C", emoji: "\u{1F4AA}", label: "Encouraging" };
    case "concerned":   return { color: "#FF6B35", emoji: "\u{1F61F}", label: "Concerned" };
    case "firm":        return { color: "#FF4757", emoji: "\u270B",    label: "Firm" };
    case "proud":       return { color: "#00C48C", emoji: "\u2B50",   label: "Proud" };
    case "thinking":    return { color: "#9C88FF", emoji: "\u{1F4AD}", label: "Thinking" };
    default:            return { color: "#4A5270", emoji: "\u{1F4AC}", label: "Ready" };
  }
}

function getMoodStatus(mood: string | undefined): { label: string; dot: string } {
  switch (mood) {
    case "lonely":   return { label: "Missed you",       dot: "#f59e0b" };
    case "missing":  return { label: "Glad you're back", dot: "#f59e0b" };
    case "waiting":
    case "present":  return { label: "Online",           dot: "#7dd3a8" };
    default:         return { label: "Welcome",          dot: "#7dd3a8" };
  }
}

function getTimeGreeting(hour: number): string {
  if (hour >= 5  && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Hey";
}

// ── WAV HELPERS ──────────────────────────────────────────────────────────────

function createWavHeader(
  dataLength: number,
  sampleRate: number,
  channels: number,
  bitsPerSample: number,
): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  const byteRate   = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  writeStr(0,  "RIFF");
  view.setUint32(4,  36 + dataLength, true);
  writeStr(8,  "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1,            true);
  view.setUint16(22, channels,     true);
  view.setUint32(24, sampleRate,   true);
  view.setUint32(28, byteRate,     true);
  view.setUint16(32, blockAlign,   true);
  view.setUint16(34, bitsPerSample,true);
  writeStr(36, "data");
  view.setUint32(40, dataLength, true);
  return new Uint8Array(header);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ── MAIN SCREEN ──────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const [appState, setAppState]           = useState<AppState>("idle");
  const [emotion, setEmotion]             = useState("neutral");
  const [lastAudioBase64, setLastAudioBase64] = useState("");
  const [continuousMode, setContinuousMode]   = useState(false);
  const [chatMode, setChatMode]           = useState<ChatMode>("normal");
  const [showCelebration, setShowCelebration] = useState(false);
  const [showCalmOffer, setShowCalmOffer]     = useState(false);

  const recordingRef            = useRef<Audio.Recording | null>(null);
  const meteringIntervalRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim               = useRef(new Animated.Value(1)).current;
  const celebrateAnim           = useRef(new Animated.Value(0)).current;
  const router                  = useRouter();
  const continuousModeRef       = useRef(false);
  const historyRef              = useRef<{ role: string; content: string }[]>([]);
  const appStateRef             = useRef<AppState>("idle");
  const soundRef                = useRef<Audio.Sound | null>(null);
  const isTransitioningRef      = useRef(false);
  const restartTimeoutRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStartingRecordingRef  = useRef(false);
  const recordingStartTokenRef  = useRef(0);

  const { getToken } = useAuth();
  const resolvedVrmUri = useResolvedAssetUri(VRM_ASSET);
  const { currentViseme } = useLipSync(lastAudioBase64, appState === "speaking");

  const {
    moodState, timeOfDay, localHour, level, xpProgressPct,
    milestones, ritualSuggestion, refresh, acknowledgeMilestone, engagement,
  } = useEngagement();

  // Push engagement data into the VRoidAvatar shared state
  useEffect(() => {
    visemeState.avatarWarmth     = engagement?.avatar_warmth ?? 0.5;
    visemeState.relationshipLevel = level;
    visemeState.moodState        = moodState?.mood ?? "present";
  }, [engagement, level, moodState]);

  useEffect(() => { visemeState.emotion = emotion; }, [emotion]);

  const moodStatus   = getMoodStatus(moodState?.mood);
  const emotionStyle = getEmotionStyle(emotion);
  const greeting     = getTimeGreeting(localHour);
  const isSpeaking   = appState === "speaking";

  const currentMilestone = milestones.length > 0 ? milestones[0] : null;

  // Celebration animation
  useEffect(() => {
    if (showCelebration) {
      Animated.sequence([
        Animated.timing(celebrateAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(celebrateAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setShowCelebration(false));
    }
  }, [showCelebration, celebrateAnim]);

  // Pulse animation while listening
  useEffect(() => {
    if (appState === "listening") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 400, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [appState, pulseAnim]);

  // ── HELPERS ──────────────────────────────────────────────────────

  const setContinuousModeTracked = useCallback((value: boolean) => {
    continuousModeRef.current = value;
    setContinuousMode(value);
  }, []);

  const setAppStateTracked = useCallback((next: AppState) => {
    appStateRef.current = next;
    setAppState(next);
  }, []);

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const token = await getToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch { return {}; }
  }, [getToken]);

  const stopMetering = () => {
    if (meteringIntervalRef.current) {
      clearInterval(meteringIntervalRef.current);
      meteringIntervalRef.current = null;
    }
  };

  const clearPendingRestart = () => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
  };

  const invalidatePendingRecordingStart = () => {
    recordingStartTokenRef.current += 1;
    isStartingRecordingRef.current = false;
  };

  const scheduleRecordingRestart = (delayMs = 300) => {
    clearPendingRestart();
    restartTimeoutRef.current = setTimeout(() => {
      restartTimeoutRef.current = null;
      if (continuousModeRef.current && appStateRef.current === "idle") {
        void startRecording();
      }
    }, delayMs);
  };

  // ── AUDIO PLAYBACK ────────────────────────────────────────────────

  const playAudio = async (audioBase64: string) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });

      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      const wavHeader = createWavHeader(bytes.length, 16000, 1, 16);
      const wavBytes  = new Uint8Array(wavHeader.length + bytes.length);
      wavBytes.set(wavHeader, 0);
      wavBytes.set(bytes, wavHeader.length);

      const wavBase64  = uint8ToBase64(wavBytes);
      const audioFile  = new ExpoFile(Paths.cache, "vera_response.wav");
      audioFile.write(wavBase64, { encoding: "base64" });

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioFile.uri },
        { shouldPlay: true },
      );
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
          setLastAudioBase64("");
          if (appStateRef.current !== "speaking") return;
          setAppStateTracked("idle");
          if (continuousModeRef.current && !isTransitioningRef.current) {
            isTransitioningRef.current = true;
            clearPendingRestart();
            restartTimeoutRef.current = setTimeout(async () => {
              restartTimeoutRef.current = null;
              isTransitioningRef.current = false;
              if (continuousModeRef.current && appStateRef.current === "idle") {
                await startRecording();
              }
            }, 300);
          }
        }
      });
    } catch (e) {
      console.error("Audio playback error:", e);
      if (continuousModeRef.current) {
        setAppStateTracked("idle");
        scheduleRecordingRestart(300);
      } else {
        setAppStateTracked("idle");
      }
    }
  };

  // ── RECORDING ────────────────────────────────────────────────────

  const startRecording = async () => {
    if (recordingRef.current || isStartingRecordingRef.current) return;
    clearPendingRestart();
    stopMetering();

    const startToken = recordingStartTokenRef.current + 1;
    recordingStartTokenRef.current = startToken;
    isStartingRecordingRef.current = true;

    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("Microphone Required", "Vera needs microphone access to hear you.");
        setContinuousModeTracked(false);
        setAppStateTracked("idle");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      if (!continuousModeRef.current || startToken !== recordingStartTokenRef.current) {
        setAppStateTracked("idle");
        return;
      }
      const { recording } = await Audio.Recording.createAsync(LOW_LATENCY_RECORDING_OPTIONS);
      if (!continuousModeRef.current || startToken !== recordingStartTokenRef.current) {
        await recording.stopAndUnloadAsync().catch(() => {});
        return;
      }
      recordingRef.current = recording;
      setAppStateTracked("listening");

      let silentSince: number | null = null;
      let hasSpoken = false;
      const recordingStartTime = Date.now();
      const WARMUP_MS = 1200;
      const MAX_WAIT_FOR_SPEECH_MS = 30000;

      meteringIntervalRef.current = setInterval(async () => {
        if (!recordingRef.current) return;
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (!status.isRecording) return;
          const metering = status.metering ?? -160;
          const elapsed  = Date.now() - recordingStartTime;
          if (metering < SILENCE_THRESHOLD) {
            if (!silentSince) silentSince = Date.now();
            const pastWarmup = elapsed > WARMUP_MS;
            if (hasSpoken && pastWarmup && Date.now() - silentSince >= SILENCE_DURATION_MS) {
              stopRecordingAndSend();
            } else if (!hasSpoken && elapsed > MAX_WAIT_FOR_SPEECH_MS) {
              setContinuousModeTracked(false);
              stopRecordingAndSend();
            }
          } else {
            silentSince = null;
            hasSpoken = true;
          }
        } catch { /* recording may have been stopped */ }
      }, METERING_INTERVAL_MS);
    } catch (e) {
      console.error("Start recording error:", e);
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
      setContinuousModeTracked(false);
      setAppStateTracked("idle");
    } finally {
      if (startToken === recordingStartTokenRef.current) {
        isStartingRecordingRef.current = false;
      }
    }
  };

  const stopRecordingAndSend = async () => {
    clearPendingRestart();
    invalidatePendingRecordingStart();
    stopMetering();
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) {
        setAppStateTracked("thinking");
        await sendVoiceMessage(uri);
      } else {
        if (continuousModeRef.current) { setAppStateTracked("idle"); void startRecording(); }
        else { setAppStateTracked("idle"); }
      }
    } catch (e) {
      console.error("Stop recording error:", e);
      setContinuousModeTracked(false);
      setAppStateTracked("idle");
    }
  };

  // ── VOICE MESSAGE FLOW ────────────────────────────────────────────

  const sendVoiceMessage = async (audioUri: string) => {
    const headers = await getAuthHeaders();
    try {
      const { text: transcribedText } = await transcribeAudio(audioUri, headers);
      if (!transcribedText) {
        if (continuousModeRef.current) { setAppStateTracked("idle"); void startRecording(); }
        else { setAppStateTracked("idle"); }
        return;
      }
      historyRef.current = [
        ...historyRef.current.slice(-10),
        { role: "user", content: transcribedText },
      ];
      const chatRes = await postJson<ChatResponse>(
        "/chat",
        { text: transcribedText, history: historyRef.current.slice(-10), mode: chatMode },
        headers,
      );
      historyRef.current = [...historyRef.current, { role: "assistant", content: chatRes.reply }];
      setEmotion(chatRes.emotion ?? "neutral");
      if (chatRes.celebrate) setShowCelebration(true);
      setShowCalmOffer(!!chatRes.offer_calm_sounds);
      refresh();

      const delayMs = chatRes.response_delay_ms ?? 0;
      const audio   = chatRes.audio ?? "";
      if (audio) {
        if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
        setAppStateTracked("speaking");
        setLastAudioBase64(audio);
        await playAudio(audio);
      } else {
        if (continuousModeRef.current) { setAppStateTracked("idle"); void startRecording(); }
        else { setAppStateTracked("idle"); }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown voice request error";
      console.error("Voice message error:", err);
      Alert.alert("Voice request failed", msg);
      clearPendingRestart();
      invalidatePendingRecordingStart();
      setContinuousModeTracked(false);
      setAppStateTracked("idle");
    } finally {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    }
  };

  // ── BUTTON HANDLERS ───────────────────────────────────────────────

  const handleTalkPress = () => {
    if (appState === "idle") {
      setContinuousModeTracked(true);
      void startRecording();
    } else if (appState === "listening") {
      setContinuousModeTracked(false);
      stopRecordingAndSend();
    }
  };

  const handleStopConversation = async () => {
    clearPendingRestart();
    invalidatePendingRecordingStart();
    setContinuousModeTracked(false);
    isTransitioningRef.current = false;
    if (soundRef.current) {
      await soundRef.current.stopAsync().catch(() => {});
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    stopMetering();
    if (recordingRef.current) {
      await recordingRef.current.stopAndUnloadAsync().catch(() => {});
      recordingRef.current = null;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    setLastAudioBase64("");
    setAppStateTracked("idle");
  };

  const handleOpenSettings = () => router.push("/(home)/settings" as Href);

  const handleRitualPress = () => {
    const type = ritualSuggestion === "morning_intention" ? "morning" : "night";
    router.push({ pathname: "/(home)/ritual", params: { type } } as never);
  };

  // ── CLEANUP ───────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      clearPendingRestart();
      invalidatePendingRecordingStart();
      stopMetering();
      if (recordingRef.current) { recordingRef.current.stopAndUnloadAsync().catch(() => {}); recordingRef.current = null; }
      if (soundRef.current)    soundRef.current.unloadAsync().catch(() => {});
    };
  }, []);

  // ── RENDER ────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#07060E" />
      <EtherealBackdrop />

      <SafeAreaView style={styles.safeArea}>
        <HomeHeader
          greeting={greeting}
          level={level}
          xpProgressPct={xpProgressPct}
          moodLabel={moodStatus.label}
          moodDotColor={moodStatus.dot}
          emotion={emotion}
          emotionStyle={emotionStyle}
          onSettingsPress={handleOpenSettings}
        />

        {/* Avatar — fills all remaining vertical space */}
        <View style={styles.avatarWrapper}>
          {isSpeaking && (
            <View
              style={[styles.speakingGlow, { shadowColor: emotionStyle.color }]}
              pointerEvents="none"
            />
          )}
          {showCelebration && (
            <Animated.View
              style={[styles.celebrationOverlay, { opacity: celebrateAnim }]}
              pointerEvents="none"
            />
          )}
          <VRoidAvatar
            vrmUrl={resolvedVrmUri ?? ""}
            emotion={emotion}
            isSpeaking={isSpeaking}
            viseme={currentViseme}
          />
        </View>

        <HomeControls
          appState={appState}
          chatMode={chatMode}
          continuousMode={continuousMode}
          ritualSuggestion={ritualSuggestion ?? null}
          showCalmOffer={showCalmOffer}
          pulseAnim={pulseAnim}
          onTalkPress={handleTalkPress}
          onStopConversation={handleStopConversation}
          onModeChange={setChatMode}
          onRitualPress={handleRitualPress}
          onDismissCalmOffer={() => setShowCalmOffer(false)}
        />
      </SafeAreaView>

      <MilestonePopup milestone={currentMilestone} onDismiss={() => currentMilestone && acknowledgeMilestone(currentMilestone.id)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#07060E",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 12,
  },
  avatarWrapper: {
    flex: 1,
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "rgba(20, 19, 24, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(119, 116, 122, 0.22)",
    position: "relative",
  },
  speakingGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 8,
    backgroundColor: "transparent",
    zIndex: 1,
  },
  celebrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    zIndex: 2,
  },
});
