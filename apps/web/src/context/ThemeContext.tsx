import { createContext, useContext, useMemo, useState, useEffect, ReactNode } from 'react'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import { noticeTokens } from '../theme/noticeTokens'

type ThemeMode = 'light' | 'dark'

export type ZoomScale = 0.85 | 0.9 | 0.95 | 1 | 1.1 | 1.25 | 1.5
export const ZOOM_OPTIONS: ZoomScale[] = [0.85, 0.9, 0.95, 1, 1.1, 1.25, 1.5]
export const DEFAULT_ZOOM: ZoomScale = 1

interface BrandingColors {
  primary_color: string
  secondary_color: string
  accent_color: string
}

interface ThemeContextValue {
  mode: ThemeMode
  toggleTheme: () => void
  setMode: (m: ThemeMode) => void
  branding: BrandingColors
  logoUrl: string
  updateBranding: (colors: BrandingColors, logo: string) => void
  zoomScale: ZoomScale
  setZoomScale: (z: ZoomScale) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useThemeMode() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider')
  return ctx
}

export const METICLE_PRIMARY = '#0164C8'
export const METICLE_SECONDARY = '#03C6B1'
export const METICLE_ACCENT = '#03C6B1'

/**
 * Branding colours persisted in localStorage by earlier releases. They are
 * mapped onto the current brand rather than trusted: a user (or org) who saved
 * the previous blue keeps a primary that matches the product instead of a
 * stranded off-brand accent.
 *
 * These arrays are the one place in the app that must still name superseded
 * palette values, so each carries the palette-audit exemption marker. Any other
 * file needs a token, not a literal.
 */
const LEGACY_PRIMARY_HEXES = ['#2F80ED', '#2674D9', '#1F68C7', '#0164C8'] // palette-audit: allow-legacy
const LEGACY_SECONDARY_HEXES = ['#475467', '#667085', '#10BFA5', '#10B981', '#03C6B1'] // palette-audit: allow-legacy

/**
 * Chart series order. Slots 1-2 are brand Blue and brand Mint; 3-5 are the
 * semantic trio; 6-7 are the documented charts-only support hues (a categorical
 * scale needs hue variety the logo ramp does not have); 8 is the brand slate.
 */
export const METICLE_CHART_PALETTE = [
  '#0164C8',
  '#03C6B1',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B7CF6',
  '#6B8AFD',
  '#5D6E85',
] as const

/**
 * The master UI palette, re-pointed onto the logo-derived brand ramp in
 * `scripts/design/palette.mjs` (Brand Blue #0164C8, Mint #03C6B1, Ink #0C1B2E,
 * Mist Ground #F4F9FC, Hairline #E3E9F0).
 *
 * Every value here is either a branded slot from that ramp or a derived stop of
 * one: `*Soft` is the brand hue at ramp L=0.92, `*Subtle` is that stop blended
 * 50% into white, and text-on-soft is ramp L=0.38. Semantics (success /
 * warning / danger) are deliberately *not* brand-derived — they carry meaning,
 * not identity, and their foregrounds are the accessibility-tested pairs.
 */
export const METICLE_COLORS = {
  primary: METICLE_PRIMARY,
  primaryHover: '#0251B3',
  primaryActive: '#014FB5',
  primarySoft: '#D4E6FF',
  primaryVerySoft: '#EAF3FF',
  sky: '#3DB8FD',
  secondary: METICLE_SECONDARY,
  secondaryHover: '#02A995',
  secondaryActive: '#046E86',
  secondarySoft: '#D2FBF4',
  secondaryVerySoft: '#E9FDF9',
  success: '#10B981',
  successSoft: '#EAFBF5',
  successText: '#087A55',
  warning: '#F59E0B',
  warningSoft: '#FFF7E6',
  warningText: '#9A6700',
  danger: '#EF4444',
  dangerSoft: '#FEF0F0',
  dangerText: '#B42318',
  info: METICLE_PRIMARY,
  infoSoft: '#EAF3FF',
  infoText: '#004085',
  background: '#F4F9FC',
  backgroundSubtle: '#F7FAFE',
  surface: '#FFFFFF',
  surfaceSubtle: '#FCFDFF',
  surfaceHover: '#F7FAFE',
  surfaceSelected: '#EAF3FF',
  border: '#E3E9F0',
  borderStrong: '#D6E2EE',
  borderHover: '#C3D2E2',
  text: '#0C1B2E',
  textSecondary: '#51637A',
  textMuted: '#5D6E85',
  textDisabled: '#B0BFD2',
  supportIndigo: '#6B8AFD',
  supportPurple: '#8B7CF6',
  supportTeal: '#2DAE9D',
  supportSlate: '#5D6E85',
  supportCyan: '#0187BA',
  micaGradient: 'linear-gradient(135deg, #0164C8 0%, #03C6B1 100%)',
} as const

export function createMeticleTheme(mode: ThemeMode = 'light', colors: BrandingColors = { primary_color: METICLE_PRIMARY, secondary_color: METICLE_SECONDARY, accent_color: '#EAF3FF' }) {
  const primary = !colors.primary_color || LEGACY_PRIMARY_HEXES.includes(colors.primary_color.toUpperCase()) ? METICLE_PRIMARY : colors.primary_color
  const secondaryColor = !colors.secondary_color || LEGACY_SECONDARY_HEXES.includes(colors.secondary_color.toUpperCase()) ? METICLE_SECONDARY : colors.secondary_color
  const dark = mode === 'dark'
  const palette = {
    background: dark ? { default: '#081320', paper: '#112539' } : { default: METICLE_COLORS.background, paper: METICLE_COLORS.surface },
    text: dark ? { primary: '#E8EEF6', secondary: '#B0BFD2', disabled: '#8A9AAF' } : { primary: METICLE_COLORS.text, secondary: METICLE_COLORS.textSecondary, disabled: METICLE_COLORS.textMuted },
    divider: dark ? '#2A3C54' : METICLE_COLORS.border,
  }

  return createTheme({
    palette: {
      mode,
      primary: { main: primary, light: dark ? '#002552' : METICLE_COLORS.primarySoft, dark: primary === METICLE_PRIMARY ? '#0251B3' : primary, contrastText: '#FFFFFF' },
      secondary: { main: secondaryColor, light: dark ? '#002E28' : METICLE_COLORS.secondarySoft, dark: '#02A995', contrastText: '#FFFFFF' },
      success: { main: '#10B981', light: '#EAFBF5', dark: '#087A55', contrastText: '#FFFFFF' },
      warning: { main: '#F59E0B', light: '#FFF7E6', dark: '#9A6700', contrastText: '#0C1B2E' },
      error: { main: '#EF4444', light: '#FEF0F0', dark: '#B42318', contrastText: '#FFFFFF' },
      info: { main: '#0164C8', light: '#EAF3FF', dark: '#004085', contrastText: '#FFFFFF' },
      action: { hover: dark ? 'rgba(255,255,255,0.055)' : '#F7FAFE', selected: dark ? 'rgba(1,100,200,0.16)' : '#EAF3FF', disabled: dark ? 'rgba(255,255,255,0.28)' : '#B0BFD2', disabledBackground: dark ? 'rgba(255,255,255,0.08)' : 'rgba(12,27,46,0.08)' },
      notice: noticeTokens(mode),
      ...palette,
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      fontSize: 14,
      h1: { fontSize: '2rem', lineHeight: 1.25, fontWeight: 600, letterSpacing: '-0.035em' },
      h2: { fontSize: '1.75rem', lineHeight: 1.3, fontWeight: 600, letterSpacing: '-0.03em' },
      h3: { fontSize: '1.5rem', lineHeight: 1.35, fontWeight: 600, letterSpacing: '-0.025em' },
      h4: { fontSize: '1.875rem', lineHeight: 1.3, fontWeight: 600, letterSpacing: '-0.03em' },
      h5: { fontSize: '1.25rem', lineHeight: 1.4, fontWeight: 600, letterSpacing: '-0.015em' },
      h6: { fontSize: '1.125rem', lineHeight: 1.45, fontWeight: 600 },
      subtitle1: { fontSize: '0.9375rem', lineHeight: 1.45, fontWeight: 600 },
      subtitle2: { fontSize: '0.875rem', lineHeight: 1.45, fontWeight: 600 },
      body1: { fontSize: '0.9375rem', lineHeight: 1.55 },
      body2: { fontSize: '0.875rem', lineHeight: 1.5 },
      caption: { fontSize: '0.8125rem', lineHeight: 1.45 },
      button: { fontSize: '0.875rem', textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { minHeight: 40, padding: '8px 14px', borderRadius: 10, boxShadow: 'none', fontWeight: 600, transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease', '&:hover': { boxShadow: 'none' }, '&.Mui-disabled': { opacity: 0.58 } },
          sizeSmall: { minHeight: 34, padding: '6px 10px', borderRadius: 9 },
          sizeLarge: { minHeight: 44, padding: '10px 18px' },
          containedPrimary: { backgroundColor: '#0164C8', color: '#FFFFFF', '&:hover': { backgroundColor: '#0251B3' }, '&:active': { backgroundColor: '#014FB5' } },
          contained: { color: '#FFFFFF', '&:hover': { backgroundColor: dark ? primary : (primary === METICLE_PRIMARY ? '#0251B3' : primary) }, '&:active': { backgroundColor: '#014FB5' } },
          outlined: { borderColor: dark ? '#354357' : '#D6E2EE', color: dark ? '#E8EEF6' : '#3A4551', '&:hover': { borderColor: '#C3D2E2', backgroundColor: dark ? 'rgba(1,100,200,0.12)' : '#F4F9FC' } },
          text: { '&:hover': { backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(12,27,46,0.045)' } },
        },
      },
      MuiIconButton: { styleOverrides: { root: { borderRadius: 10, transition: 'background-color 160ms ease, color 160ms ease' } } },
      MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none', borderRadius: 12 } } },
      MuiCard: { styleOverrides: { root: { borderRadius: 16, border: `1px solid ${palette.divider}`, boxShadow: 'none', backgroundImage: 'none' } } },
      MuiOutlinedInput: { styleOverrides: { root: { minHeight: 44, borderRadius: 10, backgroundColor: dark ? '#0E1F33' : '#FFFFFF', '& .MuiOutlinedInput-notchedOutline': { borderColor: dark ? '#354357' : '#D6E2EE' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: dark ? '#B0BFD2' : '#C3D2E2' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0164C8', borderWidth: 1, boxShadow: '0 0 0 3px rgba(1,100,200,0.14)' }, '&.Mui-focused': { backgroundColor: dark ? '#0E1F33' : '#FFFFFF' }, '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: '#EF4444' }, '&.MuiInputBase-sizeSmall': { minHeight: 40, borderRadius: 9 } }, input: { padding: '11px 14px', color: dark ? '#E8EEF6' : '#0C1B2E', '&.MuiInputBase-inputSizeSmall': { padding: '9px 12px' }, '&::placeholder': { color: '#5D6E85', opacity: 1 } } } },
      MuiInputLabel: { styleOverrides: { root: { color: dark ? '#B0BFD2' : '#51637A', fontSize: '0.875rem', '&.Mui-focused': { color: primary } } } },
      MuiFormLabel: { styleOverrides: { root: { fontSize: '0.875rem', fontWeight: 500 } } },
      MuiSelect: { styleOverrides: { select: { minHeight: '1.5em', display: 'flex', alignItems: 'center' } } },
      MuiChip: { styleOverrides: { root: { height: 26, borderRadius: 8, fontWeight: 600 }, sizeSmall: { height: 22, borderRadius: 7, fontSize: '0.75rem' } } },
      MuiTableContainer: { styleOverrides: { root: { border: `1px solid ${palette.divider}`, borderRadius: 12, boxShadow: 'none', backgroundColor: palette.background.paper } } },
      MuiTableCell: { styleOverrides: { root: { borderBottom: `1px solid ${dark ? '#2A3C54' : '#E3E9F0'}`, padding: '13px 16px', fontSize: '0.875rem' }, head: { color: dark ? '#B0BFD2' : '#51637A', fontWeight: 600, backgroundColor: dark ? '#112539' : '#F7FAFE', whiteSpace: 'nowrap' } } },
      MuiTableRow: { styleOverrides: { root: { '&.MuiTableRow-hover:hover': { backgroundColor: dark ? 'rgba(255,255,255,0.035)' : '#F7FAFE' }, '&.Mui-selected': { backgroundColor: '#EAF3FF' }, '&.Mui-selected:hover': { backgroundColor: '#EAF3FF' } } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 16, border: `1px solid ${palette.divider}`, boxShadow: dark ? '0 20px 60px rgba(0,0,0,0.32)' : '0 16px 48px rgba(12,27,46,0.12)' } } },
      MuiDialogTitle: { styleOverrides: { root: { padding: '22px 24px 8px', fontSize: '1.125rem', fontWeight: 600 } } },
      MuiDialogContent: { styleOverrides: { root: { padding: '12px 24px 20px' } } },
      MuiDialogActions: { styleOverrides: { root: { padding: '12px 24px 22px', gap: 8 } } },
      MuiMenu: { styleOverrides: { paper: { marginTop: 6, border: `1px solid ${palette.divider}`, boxShadow: dark ? '0 12px 32px rgba(0,0,0,0.28)' : '0 8px 24px rgba(12,27,46,0.10)' } } },
      MuiMenuItem: { styleOverrides: { root: { minHeight: 40, borderRadius: 8, margin: '2px 6px', paddingLeft: 10, paddingRight: 10, fontSize: '0.875rem' } } },
      MuiTabs: { styleOverrides: { root: { minHeight: 42 }, indicator: { height: 2, borderRadius: 2 } } },
      MuiTab: { styleOverrides: { root: { minHeight: 42, padding: '8px 14px', textTransform: 'none', fontSize: '0.875rem', fontWeight: 500, '&.Mui-selected': { fontWeight: 600 } } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: 10, border: `1px solid ${palette.divider}`, alignItems: 'center' }, message: { padding: '4px 0' } } },
      MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 8, fontSize: '0.75rem' } } },
      MuiListItemButton: { styleOverrides: { root: { borderRadius: 9, transition: 'background-color 160ms ease, color 160ms ease' } } },
      MuiCssBaseline: {
        styleOverrides: {
          html: { colorScheme: mode },
          body: { scrollbarColor: dark ? '#536176 #0E1F33' : undefined, backgroundColor: palette.background.default, color: palette.text.primary },
          '*, *::before, *::after': { borderColor: dark ? '#2A3C54' : undefined },
          'input::placeholder, textarea::placeholder': { color: dark ? '#8A9AAF' : METICLE_COLORS.textMuted, opacity: 1 },
          'input:-webkit-autofill': { WebkitBoxShadow: `0 0 0 1000px ${dark ? '#0E1F33' : '#FFFFFF'} inset`, WebkitTextFillColor: dark ? '#E8EEF6' : METICLE_COLORS.text },
          '@media (prefers-reduced-motion: reduce)': { '*, *::before, *::after': { scrollBehavior: 'auto !important', animationDuration: '0.01ms !important', animationIterationCount: '1 !important', transitionDuration: '0.01ms !important' } },
        },
      },
    },
  })
}

const STORAGE_KEY_MODE = 'theme-mode'
const STORAGE_KEY_BRANDING = 'org-branding'
export const STORAGE_KEY_ZOOM = 'zoom-scale'

export function MeticleThemeProvider({ children }: { children: ReactNode }) {
  const mode = loadMode()
  const theme = useMemo(() => createMeticleTheme(mode), [mode])
  // Set data-theme for unauthenticated pages too
  useEffect(() => { document.documentElement.dataset.theme = mode }, [mode])
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>
}

function loadMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MODE)
    if (saved === 'dark' || saved === 'light') return saved
  } catch {}
  return 'light'
}

function loadBranding(): { colors: BrandingColors; logo: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BRANDING)
    if (raw) {
      const saved = JSON.parse(raw)
      if (LEGACY_PRIMARY_HEXES.includes(saved?.colors?.primary_color?.toUpperCase?.())) saved.colors.primary_color = METICLE_PRIMARY
      if (LEGACY_SECONDARY_HEXES.includes(saved?.colors?.secondary_color?.toUpperCase?.())) saved.colors.secondary_color = METICLE_SECONDARY
      return saved
    }
  } catch {}
  return {
    colors: { primary_color: METICLE_PRIMARY, secondary_color: METICLE_SECONDARY, accent_color: '#EAF3FF' },
    logo: '',
  }
}

function loadZoom(): ZoomScale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_ZOOM)
    if (saved && ZOOM_OPTIONS.includes(parseFloat(saved) as ZoomScale)) return parseFloat(saved) as ZoomScale
  } catch {}
  return DEFAULT_ZOOM
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(loadMode)
  const [{ colors, logo }, setBrandingState] = useState(() => loadBranding())
  const [zoomScale, setZoomScaleState] = useState<ZoomScale>(loadZoom)

  // Set data-theme attribute on mount and whenever mode changes
  useEffect(() => {
    document.documentElement.dataset.theme = mode
    localStorage.setItem(STORAGE_KEY_MODE, mode)
  }, [mode])

  // Apply data-theme on initial render
  useEffect(() => {
    document.documentElement.dataset.theme = mode
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_BRANDING, JSON.stringify({ colors, logo }))
  }, [colors, logo])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_ZOOM, String(zoomScale))
    const root = document.documentElement
    root.style.setProperty('--app-zoom', String(zoomScale))
    ;(root.style as any).zoom = String(zoomScale)
  }, [zoomScale])

  // Listen for branding updates from localStorage (cross-tab)
  useEffect(() => {
    const handler = () => {
      const fresh = loadBranding()
      setBrandingState(fresh)
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const toggleTheme = () => setModeState(m => (m === 'light' ? 'dark' : 'light'))
  const setMode = (m: ThemeMode) => setModeState(m)
  const setZoomScale = (z: ZoomScale) => setZoomScaleState(z)
  const updateBranding = (newColors: BrandingColors, newLogo: string) => {
    const primary_color = LEGACY_PRIMARY_HEXES.includes(newColors.primary_color?.toUpperCase()) ? METICLE_PRIMARY : newColors.primary_color
    const secondary_color = LEGACY_SECONDARY_HEXES.includes(newColors.secondary_color?.toUpperCase()) ? METICLE_SECONDARY : newColors.secondary_color
    setBrandingState({ colors: { ...newColors, primary_color, secondary_color }, logo: newLogo })
  }

  const theme = useMemo(() => {
    return createMeticleTheme(mode, colors)
  }, [mode, colors])

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setMode, branding: colors, logoUrl: logo, updateBranding, zoomScale, setZoomScale }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  )
}
