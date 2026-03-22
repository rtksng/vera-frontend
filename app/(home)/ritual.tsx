import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  Animated,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { File as ExpoFile, Paths } from "expo-file-system";
import { useAuth } from "@clerk/expo";
import { SafeAreaView } from "react-native-safe-area-context";
import { EtherealBackdrop } from "@/components/ethereal-screen";
import { EtherealColors, EtherealSurface } from "@/constants/ethereal-theme";
import { Fonts } from "@/constants/theme";
import { postJson, transcribeAudio } from "@/lib/api";
import { LOW_LATENCY_RECORDING_OPTIONS } from "@/lib/audio";
import { useEngagement } from "@/contexts/EngagementContext";

const BG = "#07060E";

type RitualType = "morning" | "night";

interface RitualResponse {
  success: boolean;
  ai_response: string;
  emotion: string;
  audio?: string;
}

export default function RitualScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const ritualType: RitualType = (params.type as RitualType) || "morning";
  const router = useRouter();
  const { getToken } = useAuth();
  const { refresh } = useEngagement();

  const [phase, setPhase] = useState<"prompt" | "recording" | "processing" | "done">("prompt");
  const [aiResponse, setAiResponse] = useState("");
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef     = useRef<Audio.Sound | null>(null);
  const pulseAnim    = useRef(new Animated.Value(1)).current;

  const copy = ritualType === "morning"
    ? { emoji: "☀️", title: "Morning Intention", question: "What's the one thing you want to feel good about today?" }
    : { emoji: "🌟", title: "Night Reflection",  question: "How did today actually go?" };

  const getAuthHeaders = useCallback(async () => {
    try {
      const token = await getToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch { return {}; }
  }, [getToken]);

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { Alert.alert("Microphone needed"); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(LOW_LATENCY_RECORDING_OPTIONS);
      recordingRef.current = recording;
      setPhase("recording");
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
        ]),
      ).start();
    } catch (e) {
      console.error("Ritual record error:", e);
    }
  };

  const stopAndSubmit = async () => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    const recording = recordingRef.current;
    if (!recording) return;
    recordingRef.current = null;
    setPhase("processing");
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) { setPhase("prompt"); return; }
      const headers = await getAuthHeaders();
      const { text } = await transcribeAudio(uri, headers);
      if (!text) { setPhase("prompt"); return; }
      const endpoint = ritualType === "morning" ? "/ritual/morning" : "/ritual/night";
      const res = await postJson<RitualResponse>(endpoint, { content: text }, headers);
      setAiResponse(res.ai_response);
      setPhase("done");
      if (res.audio) await playAudio(res.audio);
      refresh();
    } catch (e) {
      console.error("Ritual submit error:", e);
      setPhase("prompt");
    } finally {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    }
  };

  const playAudio = async (base64: string) => {
    try {
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      const headerBuf = new ArrayBuffer(44);
      const v = new DataView(headerBuf);
      const write = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      write(0, "RIFF"); v.setUint32(4, 36 + bytes.length, true); write(8, "WAVE");
      write(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
      v.setUint16(22, 1, true); v.setUint32(24, 16000, true); v.setUint32(28, 32000, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true); write(36, "data");
      v.setUint32(40, bytes.length, true);

      const header = new Uint8Array(headerBuf);
      const wav = new Uint8Array(header.length + bytes.length);
      wav.set(header); wav.set(bytes, header.length);
      let bin = ""; for (let i = 0; i < wav.length; i++) bin += String.fromCharCode(wav[i]);

      const file = new ExpoFile(Paths.cache, "ritual_response.wav");
      file.write(btoa(bin), { encoding: "base64" });
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync({ uri: file.uri }, { shouldPlay: true });
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) { sound.unloadAsync(); soundRef.current = null; }
      });
    } catch (e) {
      console.error("Ritual playback error:", e);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <EtherealBackdrop />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={18} color={EtherealColors.textSecondary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerEyebrow}>
              {ritualType === "morning" ? "Morning" : "Night"}
            </Text>
            <Text style={styles.headerTitle}>{copy.title}</Text>
          </View>
        </View>

        {/* Body */}
        <View style={styles.body}>
          <Text style={styles.emoji}>{copy.emoji}</Text>
          <Text style={styles.question}>{copy.question}</Text>

          {phase === "prompt" && (
            <TouchableOpacity style={styles.recordBtn} onPress={startRecording} activeOpacity={0.8}>
              <Ionicons name="mic-outline" size={30} color="#07060E" />
              <Text style={styles.recordLabel}>Tap to answer</Text>
            </TouchableOpacity>
          )}

          {phase === "recording" && (
            <TouchableOpacity style={styles.stopArea} onPress={stopAndSubmit} activeOpacity={0.8}>
              <Animated.View style={[styles.stopRing, { transform: [{ scale: pulseAnim }] }]}>
                <Ionicons name="stop-circle" size={64} color={EtherealColors.accent} />
              </Animated.View>
              <Text style={styles.recordLabel}>Tap to finish</Text>
            </TouchableOpacity>
          )}

          {phase === "processing" && (
            <Text style={styles.processingText}>Reflecting on what you shared…</Text>
          )}

          {phase === "done" && (
            <View style={styles.responseCard}>
              <Text style={styles.responseText}>{aiResponse}</Text>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => router.replace("/(home)" as Href)}
                activeOpacity={0.8}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  backBtn: {
    backgroundColor: EtherealColors.surfaceStrong,
    borderWidth: 1,
    borderColor: EtherealColors.outline,
    width: 46,
    height: 46,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  headerEyebrow: {
    fontSize: 11,
    fontFamily: Fonts.bodyBold,
    color: EtherealColors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: Fonts.heading,
    color: EtherealColors.textPrimary,
    letterSpacing: 0.2,
  },
  body: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    paddingHorizontal: 8,
  },
  emoji: {
    fontSize: 60,
  },
  question: {
    fontSize: 22,
    fontFamily: Fonts.headingSoft,
    color: EtherealColors.textPrimary,
    textAlign: "center",
    lineHeight: 30,
    letterSpacing: 0.1,
  },
  recordBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: EtherealColors.primary,
    borderRadius: 999,
    paddingHorizontal: 32,
    paddingVertical: 16,
    marginTop: 8,
    shadowColor: EtherealColors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  recordLabel: {
    color: "#07060E",
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
  },
  stopArea: {
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  stopRing: {
    padding: 4,
  },
  processingText: {
    color: EtherealColors.textMuted,
    fontSize: 16,
    fontFamily: Fonts.bodyMedium,
    fontStyle: "italic",
  },
  responseCard: {
    ...EtherealSurface.cardRaised,
    borderRadius: 24,
    padding: 22,
    gap: 20,
    width: "100%",
  },
  responseText: {
    fontSize: 16,
    fontFamily: Fonts.body,
    lineHeight: 26,
    color: EtherealColors.textPrimary,
  },
  doneBtn: {
    backgroundColor: EtherealColors.primary,
    borderRadius: 999,
    paddingHorizontal: 32,
    paddingVertical: 13,
    alignSelf: "center",
    shadowColor: EtherealColors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  doneBtnText: {
    color: "#07060E",
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
  },
});
