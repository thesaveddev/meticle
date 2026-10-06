import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { StyleSheet, useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

/* ─── Font family constant ─────────────────────────────────── */
export const FONT = 'Inter'
const THEME_KEY = 'app_theme_mode'

/* ─── Light colors ──────────────────────────────────────────── */
export const CHART_PALETTE = [
  '#2F80ED',
  '#10BFA5',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B7CF6',
  '#6B8AFD',
  '#94A3B8',
] as const

export const lightColors = {
  primary: '#2F80ED',
  primaryLight: '#2674D9',
  primarySurface: '#EAF3FF',
  success: '#10B981',
  successDeep: '#087A55',
  successSurface: '#EAFBF5',
  successSoft: '#EAFBF5',
  successText: '#087A55',
  warningSoft: '#FFF7E6',
  warningText: '#9A6700',
  dangerSoft: '#FEF0F0',
  dangerText: '#B42318',
  surfaceHover: '#F5F7FA',
  textMuted: '#667085',
  textSecondary: '#98A2B3',
  background: '#F7F9FC',
  warning: '#F59E0B',
  warningSurface: '#FFF7E6',
  danger: '#EF4444',
  dangerDeep: '#B42318',
  dangerSurface: '#FEF0F0',
  accent: '#10BFA5',
  accentSurface: '#E8FAF6',
  info: '#2F80ED',
  infoSurface: '#EAF3FF',
  bg: '#F7F9FC',
  surface: '#FFFFFF',
  surfaceAlt: '#FBFCFE',
  border: '#E6EAF0',
  borderLight: '#E6EAF0',
  ink: '#17202A',
  inkLight: '#344054',
  muted: '#667085',
  subtle: '#98A2B3',
  inverse: '#FFFFFF',
  text: '#17202A',
  dark: '#0F172A',
}

/* ─── Dark colors ───────────────────────────────────────────── */
export const darkColors = {
  primary: '#94A3B8',
  primaryLight: '#CBD5E1',
  primarySurface: '#1E293B',
  success: '#34D399',
  successDeep: '#10B981',
  successSurface: '#064E3B',
  warning: '#FBBF24',
  warningSurface: '#9A6700',
  danger: '#F87171',
  dangerDeep: '#EF4444',
  dangerSurface: '#B42318',
  accent: '#34D399',
  accentSurface: '#064E3B',
  info: '#22D3EE',
  infoSurface: '#164E63',
  bg: '#0F172A',
  surface: '#1E293B',
  surfaceAlt: '#334155',
  border: '#334155',
  borderLight: '#1E293B',
  ink: '#F5F7FA',
  inkLight: '#CBD5E1',
  muted: '#94A3B8',
  subtle: '#667085',
  inverse: '#0F172A',
  text: '#F5F7FA',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  surfaceHover: '#334155',
  successSoft: '#064E3B',
  successText: '#34D399',
  warningSoft: '#9A6700',
  warningText: '#FBBF24',
  dangerSoft: '#B42318',
  dangerText: '#F87171',
  background: '#0F172A',
  dark: '#0F172A',
}

export type AppColors = typeof lightColors

/* ─── Theme context ─────────────────────────────────────────── */
type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  mode: ThemeMode
  scheme: 'light' | 'dark'
  colors: AppColors
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  scheme: 'light',
  colors: lightColors,
  setMode: () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

/* Convenience hook — returns current colors */
export function useAppColors(): AppColors {
  return useTheme().colors
}

/* ─── Provider ──────────────────────────────────────────────── */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>('system')

  // Load persisted preference
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(v => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v)
    })
  }, [])

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    AsyncStorage.setItem(THEME_KEY, m)
  }, [])

  const scheme = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode
  const colors = scheme === 'dark' ? darkColors : lightColors

  return (
    <ThemeContext.Provider value={{ mode, scheme, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

/* ─── Static default (light) for backward compat ────────────── */
export const colors = lightColors

/* ─── Mica identity colors (expressive accent, isolated to Mica) ── */
export const mica = {
  blue: '#2F80ED',
  surfaceStrong: '#2A6EE0',
  surface: '#EAF3FF',
  blueDark: '#1F5FC4',
  violet: '#8B7CF6',
  green: '#10B981',
  ink: '#17202A',
} as const

export interface MicaColorSet {
  readonly blue: string
  readonly surfaceStrong: string
  readonly surface: string
  readonly blueDark: string
  readonly violet: string
  readonly green: string
  readonly ink: string
}

export const micaGradientStops = ['#2F80ED', '#8B7CF6', '#10B981'] as const

export const shadows = StyleSheet.create({
  sm: {
    shadowColor: '#17202A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  md: {
    shadowColor: '#17202A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  lg: {
    shadowColor: '#17202A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
})

export const mcType = {
  pageTitle: {
    fontFamily: FONT,
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  body: {
    fontFamily: FONT,
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  label: {
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: '700' as const,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
} as const

/* ─── Spacing (4pt base) ───────────────────────────────────── */
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
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  full: 999,
} as const

/* ─── Elevation ─────────────────────────────────────────────── */
export const elevation = {
  none: { shadowOpacity: 0 },
  sm: {
    shadowColor: '#17202A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  md: {
    shadowColor: '#17202A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  lg: {
    shadowColor: '#17202A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
} as const

/* ─── Typography (static — uses light colors by default) ────── */
export const typography = {
  hero: {
    fontFamily: FONT,
    fontSize: 32,
    fontWeight: '800' as const,
    lineHeight: 38,
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
    ...elevation.sm,
  },
  field: {
    minHeight: 50,
    borderWidth: 1,
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
    backgroundColor: lightColors.borderLight,
  },
})
