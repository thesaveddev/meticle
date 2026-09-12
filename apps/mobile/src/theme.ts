import { StyleSheet, useColorScheme } from 'react-native'

/* ─── Font family constant ─────────────────────────────────── */
export const FONT = 'Inter'

/* ─── Light colors ──────────────────────────────────────────── */
const lightColors = {
  primary: '#1E3A5F',
  primaryLight: '#2E5A8F',
  primarySurface: '#EBF2FA',
  success: '#0F766E',
  successDeep: '#0D5E58',
  successSurface: '#E6F7F5',
  warning: '#B45309',
  warningSurface: '#FEF3C7',
  danger: '#B91C1C',
  dangerDeep: '#991B1B',
  dangerSurface: '#FEE2E2',
  accent: '#6D28D9',
  accentSurface: '#F3EEFF',
  bg: '#F8F7F4',
  surface: '#FFFFFF',
  surfaceAlt: '#FDFCFA',
  border: '#E2DFD9',
  borderLight: '#F0EDE8',
  ink: '#0F172A',
  inkLight: '#334155',
  muted: '#64748B',
  subtle: '#94A3B8',
  inverse: '#FFFFFF',
}

/* ─── Dark colors ───────────────────────────────────────────── */
const darkColors = {
  primary: '#7C9AC7',
  primaryLight: '#93B0D8',
  primarySurface: '#1A2744',
  success: '#5EEAD4',
  successDeep: '#2DD4BF',
  successSurface: '#132E2A',
  warning: '#FCD34D',
  warningSurface: '#3D2E0A',
  danger: '#FCA5A5',
  dangerDeep: '#F87171',
  dangerSurface: '#3D1515',
  accent: '#A78BFA',
  accentSurface: '#1E1538',
  bg: '#0B1120',
  surface: '#131B2E',
  surfaceAlt: '#1A2440',
  border: '#1E2D4A',
  borderLight: '#152038',
  ink: '#F1F5F9',
  inkLight: '#CBD5E1',
  muted: '#94A3B8',
  subtle: '#64748B',
  inverse: '#0B1120',
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
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
} as const

/* ─── Typography ────────────────────────────────────────────── */
export const type = {
  hero: {
    fontFamily: FONT,
    fontSize: 30,
    fontWeight: '800' as const,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: lightColors.ink,
  },
  title: {
    fontFamily: FONT,
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: lightColors.ink,
  },
  bodyBold: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
    color: lightColors.ink,
  },
  body: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: lightColors.inkLight,
  },
  small: {
    fontFamily: FONT,
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    color: lightColors.muted,
  },
  label: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '700' as const,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: lightColors.muted,
  },
  caption: {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    color: lightColors.subtle,
  },
  tab: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '600' as const,
    lineHeight: 14,
    letterSpacing: 0.3,
  },
  stat: {
    fontFamily: FONT,
    fontSize: 28,
    fontWeight: '800' as const,
    lineHeight: 32,
    letterSpacing: -0.6,
  },
  statSmall: {
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 24,
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
    fontFamily: FONT,
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
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '600' as const,
    color: lightColors.inverse,
  },
  divider: {
    height: 1,
    backgroundColor: lightColors.border,
  },
})
