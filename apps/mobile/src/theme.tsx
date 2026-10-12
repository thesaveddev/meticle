import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { StyleSheet, useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

/* ─── Font family constant ─────────────────────────────────── */
export const FONT = 'Inter'
const THEME_KEY = 'app_theme_mode'

/* ─── Light colors ──────────────────────────────────────────── */
export const CHART_PALETTE = [
  '#0164C8',
  '#03C6B1',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B7CF6',
  '#6B8AFD',
  '#5D6E85',
] as const

export const lightColors = {
  primary: '#0164C8',
  primaryLight: '#0251B3',
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
  surfaceHover: '#F7FAFE',
  textMuted: '#5D6E85',
  textSecondary: '#51637A',
  background: '#F4F9FC',
  warning: '#F59E0B',
  warningSurface: '#FFF7E6',
  danger: '#EF4444',
  dangerDeep: '#B42318',
  dangerSurface: '#FEF0F0',
  accent: '#03C6B1',
  accentSurface: '#D2FBF4',
  info: '#0164C8',
  infoSurface: '#EAF3FF',
  bg: '#F4F9FC',
  surface: '#FFFFFF',
  surfaceAlt: '#FCFDFF',
  border: '#E3E9F0',
  borderLight: '#E3E9F0',
  ink: '#0C1B2E',
  inkLight: '#3A4551',
  muted: '#51637A',
  subtle: '#5D6E85',
  inverse: '#FFFFFF',
  text: '#0C1B2E',
  dark: '#081320',
}

/* ─── Dark colors ───────────────────────────────────────────── */
export const darkColors = {
  primary: '#0164C8',
  primaryLight: '#3DB8FD',
  primarySurface: '#002552',
  success: '#34D399',
  successDeep: '#10B981',
  successSurface: '#064E3B',
  warning: '#FBBF24',
  warningSurface: '#9A6700',
  danger: '#F87171',
  dangerDeep: '#EF4444',
  dangerSurface: '#B42318',
  accent: '#03C6B1',
  accentSurface: '#002E28',
  info: '#3DB8FD',
  infoSurface: '#002552',
  bg: '#081320',
  surface: '#112539',
  surfaceAlt: '#16283D',
  border: '#2A3C54',
  borderLight: '#112539',
  ink: '#E8EEF6',
  inkLight: '#B0BFD2',
  muted: '#8A9AAF',
  subtle: '#8A9AAF',
  inverse: '#081320',
  text: '#E8EEF6',
  textSecondary: '#B0BFD2',
  textMuted: '#8A9AAF',
  surfaceHover: '#16283D',
  successSoft: '#064E3B',
  successText: '#34D399',
  warningSoft: '#9A6700',
  warningText: '#FBBF24',
  dangerSoft: '#B42318',
  dangerText: '#F87171',
  background: '#081320',
  dark: '#081320',
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
  blue: '#0164C8',
  surfaceStrong: '#014FB5',
  surface: '#EAF3FF',
  blueDark: '#0251B3',
  violet: '#8B7CF6',
  green: '#10B981',
  ink: '#0C1B2E',
  /**
   * Orb geometry. One source for the button size, the screen-edge inset and the
   * drag bounds, so the orb cannot drift from the web FAB.
   *
   * `bottomClearance` is the free space the orb keeps above the bottom of its
   * container. It is the floor, not the whole story: a screen that shares its
   * bottom edge with the tab bar passes the bar's real height on top of this, so
   * a dragged orb can never be parked on top of the navigation.
   */
  orb: {
    size: 56,
    sideInset: 12,
    gap: 12,
    minTop: 60,
    bottomClearance: 24,
  },
  /**
   * Accessible name for the orb. The web MicaOrb uses the same wording, so a
   * screen-reader user gets one name for one control across both apps.
   */
  a11y: {
    orb: 'Mica assistant — tap to open. Press and hold for emergency options.',
  },
  /**
   * The shared Mica state vocabulary. Web's `MicaState` is the same union, and
   * `idle` is the resting state on both platforms.
   */
  states: ['idle', 'listening', 'thinking', 'responding', 'error'] as const,
  /**
   * Error treatment stays inside Mica's identity: the orb keeps its blue and
   * gains a danger ring, rather than becoming a different control.
   */
  errorRing: '#B42318',
} as const

/** A Mica orb state, shared with web's `MicaState`. */
export type MicaOrbState = (typeof mica.states)[number]

export interface MicaColorSet {
  readonly blue: string
  readonly surfaceStrong: string
  readonly surface: string
  readonly blueDark: string
  readonly violet: string
  readonly green: string
  readonly ink: string
}

export const micaGradientStops = ['#0164C8', '#8B7CF6', '#10B981'] as const

export const shadows = StyleSheet.create({
  sm: {
    shadowColor: '#0C1B2E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  md: {
    shadowColor: '#0C1B2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0C1B2E',
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
    shadowColor: '#0C1B2E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  md: {
    shadowColor: '#0C1B2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0C1B2E',
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
