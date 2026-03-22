import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { AppTheme } from "@/constants/theme";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "late_night";

const PALETTES: Record<TimeOfDay, {
  bg: string; orb1: string; orb1Opacity: number;
  orb2: string; orb2Opacity: number;
  orb3: string; orb3Opacity: number;
  haze: string;
}> = {
  morning: {
    bg: "#fef9ef",
    orb1: "#fbbf24", orb1Opacity: 0.45,
    orb2: "#fdba74", orb2Opacity: 0.3,
    orb3: "#bfdbfe", orb3Opacity: 0.35,
    haze: "rgba(255, 251, 235, 0.36)",
  },
  afternoon: {
    bg: AppTheme.background,
    orb1: AppTheme.primaryGlow, orb1Opacity: 0.7,
    orb2: "#fde68a", orb2Opacity: 0.25,
    orb3: "#dbeafe", orb3Opacity: 0.4,
    haze: "rgba(255, 255, 255, 0.34)",
  },
  evening: {
    bg: "#f5f0eb",
    orb1: "#f59e0b", orb1Opacity: 0.35,
    orb2: "#e9d5ff", orb2Opacity: 0.3,
    orb3: "#c4b5fd", orb3Opacity: 0.25,
    haze: "rgba(245, 240, 235, 0.4)",
  },
  late_night: {
    bg: "#1e1b4b",
    orb1: "#6366f1", orb1Opacity: 0.25,
    orb2: "#4338ca", orb2Opacity: 0.2,
    orb3: "#312e81", orb3Opacity: 0.3,
    haze: "rgba(30, 27, 75, 0.5)",
  },
};

interface AmbientBackgroundProps {
  timeOfDay?: TimeOfDay;
}

export function AmbientBackground({ timeOfDay = "afternoon" }: AmbientBackgroundProps) {
  const p = PALETTES[timeOfDay] || PALETTES.afternoon;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
  }, [timeOfDay, fadeAnim]);

  return (
    <Animated.View pointerEvents="none" style={[styles.container, { backgroundColor: p.bg, opacity: fadeAnim }]}>
      <View style={[styles.orb, styles.orbPrimary, { backgroundColor: p.orb1, opacity: p.orb1Opacity }]} />
      <View style={[styles.orb, styles.orbSecondary, { backgroundColor: p.orb2, opacity: p.orb2Opacity }]} />
      <View style={[styles.orb, styles.orbNeutral, { backgroundColor: p.orb3, opacity: p.orb3Opacity }]} />
      <View style={[styles.haze, { backgroundColor: p.haze }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    borderRadius: 999,
  },
  orbPrimary: {
    top: -80,
    right: -40,
    width: 240,
    height: 240,
  },
  orbSecondary: {
    top: 180,
    left: -90,
    width: 220,
    height: 220,
  },
  orbNeutral: {
    bottom: -120,
    right: -60,
    width: 260,
    height: 260,
  },
  haze: {
    ...StyleSheet.absoluteFillObject,
  },
});
