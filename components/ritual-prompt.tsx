import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthColors, Glass } from "@/constants/theme";

interface RitualPromptProps {
  type: "morning_intention" | "night_reflection";
  onPress: () => void;
}

const COPY = {
  morning_intention: {
    emoji: "\u2600\uFE0F",
    title: "Morning Intention",
    body: "What's the one thing you want to feel good about today?",
  },
  night_reflection: {
    emoji: "\u{1F31F}",
    title: "Night Wind-Down",
    body: "How did today actually go? Take a minute to reflect.",
  },
};

export function RitualPrompt({ type, onPress }: RitualPromptProps) {
  const copy = COPY[type];
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.row}>
        <Text style={styles.emoji}>{copy.emoji}</Text>
        <View style={styles.textCol}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
        </View>
        <Ionicons name="arrow-forward-circle" size={26} color={AuthColors.primary} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    ...Glass.card,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emoji: {
    fontSize: 28,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: AuthColors.textPrimary,
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
    color: AuthColors.textSecondary,
  },
});
