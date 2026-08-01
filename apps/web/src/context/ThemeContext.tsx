import { createContext, useContext, useMemo, useState, useEffect, ReactNode } from 'react'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'

type ThemeMode = 'light' | 'dark'

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
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useThemeMode() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider')
  return ctx
}

export const METICLE_PRIMARY = '#0F4C81'
export const METICLE_SECONDARY = '#6B7280'

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
          }
        : {
            background: {
              default: '#F8FAFC',
              paper: '#FFFFFF',
            },
            text: {
              primary: '#111827',
              secondary: '#6B7280',
            },
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
      borderRadius: 8,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            padding: '10px 24px',
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            border: `1px solid ${mode === 'dark' ? '#334155' : '#E5E7EB'}`,
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

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(loadMode)
  const [{ colors, logo }, setBrandingState] = useState(() => loadBranding())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MODE, mode)
  }, [mode])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_BRANDING, JSON.stringify({ colors, logo }))
  }, [colors, logo])

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
  const updateBranding = (newColors: BrandingColors, newLogo: string) => {
    setBrandingState({ colors: newColors, logo: newLogo })
  }

  const theme = useMemo(() => {
    return createMeticleTheme(mode, colors)
  }, [mode, colors])

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme, setMode, branding: colors, logoUrl: logo, updateBranding }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  )
}
