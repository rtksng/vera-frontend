const tintColorLight = '#2563eb';
const tintColorDark = '#93c5fd';

export const AppTheme = {
  primary: '#2563eb',
  primaryStrong: '#1d4ed8',
  primarySoft: '#dbeafe',
  primaryGlow: '#bfdbfe',
  background: '#f4f7fb',
  backgroundSecondary: '#eef3f9',
  backgroundTertiary: '#e2e8f0',
  surface: 'rgba(255, 255, 255, 0.72)',
  surfaceStrong: 'rgba(255, 255, 255, 0.9)',
  surfaceMuted: 'rgba(248, 250, 252, 0.82)',
  glassBorder: 'rgba(255, 255, 255, 0.84)',
  outline: 'rgba(148, 163, 184, 0.22)',
  divider: 'rgba(148, 163, 184, 0.18)',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  placeholder: '#94a3b8',
  inputBackground: 'rgba(255, 255, 255, 0.74)',
  inputBorder: 'rgba(148, 163, 184, 0.22)',
  inputText: '#0f172a',
  shadow: '#94a3b8',
  shadowStrong: '#64748b',
  error: '#dc2626',
  errorLight: '#b91c1c',
  errorBackground: 'rgba(254, 226, 226, 0.92)',
  success: '#059669',
  successBackground: 'rgba(220, 252, 231, 0.92)',
  warning: '#d97706',
  overlay: 'rgba(15, 23, 42, 0.06)',
  online: '#10b981',
  buttonDisabledOpacity: 0.55,
};

export const AuthColors = AppTheme;

export const Glass = {
  card: {
    backgroundColor: AppTheme.surface,
    borderWidth: 1,
    borderColor: AppTheme.glassBorder,
    shadowColor: AppTheme.shadow,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
  },
  cardStrong: {
    backgroundColor: AppTheme.surfaceStrong,
    borderWidth: 1,
    borderColor: AppTheme.glassBorder,
    shadowColor: AppTheme.shadowStrong,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  floating: {
    backgroundColor: AppTheme.surfaceStrong,
    borderWidth: 1,
    borderColor: AppTheme.glassBorder,
    shadowColor: AppTheme.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 6,
  },
  pill: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: AppTheme.glassBorder,
  },
  input: {
    backgroundColor: AppTheme.inputBackground,
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
  },
};

export const Colors = {
  light: {
    text: AppTheme.textPrimary,
    background: AppTheme.background,
    tint: tintColorLight,
    icon: AppTheme.textMuted,
    tabIconDefault: AppTheme.textMuted,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#e2e8f0',
    background: '#0f172a',
    tint: tintColorDark,
    icon: '#94a3b8',
    tabIconDefault: '#94a3b8',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = {
  heading: 'CormorantGaramond_700Bold',
  headingSoft: 'CormorantGaramond_600SemiBold',
  body: 'Outfit_400Regular',
  bodyMedium: 'Outfit_500Medium',
  bodySemiBold: 'Outfit_600SemiBold',
  bodyBold: 'Outfit_700Bold',
  mono: 'monospace',
} as const;
