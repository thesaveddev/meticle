import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { StyleSheet, useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

/* ─── Font family constant ─────────────────────────────────── */
export const FONT = 'Inter'
const THEME_KEY = 'app_theme_mode'

/* ─── Light colors ──────────────────────────────────────────── */
export const lightColors = {
  primary: '#1A2332',
  primaryLight: '#2D3F54',
  primarySurface: '#EDF2F7',
  success: '#10B981',
  successDeep: '#059669',
  successSurface: '#ECFDF5',
  warning: '#D97706',
  warningSurface: '#FFFBEB',
  danger: '#DC2626',
  dangerDeep: '#B91C1C',
  dangerSurface: '#FEF2F2',
  accent: '#10B981',
  accentSurface: '#ECFDF5',
  bg: '#F7F9F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F9FAFB',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  ink: '#1A2332',
  inkLight: '#374151',
  muted: '#6B7280',
  subtle: '#9CA3AF',
  inverse: '#FFFFFF',
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
  warningSurface: '#78350F',
  danger: '#F87171',
  dangerDeep: '#EF4444',
  dangerSurface: '#7F1D1D',
  accent: '#34D399',
  accentSurface: '#064E3B',
  bg: '#0F172A',
  surface: '#1E293B',
  surfaceAlt: '#334155',
  border: '#334155',
  borderLight: '#1E293B',
  ink: '#F1F5F9',
  inkLight: '#CBD5E1',
  muted: '#94A3B8',
  subtle: '#64748B',
  inverse: '#0F172A',
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
    shadowColor: '#1A2332',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  md: {
    shadowColor: '#1A2332',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  lg: {
    shadowColor: '#1A2332',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
} as const

/* ─── Typography (static — uses light colors by default) ────── */
export const type = {
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
