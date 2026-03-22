import type { ViewStyle } from 'react-native';

export const EtherealColors = {
  background: '#0f0d12',
  backgroundRaised: '#18141f',
  surface: 'rgba(26, 25, 30, 0.86)',
  surfaceStrong: 'rgba(33, 31, 37, 0.94)',
  surfaceRaised: 'rgba(39, 37, 43, 0.98)',
  surfaceSoft: 'rgba(20, 19, 24, 0.92)',
  outline: 'rgba(119, 116, 122, 0.36)',
  outlineSoft: 'rgba(174, 170, 176, 0.18)',
  textPrimary: '#fdf7fe',
  textSecondary: '#c4becc',
  textMuted: '#918a99',
  primary: '#a092ff',
  primaryStrong: '#8e7dff',
  primarySoft: 'rgba(160, 146, 255, 0.18)',
  accent: '#fec16e',
  accentSoft: 'rgba(254, 193, 110, 0.16)',
  success: '#7dd3a8',
  error: '#ff8ea3',
  errorBackground: 'rgba(167, 1, 56, 0.28)',
  inputBackground: 'rgba(20, 19, 24, 0.94)',
  inputBorder: 'rgba(73, 71, 76, 0.82)',
  shadow: '#000000',
} as const;

export const EtherealSurface: Record<string, ViewStyle> = {
  card: {
    backgroundColor: EtherealColors.surface,
    borderWidth: 1,
    borderColor: EtherealColors.outlineSoft,
    shadowColor: EtherealColors.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.38,
    shadowRadius: 32,
    elevation: 18,
  },
  cardRaised: {
    backgroundColor: EtherealColors.surfaceStrong,
    borderWidth: 1,
    borderColor: EtherealColors.outline,
    shadowColor: EtherealColors.shadow,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.42,
    shadowRadius: 34,
    elevation: 20,
  },
  pill: {
    backgroundColor: 'rgba(253, 247, 254, 0.06)',
    borderWidth: 1,
    borderColor: EtherealColors.outlineSoft,
  },
  input: {
    backgroundColor: EtherealColors.inputBackground,
    borderWidth: 1,
    borderColor: EtherealColors.inputBorder,
  },
};
