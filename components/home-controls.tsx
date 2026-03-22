import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EtherealColors, EtherealSurface } from "@/constants/ethereal-theme";
import { Fonts } from "@/constants/theme";
import { type ChatMode } from "@/components/mode-toggle";

export type AppState = "idle" | "listening" | "thinking" | "speaking";

const MODES: { key: ChatMode; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { key: "normal",  icon: "chatbubble-outline", label: "Chat"   },
  { key: "vent",    icon: "heart-outline",      label: "Listen" },
  { key: "commute", icon: "headset-outline",    label: "Drive"  },
];

interface HomeControlsProps {
  appState: AppState;
  chatMode: ChatMode;
  continuousMode: boolean;
  ritualSuggestion: string | null;
  showCalmOffer: boolean;
  pulseAnim: Animated.Value;
  onTalkPress: () => void;
  onStopConversation: () => void;
  onModeChange: (mode: ChatMode) => void;
  onRitualPress: () => void;
  onDismissCalmOffer: () => void;
}

export function HomeControls({
  appState,
  chatMode,
  continuousMode,
  ritualSuggestion,
  showCalmOffer,
  pulseAnim,
  onTalkPress,
  onStopConversation,
  onModeChange,
  onRitualPress,
  onDismissCalmOffer,
}: HomeControlsProps) {
  const isActive = appState !== "idle";

  const statusColor =
    appState === "listening" ? EtherealColors.primary :
    appState === "speaking"  ? EtherealColors.success  :
    appState === "thinking"  ? EtherealColors.accent    :
    EtherealColors.textMuted;

  const statusText =
    appState === "listening" ? "Listening..." :
    appState === "thinking"  ? "Thinking..."  :
    appState === "speaking"  ? "Speaking..."  :
    "Tap to talk";

  const hintText =
    continuousMode && isActive
      ? "Tap the mic to stop."
      : chatMode === "vent"
        ? "Just listen — no advice given."
        : chatMode === "commute"
          ? "Commute mode on."
          : "One tap for hands-free conversation.";

  // ── Mode animation state ─────────────────────────────────────────
  const [modeSectionWidth, setModeSectionWidth] = useState(0);

  // Sliding pill translateX
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Per-mode icon scale + label opacity
  const iconScales  = useRef(MODES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0.78))).current;
  const labelOpacity = useRef(MODES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0.4))).current;

  const activeIndex = MODES.findIndex(m => m.key === chatMode);

  useEffect(() => {
    const cellWidth = modeSectionWidth / MODES.length;

    // Slide the pill
    Animated.spring(slideAnim, {
      toValue: activeIndex * cellWidth,
      useNativeDriver: true,
      tension: 180,
      friction: 18,
    }).start();

    // Scale + opacity each icon
    MODES.forEach((_, i) => {
      const isNowActive = i === activeIndex;
      Animated.parallel([
        Animated.spring(iconScales[i], {
          toValue: isNowActive ? 1 : 0.78,
          useNativeDriver: true,
          tension: 200,
          friction: 14,
        }),
        Animated.timing(labelOpacity[i], {
          toValue: isNowActive ? 1 : 0.38,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [chatMode, modeSectionWidth]);

  // ── Render ────────────────────────────────────────────────────────
  return (
    <View style={styles.wrapper}>
      {/* Floating offers above the dock */}
      {ritualSuggestion && appState === "idle" && (
        <TouchableOpacity style={styles.ritualPill} onPress={onRitualPress} activeOpacity={0.82}>
          <Text style={styles.ritualEmoji}>
            {ritualSuggestion === "morning_intention" ? "☀️" : "🌟"}
          </Text>
          <Text style={styles.ritualText}>
            {ritualSuggestion === "morning_intention" ? "Morning Intention" : "Night Wind-Down"}
          </Text>
          <Ionicons name="arrow-forward" size={13} color={EtherealColors.primary} />
        </TouchableOpacity>
      )}
      {showCalmOffer && appState === "idle" && (
        <TouchableOpacity style={styles.calmPill} onPress={onDismissCalmOffer} activeOpacity={0.8}>
          <Text style={styles.calmText}>I'm here. No pressure to talk.</Text>
        </TouchableOpacity>
      )}

      {/* Status label */}
      <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>

      {/* ── Dock bar ── */}
      <View style={styles.dock}>

        {/* Left: mic / state button */}
        <View style={styles.micSide}>
          {appState === "idle" && (
            <TouchableOpacity onPress={onTalkPress} activeOpacity={0.8}>
              <View style={[styles.micBtn, styles.micIdle]}>
                <Ionicons name="mic" size={26} color="#fff" />
              </View>
            </TouchableOpacity>
          )}
          {appState === "listening" && (
            <TouchableOpacity onPress={onTalkPress} activeOpacity={0.8}>
              <Animated.View style={[styles.micBtn, styles.micListening, { transform: [{ scale: pulseAnim }] }]}>
                <Ionicons name="stop" size={24} color="#fff" />
              </Animated.View>
            </TouchableOpacity>
          )}
          {appState === "thinking" && (
            <TouchableOpacity onPress={onStopConversation} activeOpacity={0.8}>
              <View style={[styles.micBtn, styles.micThinking]}>
                <Text style={styles.thinkingDots}>···</Text>
              </View>
            </TouchableOpacity>
          )}
          {appState === "speaking" && (
            <TouchableOpacity onPress={onStopConversation} activeOpacity={0.8}>
              <View style={[styles.micBtn, styles.micSpeaking]}>
                <Ionicons name="volume-high" size={24} color="#fff" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Divider */}
        <View style={styles.sep} />

        {/* Right: animated mode buttons */}
        <View
          style={styles.modeSide}
          onLayout={(e) => setModeSectionWidth(e.nativeEvent.layout.width)}
        >
          {/* Sliding background pill */}
          {modeSectionWidth > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.slidingPill,
                {
                  width: modeSectionWidth / MODES.length,
                  transform: [{ translateX: slideAnim }],
                },
              ]}
            />
          )}

          {MODES.map((m, i) => (
            <TouchableOpacity
              key={m.key}
              style={styles.modeBtn}
              onPress={() => onModeChange(m.key)}
              activeOpacity={0.7}
            >
              <Animated.View style={{ transform: [{ scale: iconScales[i] }] }}>
                <Ionicons
                  name={m.icon}
                  size={20}
                  color={m.key === chatMode ? EtherealColors.primary : EtherealColors.textMuted}
                />
              </Animated.View>
              <Animated.Text
                style={[
                  styles.modeLabel,
                  { opacity: labelOpacity[i] },
                  m.key === chatMode && styles.modeLabelActive,
                ]}
              >
                {m.label}
              </Animated.Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Hint below */}
      <Text style={styles.hint}>{hintText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
    alignItems: "center",
  },
  ritualPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: EtherealColors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ritualEmoji: {
    fontSize: 14,
  },
  ritualText: {
    fontSize: 12,
    fontFamily: Fonts.bodyBold,
    color: EtherealColors.primary,
  },
  calmPill: {
    backgroundColor: "rgba(160, 146, 255, 0.1)",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(160, 146, 255, 0.2)",
  },
  calmText: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    color: EtherealColors.primary,
    fontStyle: "italic",
  },
  statusText: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.2,
  },

  // ── Dock ──────────────────────────────────────────────────────
  dock: {
    ...EtherealSurface.cardRaised,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignSelf: "stretch",
  },

  // Left mic section
  micSide: {
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  micIdle: {
    backgroundColor: EtherealColors.primary,
    shadowColor: EtherealColors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 10,
  },
  micListening: {
    backgroundColor: "#f59e0b",
    shadowColor: "#f59e0b",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
  micThinking: {
    backgroundColor: EtherealColors.surfaceStrong,
    borderWidth: 1,
    borderColor: EtherealColors.outline,
  },
  micSpeaking: {
    backgroundColor: EtherealColors.success,
    shadowColor: EtherealColors.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
  thinkingDots: {
    fontSize: 22,
    fontFamily: Fonts.bodyBold,
    color: EtherealColors.textMuted,
    letterSpacing: 3,
    marginTop: -4,
  },

  // Divider
  sep: {
    width: 1,
    height: 40,
    backgroundColor: EtherealColors.outlineSoft,
    marginHorizontal: 8,
  },

  // Right mode section — relative so the sliding pill can be absolute
  modeSide: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 2,
    position: "relative",
  },

  // Sliding background highlight
  slidingPill: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 14,
    backgroundColor: EtherealColors.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(160, 146, 255, 0.25)",
  },

  // Individual mode buttons (equal width via flex)
  modeBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 8,
    borderRadius: 14,
    zIndex: 1,
  },
  modeLabel: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    color: EtherealColors.textMuted,
  },
  modeLabelActive: {
    color: EtherealColors.primary,
    fontFamily: Fonts.bodyBold,
  },

  // Hint below
  hint: {
    textAlign: "center",
    fontSize: 11,
    fontFamily: Fonts.body,
    lineHeight: 16,
    color: EtherealColors.textMuted,
    opacity: 0.7,
  },
});
