import { createContext, useContext, useMemo, useState, useEffect, ReactNode } from 'react'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'

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

export const METICLE_PRIMARY = '#1A2332'
export const METICLE_SECONDARY = '#6B7280'
export const METICLE_ACCENT = '#10B981'

export function createMeticleTheme(mode: ThemeMode = 'light', colors: BrandingColors = { primary_color: METICLE_PRIMARY, secondary_color: METICLE_SECONDARY, accent_color: '#F8FAFC' }) {
  const primary = colors.primary_color || METICLE_PRIMARY
  const secondary = colors.secondary_color || METICLE_SECONDARY

  return createTheme({
    palette: {
      mode,
      primary: {
        main: primary,
        dark: mode === 'dark' ? primary : undefined,
      },
      secondary: {
        main: secondary,
      },
      ...(mode === 'dark'
        ? {
            background: {
              default: '#0F172A',
              paper: '#1E293B',
            },
            text: {
              primary: '#F1F5F9',
              secondary: '#94A3B8',
            },
            divider: '#334155',
          }
        : {
            background: {
              default: '#F7F9F7',
              paper: '#FFFFFF',
            },
            text: {
              primary: '#1A2332',
              secondary: '#6B7280',
            },
            divider: '#F3F4F6',
          }),
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontWeight: 800, letterSpacing: '-0.02em' },
      h2: { fontWeight: 800, letterSpacing: '-0.02em' },
      h3: { fontWeight: 700, letterSpacing: '-0.02em' },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: {
      borderRadius: 14,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            padding: '10px 24px',
            borderRadius: 14,
            boxShadow: 'none',
            '&:hover': { boxShadow: '0 4px 12px rgba(26, 35, 50, 0.06)' },
          },
          contained: {
            backgroundColor: '#1A2332',
            '&:hover': { backgroundColor: '#0F172A' },
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 18,
            boxShadow: mode === 'dark' ? '0 1px 3px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(26, 35, 50, 0.04)',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 18,
            boxShadow: mode === 'dark' ? '0 1px 3px rgba(0, 0, 0, 0.2)' : '0 1px 3px rgba(26, 35, 50, 0.04)',
            border: 'none',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 14,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 10,
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: mode === 'dark' ? '#334155 #1E293B' : undefined,
          },
        },
      },
    },
  })
}

const STORAGE_KEY_MODE = 'theme-mode'
const STORAGE_KEY_BRANDING = 'org-branding'
export const STORAGE_KEY_ZOOM = 'zoom-scale'

export function MeticleThemeProvider({ children }: { children: ReactNode }) {
  const theme = useMemo(() => createMeticleTheme('light'), [])
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
    if (raw) return JSON.parse(raw)
  } catch {}
  return {
    colors: { primary_color: '#0F4C81', secondary_color: '#6B7280', accent_color: '#F8FAFC' },
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MODE, mode)
  }, [mode])

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
    setBrandingState({ colors: newColors, logo: newLogo })
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
