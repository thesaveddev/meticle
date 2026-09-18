/**
 * MeticleCare Marketing Design System
 *
 * A premium B2B healthcare SaaS visual identity.
 * Warm, authoritative, distinctive — not generic healthcare blue.
 */

export const M = {
  /* ── Palette ─────────────────────────────────────── */
  ink:        '#111827',   // primary text
  slate:      '#4B5563',   // secondary text
  muted:      '#9CA3AF',   // tertiary / captions
  subtle:     '#D1D5DB',   // borders, hairlines
  faint:      '#F3F4F6',   // subtle backgrounds

  paper:      '#FAFAF7',   // warm off-white page bg
  card:       '#FFFFFF',   // card surfaces

  teal:       '#00D4AA',   // primary accent — distinctive, not generic
  tealDark:   '#00B894',   // accent hover
  tealSoft:   '#E6FAF5',   // accent light bg
  tealDeep:   '#065F56',   // accent dark for text on light

  navy:       '#0F172A',   // deep navy for special sections
  navyMid:    '#1E293B',   // slightly lighter navy
  navyLight:  '#334155',   // for text on dark bg

  coral:      '#F97066',   // warning / alert
  amber:      '#F59E0B',   // caution
  green:      '#22C55E',   // success

  /* ── Typography ──────────────────────────────────── */
  font:       "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",

  display:    { size: 'clamp(2.8rem, 5vw + 1rem, 4.5rem)', height: 1.05, weight: 800 as const, tracking: '-0.035em' },
  h1:         { size: 'clamp(2.2rem, 4vw + 0.5rem, 3.5rem)', height: 1.1, weight: 800 as const, tracking: '-0.03em' },
  h2:         { size: 'clamp(1.75rem, 3vw + 0.5rem, 2.5rem)', height: 1.15, weight: 700 as const, tracking: '-0.025em' },
  h3:         { size: 'clamp(1.25rem, 1.5vw + 0.5rem, 1.5rem)', height: 1.3, weight: 700 as const, tracking: '-0.015em' },
  bodyLg:     { size: '1.15rem', height: 1.7, weight: 400 as const },
  body:       { size: '1rem', height: 1.65, weight: 400 as const },
  small:      { size: '0.875rem', height: 1.5, weight: 400 as const },
  caption:    { size: '0.75rem', height: 1.4, weight: 600 as const, tracking: '0.08em' },

  /* ── Spacing ─────────────────────────────────────── */
  section:    { py: { xs: 8, md: 14 }, px: 0 },
  container:  { maxWidth: '1200px' as const, mx: 'auto' },

  /* ── Radii ───────────────────────────────────────── */
  r: { sm: '8px', md: '12px', lg: '16px', xl: '24px', full: '9999px' },

  /* ── Shadows ─────────────────────────────────────── */
  shadow: {
    sm: '0 1px 3px rgba(0,0,0,0.06)',
    md: '0 4px 16px rgba(0,0,0,0.08)',
    lg: '0 12px 40px rgba(0,0,0,0.12)',
    xl: '0 24px 64px rgba(0,0,0,0.16)',
    glow: '0 0 60px rgba(0,212,170,0.15)',
  },
} as const

/* ── Section tone helper ───────────────────────────── */
export type SectionTone = 'light' | 'warm' | 'dark' | 'accent' | 'gradient'

export const sectionBg: Record<SectionTone, string> = {
  light:   M.card,
  warm:    M.paper,
  dark:    M.navy,
  accent:  M.teal,
  gradient: `linear-gradient(135deg, ${M.navy} 0%, #162032 50%, #1A2744 100%)`,
}
