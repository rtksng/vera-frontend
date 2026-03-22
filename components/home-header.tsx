import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EtherealColors, EtherealSurface } from "@/constants/ethereal-theme";
import { Fonts } from "@/constants/theme";

export interface EmotionStyle {
  color: string;
  emoji: string;
  label: string;
}

interface HomeHeaderProps {
  greeting: string;
  level: number;
  xpProgressPct: number;
  moodLabel: string;
  moodDotColor: string;
  emotion: string;
  emotionStyle: EmotionStyle;
  onSettingsPress: () => void;
}

export function HomeHeader({
  greeting,
  level,
  xpProgressPct,
  moodLabel,
  moodDotColor,
  emotion,
  emotionStyle,
  onSettingsPress,
}: HomeHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <View style={styles.inner}>
          <View style={styles.left}>
            <Text style={styles.eyebrow}>{greeting}</Text>
            <Text style={styles.title}>Vera</Text>
          </View>
          <View style={styles.right}>
            {/* <View style={styles.moodPill}>
              <View style={[styles.dot, { backgroundColor: moodDotColor }]} />
              <Text style={styles.moodText}>{moodLabel}</Text>
            </View>
            {emotion !== "neutral" && (
              <View style={[styles.emotionPill, { borderColor: emotionStyle.color + "66" }]}>
                <Text style={styles.pillEmoji}>{emotionStyle.emoji}</Text>
                <Text style={[styles.pillLabel, { color: emotionStyle.color }]}>
                  {emotionStyle.label}
                </Text>
              </View>
            )} */}
            {level > 1 && (
              <View style={styles.levelRow}>
                <Text style={styles.levelText}>Lv.{level}</Text>
                <View style={styles.xpBg}>
                  <View style={[styles.xpFill, { width: `${xpProgressPct}%` as `${number}%` }]} />
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.settingsBtn} onPress={onSettingsPress} activeOpacity={0.75}>
        <Ionicons name="settings-outline" size={20} color={EtherealColors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  card: {
    ...EtherealSurface.cardRaised,
    flex: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  left: {
    gap: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: Fonts.bodyBold,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: EtherealColors.primary,
  },
  title: {
    fontSize: 26,
    fontFamily: Fonts.heading,
    letterSpacing: 0.2,
    color: EtherealColors.textPrimary,
  },
  right: {
    alignItems: "flex-end",
    gap: 5,
  },
  moodPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    ...EtherealSurface.pill,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  moodText: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    color: EtherealColors.textSecondary,
  },
  emotionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(253, 247, 254, 0.06)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  pillEmoji: {
    fontSize: 11,
  },
  pillLabel: {
    fontSize: 11,
    fontFamily: Fonts.bodyBold,
  },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  levelText: {
    fontSize: 10,
    fontFamily: Fonts.bodyBold,
    color: EtherealColors.primary,
  },
  xpBg: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: EtherealColors.primarySoft,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: EtherealColors.primary,
  },
  settingsBtn: {
    backgroundColor: EtherealColors.surfaceStrong,
    borderWidth: 1,
    borderColor: EtherealColors.outline,
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
});
