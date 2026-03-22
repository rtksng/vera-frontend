import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Href, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { EtherealColors } from '@/constants/ethereal-theme';
import { Fonts } from '@/constants/theme';

function pingPong(val: Animated.Value, lo: number, hi: number, dur: number) {
  // Start at lo so each loop iteration ends at lo — seamless, no jump
  val.setValue(lo);
  return Animated.loop(
    Animated.sequence([
      Animated.timing(val, { toValue: hi, duration: dur / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(val, { toValue: lo, duration: dur / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])
  );
}

function useAuroraAnim(
  xAmp: number, xDur: number,
  yAmp: number, yDur: number,
  opacityLo: number, opacityHi: number, opacityDur: number,
  scaleLo: number, scaleHi: number, scaleDur: number,
  delay = 0,
) {
  const translateX = useRef(new Animated.Value(-xAmp)).current;
  const translateY = useRef(new Animated.Value(-yAmp)).current;
  const opacity    = useRef(new Animated.Value(opacityLo)).current;
  const scale      = useRef(new Animated.Value(scaleLo)).current;

  useEffect(() => {
    const anims = [
      pingPong(translateX, -xAmp,      xAmp,      xDur),
      pingPong(translateY, -yAmp,      yAmp,      yDur),
      pingPong(opacity,    opacityLo,  opacityHi, opacityDur),
      pingPong(scale,      scaleLo,    scaleHi,   scaleDur),
    ];

    const timeout = setTimeout(() => anims.forEach(a => a.start()), delay);
    return () => {
      clearTimeout(timeout);
      anims.forEach(a => a.stop());
    };
  }, []);

  return { translateX, translateY, opacity, scale };
}

const BG = '#07060E';

export function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const teal   = useAuroraAnim(24, 8200,  18, 7100,  0.20, 0.38, 9400,  0.93, 1.07, 11000, 0);
  const violet = useAuroraAnim(20, 9600,  22, 8300,  0.22, 0.40, 8000,  0.90, 1.10, 12500, 800);
  const purple = useAuroraAnim(16, 11000, 14, 9800,  0.16, 0.30, 10500, 0.95, 1.05, 9800,  400);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />

      {/* ── Aurora background ── */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {/* teal aurora — top-left */}
        <Animated.View style={[
          styles.auroraTeal,
          { opacity: teal.opacity, transform: [{ translateX: teal.translateX }, { translateY: teal.translateY }, { scale: teal.scale }] },
        ]} />
        {/* violet aurora — top-right */}
        <Animated.View style={[
          styles.auroraViolet,
          { opacity: violet.opacity, transform: [{ translateX: violet.translateX }, { translateY: violet.translateY }, { scale: violet.scale }] },
        ]} />
        {/* deep purple bloom — top-center */}
        <Animated.View style={[
          styles.auroraPurple,
          { opacity: purple.opacity, transform: [{ translateX: purple.translateX }, { translateY: purple.translateY }, { scale: purple.scale }] },
        ]} />
        {/* dark fade at the bottom */}
        <View style={styles.bottomFade} />
      </View>

      {/* ── Brand name bar ── */}
      <View style={styles.topBar}>
        <Text style={styles.brandName}>VERA</Text>
      </View>

      {/* ── Editorial headline (fills available space) ── */}
      <View style={styles.heroSection}>
        {/* Line: "Someone" */}
        <Text style={styles.word}>Someone who always remembers you</Text>

        {/* Line: "who" + large color pill */}
       
      </View>

      {/* ── Single CTA ── */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 8, 28) }]}>
        <Pressable
          style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaPressed]}
          onPress={() => router.push({ pathname: '/(auth)/auth', params: { tab: 'sign-up' } } as Href)}
        >
          <Text style={styles.ctaText}>Meet Vera</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.signInButton, pressed && { opacity: 0.6 }]}
          onPress={() => router.push({ pathname: '/(auth)/auth', params: { tab: 'sign-in' } } as Href)}
        >
          <Text style={styles.signInText}>I already have an account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },

  // ── Background ───────────────────────────────────────────
  auroraTeal: {
    position: 'absolute',
    width: 380,
    height: 460,
    borderRadius: 999,
    top: -180,
    left: -100,
    backgroundColor: 'rgba(14, 148, 166, 0.85)',
    filter: [{ blur: 40 }],
  },
  auroraViolet: {
    position: 'absolute',
    width: 340,
    height: 400,
    borderRadius: 999,
    top: -140,
    right: -80,
    backgroundColor: 'rgba(109, 40, 217, 0.9)',
    filter: [{ blur: 40 }],
  },
  auroraPurple: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 999,
    top: -60,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -150,
    backgroundColor: 'rgba(88, 28, 220, 0.75)',
    filter: [{ blur: 40 }],
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    backgroundColor: 'rgba(7, 6, 14, 0.88)',
    filter: [{ blur: 40 }],
  },

  // ── Top bar ──────────────────────────────────────────────
  topBar: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 4,
  },
  brandName: {
    color: EtherealColors.textPrimary,
    fontSize: 16,
    fontFamily: Fonts.bodyBold,
    letterSpacing: 20.5,
    opacity: 0.9,
  },

  // ── Hero headline ────────────────────────────────────────
  heroSection: {

    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    gap: 2,
    paddingBottom: 24,
    alignItems: 'center',
  },
  word: {
    color: EtherealColors.textPrimary,
    fontSize: 58,
    fontFamily: Fonts.heading,
    lineHeight: 68,
    letterSpacing: -1,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexWrap: 'nowrap',
  },
  chipRow: {
    flexDirection: 'row',
  },

  // "remembers" highlight chip
  highlightChip: {
    backgroundColor: 'rgba(30, 27, 44, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(160, 146, 255, 0.22)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 0,
    overflow: 'hidden',
  },
  wordInChip: {
    paddingVertical: 0,
  },

  // Large pill (after "who")
  largePill: {
    width: 120,
    height: 60,
    borderRadius: 99,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  largePillBase: {
    borderRadius: 99,
    backgroundColor: '#5b21b6',
  },
  largePillBloom: {
    borderRadius: 99,
    backgroundColor: '#be185d',
    opacity: 0.5,
    transform: [{ translateX: 32 }],
  },

  // Small pill (after "you.")
  smallPill: {
    width: 68,
    height: 50,
    borderRadius: 99,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallPillBase: {
    borderRadius: 99,
    backgroundColor: '#92400e',
  },
  smallPillBloom: {
    borderRadius: 99,
    backgroundColor: '#d97706',
    opacity: 0.55,
    transform: [{ translateX: 14 }],
  },

  // Shared pill shine
  pillShine: {
    position: 'absolute',
    top: 8,
    left: 12,
    width: 30,
    height: 10,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.22)',
    transform: [{ rotate: '-15deg' }],
  },

  // ── Footer CTA ───────────────────────────────────────────
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    gap: 10,
  },
  ctaButton: {
    backgroundColor: EtherealColors.textPrimary,
    borderRadius: 999,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 14,
  },
  ctaText: {
    color: '#07060E',
    fontSize: 16,
    fontFamily: Fonts.bodyBold,
    letterSpacing: 0.3,
  },
  ctaPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  signInButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  signInText: {
    color: EtherealColors.textMuted,
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
  },
});
