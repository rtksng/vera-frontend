import React, { useCallback, useRef, useState } from "react";
import {
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/expo";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Sharing from "expo-sharing";
import ViewShot from "react-native-view-shot";
import { EtherealBackdrop } from "@/components/ethereal-screen";
import { EtherealColors } from "@/constants/ethereal-theme";
import { Fonts } from "@/constants/theme";
import { postJson } from "@/lib/api";

const BG = "#07060E";

const CARD_STYLES = [
  { id: "gradient_1", colors: ["#667eea", "#764ba2"], text: "#fff" },
  { id: "gradient_2", colors: ["#f093fb", "#f5576c"], text: "#fff" },
  { id: "gradient_3", colors: ["#4facfe", "#00f2fe"], text: "#fff" },
  { id: "gradient_4", colors: ["#43e97b", "#38f9d7"], text: "#1a1a2e" },
  { id: "minimal",    colors: ["#1e1b2e", "#2d2b3d"], text: "#fdf7fe" },
];

export default function ShareScreen() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [quote, setQuote] = useState("");
  const [selectedStyle, setSelectedStyle] = useState(CARD_STYLES[0]);
  const [saved, setSaved] = useState(false);
  const viewShotRef = useRef<ViewShot>(null);

  const getHeaders = useCallback(async () => {
    try {
      const token = await getToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch { return {}; }
  }, [getToken]);

  const handleSave = async () => {
    try {
      const headers = await getHeaders();
      await postJson("/share/card", { quote_text: quote, card_style: selectedStyle.id }, headers);
      setSaved(true);
    } catch (e) {
      console.error("Save card error:", e);
    }
  };

  const handleShare = async () => {
    try {
      if (!viewShotRef.current?.capture) return;
      const uri = await viewShotRef.current.capture();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }
    } catch (e) {
      console.error("Share error:", e);
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
            <Text style={styles.headerEyebrow}>Memory</Text>
            <Text style={styles.headerTitle}>Share a Moment</Text>
          </View>
        </View>

        {/* Card preview */}
        <ViewShot ref={viewShotRef} options={{ format: "png", quality: 1 }} style={styles.cardPreview}>
          <View style={[styles.card, { backgroundColor: selectedStyle.colors[0] }]}>
            <Text style={[styles.cardQuote, { color: selectedStyle.text }]}>
              {quote || "Type a moment worth sharing..."}
            </Text>
            <Text style={[styles.cardAttrib, { color: selectedStyle.text, opacity: 0.65 }]}>
              — my AI said this to me today
            </Text>
          </View>
        </ViewShot>

        {/* Text input */}
        <TextInput
          style={styles.input}
          value={quote}
          onChangeText={setQuote}
          placeholder="Paste or type a conversation moment..."
          placeholderTextColor={EtherealColors.textMuted}
          multiline
          maxLength={280}
          keyboardAppearance="dark"
        />

        {/* Style swatches */}
        <View style={styles.styleRow}>
          {CARD_STYLES.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.swatch,
                { backgroundColor: s.colors[0] },
                s.id === selectedStyle.id && styles.swatchActive,
              ]}
              onPress={() => setSelectedStyle(s)}
            />
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, !quote && styles.actionBtnDisabled]}
            onPress={handleSave}
            disabled={!quote}
            activeOpacity={0.8}
          >
            <Ionicons name="bookmark-outline" size={18} color="#07060E" />
            <Text style={styles.actionBtnText}>{saved ? "Saved!" : "Save"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.shareBtn, !quote && styles.actionBtnDisabled]}
            onPress={handleShare}
            disabled={!quote}
            activeOpacity={0.8}
          >
            <Ionicons name="share-outline" size={18} color={EtherealColors.primary} />
            <Text style={[styles.actionBtnText, { color: EtherealColors.primary }]}>Share</Text>
          </TouchableOpacity>
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
    paddingBottom: 24,
    gap: 16,
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
  cardPreview: {
    borderRadius: 24,
    overflow: "hidden",
  },
  card: {
    padding: 32,
    borderRadius: 24,
    minHeight: 180,
    justifyContent: "center",
    gap: 12,
  },
  cardQuote: {
    fontSize: 19,
    fontFamily: Fonts.headingSoft,
    lineHeight: 28,
    textAlign: "center",
  },
  cardAttrib: {
    fontSize: 12,
    fontFamily: Fonts.bodyMedium,
    textAlign: "center",
    fontStyle: "italic",
  },
  input: {
    backgroundColor: EtherealColors.inputBackground,
    borderWidth: 1,
    borderColor: EtherealColors.inputBorder,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: Fonts.body,
    color: EtherealColors.textPrimary,
    minHeight: 90,
    textAlignVertical: "top" as const,
  },
  styleRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchActive: {
    borderColor: EtherealColors.primary,
    borderWidth: 3,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: EtherealColors.primary,
    borderRadius: 999,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    shadowColor: EtherealColors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  actionBtnDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
    elevation: 0,
  },
  shareBtn: {
    backgroundColor: EtherealColors.primarySoft,
    borderWidth: 1,
    borderColor: "rgba(160, 146, 255, 0.3)",
    shadowOpacity: 0,
    elevation: 0,
  },
  actionBtnText: {
    color: "#07060E",
    fontFamily: Fonts.bodyBold,
    fontSize: 15,
  },
});
