import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { EtherealColors, EtherealSurface } from "@/constants/ethereal-theme";
import { Fonts } from "@/constants/theme";

export type ChatMode = "normal" | "vent" | "commute";

interface ModeToggleProps {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
}

const MODES: { key: ChatMode; label: string; icon: string }[] = [
  { key: "normal",  label: "Chat",        icon: "\u{1F4AC}" },
  { key: "vent",    label: "Just Listen", icon: "\u{1F49C}" },
  { key: "commute", label: "Commute",     icon: "\u{1F3A7}" },
];

export function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <View style={styles.row}>
      {MODES.map((m) => {
        const active = m.key === mode;
        return (
          <TouchableOpacity
            key={m.key}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onModeChange(m.key)}
            activeOpacity={0.75}
          >
            <Text style={styles.pillIcon}>{m.icon}</Text>
            <Text style={[styles.pillLabel, active && styles.pillLabelActive]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  pill: {
    ...EtherealSurface.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillActive: {
    backgroundColor: EtherealColors.primarySoft,
    borderColor: "rgba(160, 146, 255, 0.4)",
  },
  pillIcon: {
    fontSize: 13,
  },
  pillLabel: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    color: EtherealColors.textMuted,
  },
  pillLabelActive: {
    color: EtherealColors.primary,
    fontFamily: Fonts.bodyBold,
  },
});
