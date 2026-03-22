import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { EtherealColors, EtherealSurface } from "@/constants/ethereal-theme";
import { Fonts } from "@/constants/theme";
import { type Milestone } from "@/contexts/EngagementContext";

const MILESTONE_COPY: Record<string, (v: string) => { title: string; body: string }> = {
  conv: (v) => ({
    title: `${v} Conversations`,
    body: `We've had ${v} conversations together. That's something worth remembering.`,
  }),
  streak: (v) => ({
    title: `${v}-Day Streak`,
    body: `${v} days in a row. You keep showing up. That matters.`,
  }),
  level: (v) => ({
    title: `Level ${v} Reached`,
    body: "Our relationship just deepened. I know you a little better now.",
  }),
};

function getCopy(m: Milestone) {
  const prefix = m.type.split("_")[0];
  const fn = MILESTONE_COPY[prefix];
  if (fn) return fn(m.value);
  return { title: "Milestone Unlocked", body: `You reached ${m.type}!` };
}

interface MilestonePopupProps {
  milestone: Milestone | null;
  onDismiss: () => void;
}

export function MilestonePopup({ milestone, onDismiss }: MilestonePopupProps) {
  const scaleAnim   = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (milestone) {
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
    }
  }, [milestone, scaleAnim, opacityAnim]);

  if (!milestone) return null;
  const copy = getCopy(milestone);

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.overlay}>
        <Animated.View
          style={[styles.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}
        >
          <Text style={styles.star}>✨</Text>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
          <TouchableOpacity style={styles.button} onPress={onDismiss} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  card: {
    ...EtherealSurface.cardRaised,
    borderRadius: 32,
    paddingHorizontal: 28,
    paddingVertical: 36,
    alignItems: "center",
    gap: 14,
    maxWidth: 340,
    width: "100%",
  },
  star: {
    fontSize: 44,
  },
  title: {
    fontSize: 22,
    fontFamily: Fonts.heading,
    color: EtherealColors.textPrimary,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  body: {
    fontSize: 15,
    fontFamily: Fonts.body,
    lineHeight: 22,
    color: EtherealColors.textSecondary,
    textAlign: "center",
  },
  button: {
    marginTop: 8,
    backgroundColor: EtherealColors.primary,
    borderRadius: 999,
    paddingHorizontal: 36,
    paddingVertical: 14,
    shadowColor: EtherealColors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonText: {
    color: "#07060E",
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
  },
});
