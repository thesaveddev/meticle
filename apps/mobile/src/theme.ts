import { StyleSheet, useColorScheme } from 'react-native'

/* ─── Light colors ──────────────────────────────────────────── */
const lightColors = {
  primary: '#2D3A8C',
  primaryLight: '#4A5AC7',
  primarySurface: '#EEF0FA',
  success: '#16A34A',
  successDeep: '#15803D',
  successSurface: '#DCFCE7',
  warning: '#D97706',
  warningSurface: '#FEF3C7',
  danger: '#DC2626',
  dangerDeep: '#B91C1C',
  dangerSurface: '#FEE2E2',
  accent: '#0D9488',
  accentSurface: '#CCFBF1',
  bg: '#F5F2ED',
  surface: '#FFFFFF',
  surfaceAlt: '#FAF8F5',
  border: '#E5E0D8',
  borderLight: '#F0ECE6',
  ink: '#1C1917',
  inkLight: '#44403C',
  muted: '#78716C',
  subtle: '#A8A29E',
  inverse: '#FFFFFF',
}

/* ─── Dark colors ───────────────────────────────────────────── */
const darkColors = {
  primary: '#7C8AF0',
  primaryLight: '#9AA5F5',
  primarySurface: '#1E2340',
  success: '#4ADE80',
  successDeep: '#22C55E',
  successSurface: '#14352A',
  warning: '#FBBF24',
  warningSurface: '#3D2E0A',
  danger: '#F87171',
  dangerDeep: '#EF4444',
  dangerSurface: '#3D1515',
  accent: '#2DD4BF',
  accentSurface: '#0F2E2B',
  bg: '#0F0F14',
  surface: '#1A1A22',
  surfaceAlt: '#222230',
  border: '#2A2A36',
  borderLight: '#1F1F2A',
  ink: '#F5F5F4',
  inkLight: '#D6D3D1',
  muted: '#A8A29E',
  subtle: '#78716C',
  inverse: '#0F0F14',
}

export type AppColors = typeof lightColors

/* ─── Get colors by scheme ──────────────────────────────────── */
export function getColors(scheme: 'light' | 'dark' = 'light'): AppColors {
  return scheme === 'dark' ? darkColors : lightColors
}

/* ─── Default to light for backward compat ──────────────────── */
export const colors = lightColors

/* ─── Hook: provides colors based on current scheme ─────────── */
export function useColors(): AppColors {
  const scheme = useColorScheme()
  return scheme === 'dark' ? darkColors : lightColors
}

/* ─── Spacing (8pt base) ───────────────────────────────────── */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const

/* ─── Radii ─────────────────────────────────────────────────── */
export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const

/* ─── Elevation ─────────────────────────────────────────────── */
export const elevation = {
  none: { shadowOpacity: 0 },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
} as const

/* ─── Typography ────────────────────────────────────────────── */
export const type = {
  hero: {
    fontFamily: 'System',
    fontSize: 28,
    fontWeight: '800' as const,
    lineHeight: 34,
    letterSpacing: -0.6,
    color: lightColors.ink,
  },
  title: {
    fontFamily: 'System',
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: lightColors.ink,
  },
  bodyBold: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
    color: lightColors.ink,
  },
  body: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: lightColors.inkLight,
  },
  small: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    color: lightColors.muted,
  },
  label: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
    color: lightColors.muted,
  },
  caption: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    color: lightColors.subtle,
  },
  tab: {
    fontFamily: 'System',
    fontSize: 10,
    fontWeight: '500' as const,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  stat: {
    fontFamily: 'System',
    fontSize: 24,
    fontWeight: '800' as const,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  statSmall: {
    fontFamily: 'System',
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
} as const

/* ─── Shared styles (light defaults) ────────────────────────── */
export const commonStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: lightColors.bg },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  card: {
    backgroundColor: lightColors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: lightColors.borderLight,
    ...elevation.sm,
  },
  field: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: lightColors.border,
    borderRadius: radii.md,
    backgroundColor: lightColors.surface,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    color: lightColors.ink,
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '400' as const,
  },
  button: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.lg,
  },
  buttonLabel: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '600' as const,
    color: lightColors.inverse,
  },
  divider: {
    height: 1,
    backgroundColor: lightColors.border,
  },
})
