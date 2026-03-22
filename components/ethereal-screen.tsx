import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { EtherealColors } from '@/constants/ethereal-theme';

const BG = '#07060E';

function pingPong(val: Animated.Value, lo: number, hi: number, dur: number) {
  val.setValue(lo);
  return Animated.loop(
    Animated.sequence([
      Animated.timing(val, { toValue: hi, duration: dur / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(val, { toValue: lo, duration: dur / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])
  );
}

function useOrbAnim(
  xAmp: number, xDur: number,
  yAmp: number, yDur: number,
  opLo: number, opHi: number, opDur: number,
  delay = 0,
) {
  const tx = useRef(new Animated.Value(-xAmp)).current;
  const ty = useRef(new Animated.Value(-yAmp)).current;
  const op = useRef(new Animated.Value(opLo)).current;

  useEffect(() => {
    const anims = [
      pingPong(tx, -xAmp, xAmp, xDur),
      pingPong(ty, -yAmp, yAmp, yDur),
      pingPong(op, opLo, opHi, opDur),
    ];
    const t = setTimeout(() => anims.forEach(a => a.start()), delay);
    return () => { clearTimeout(t); anims.forEach(a => a.stop()); };
  }, []);

  return { tx, ty, op };
}

type EtherealScreenProps = {
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function EtherealBackdrop() {
  const primary = useOrbAnim(22, 9200,  18, 8100,  0.20, 0.36, 10400, 0);
  const accent  = useOrbAnim(18, 11000, 20, 9600,  0.14, 0.28, 8800,  700);
  const halo    = useOrbAnim(14, 12500, 16, 10200, 0.28, 0.44, 9200,  350);

  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <Animated.View style={[
        styles.orb, styles.orbPrimary,
        { opacity: primary.op, transform: [{ translateX: primary.tx }, { translateY: primary.ty }] },
      ]} />
      <Animated.View style={[
        styles.orb, styles.orbAccent,
        { opacity: accent.op, transform: [{ translateX: accent.tx }, { translateY: accent.ty }] },
      ]} />
      <Animated.View style={[
        styles.orb, styles.orbHalo,
        { opacity: halo.op, transform: [{ translateX: halo.tx }, { translateY: halo.ty }] },
      ]} />
      <View style={styles.vignette} />
    </View>
  );
}

export function EtherealScreen({ children, contentContainerStyle }: EtherealScreenProps) {
  const insets = useSafeAreaInsets();

  const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : 'height';
  const keyboardOffset =
    Platform.OS === 'ios' ? insets.top : Math.max(insets.top, StatusBar.currentHeight ?? 0);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <EtherealBackdrop />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={keyboardBehavior}
        keyboardVerticalOffset={keyboardOffset}
      >
        <ScrollView
          contentContainerStyle={[styles.content, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 32,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: BG,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbPrimary: {
    width: 360,
    height: 360,
    right: -120,
    top: -80,
    backgroundColor: 'rgba(109, 40, 217, 0.9)',
    filter: [{ blur: 50 }],
  },
  orbAccent: {
    width: 280,
    height: 280,
    left: -100,
    top: 100,
    backgroundColor: 'rgba(14, 148, 166, 0.85)',
    filter: [{ blur: 45 }],
  },
  orbHalo: {
    width: 400,
    height: 400,
    left: 20,
    bottom: -300,
    backgroundColor: 'rgba(88, 28, 220, 0.75)',
    filter: [{ blur: 55 }],
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 6, 14, 0.52)',
  },
});
