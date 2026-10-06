/**
 * Design tokens for MUI sx props.
 * These reference the CSS custom properties defined in index.css.
 *
 * Usage: sx={{ mb: tokens.sectionGap, maxWidth: tokens.container.standard }}
 */
export const tokens = {
  // MeticleCare master palette
  color: {
    primary: 'var(--mc-primary)' as const,
    primaryHover: 'var(--mc-primary-hover)' as const,
    primaryActive: 'var(--mc-primary-active)' as const,
    primarySoft: 'var(--mc-primary-soft)' as const,
    primarySubtle: 'var(--mc-primary-subtle)' as const,
    secondary: 'var(--mc-secondary)' as const,
    secondaryHover: 'var(--mc-secondary-hover)' as const,
    secondaryActive: 'var(--mc-secondary-active)' as const,
    secondarySoft: 'var(--mc-secondary-soft)' as const,
    secondarySubtle: 'var(--mc-secondary-subtle)' as const,
    success: 'var(--mc-success)' as const,
    successSoft: 'var(--mc-success-soft)' as const,
    successText: 'var(--mc-success-text)' as const,
    warning: 'var(--mc-warning)' as const,
    warningSoft: 'var(--mc-warning-soft)' as const,
    warningText: 'var(--mc-warning-text)' as const,
    danger: 'var(--mc-danger)' as const,
    dangerSoft: 'var(--mc-danger-soft)' as const,
    dangerText: 'var(--mc-danger-text)' as const,
    info: 'var(--mc-info)' as const,
    infoSoft: 'var(--mc-info-soft)' as const,
    infoText: 'var(--mc-info-text)' as const,
    background: 'var(--mc-background)' as const,
    backgroundSubtle: 'var(--mc-background-subtle)' as const,
    surface: 'var(--mc-surface)' as const,
    surfaceSubtle: 'var(--mc-surface-subtle)' as const,
    surfaceHover: 'var(--mc-surface-hover)' as const,
    surfaceSelected: 'var(--mc-surface-selected)' as const,
    border: 'var(--mc-border)' as const,
    borderStrong: 'var(--mc-border-strong)' as const,
    borderHover: 'var(--mc-border-hover)' as const,
    text: 'var(--mc-text)' as const,
    textSecondary: 'var(--mc-text-secondary)' as const,
    textMuted: 'var(--mc-text-muted)' as const,
    textDisabled: 'var(--mc-text-disabled)' as const,
    supportIndigo: 'var(--mc-support-indigo)' as const,
    supportPurple: 'var(--mc-support-purple)' as const,
    supportTeal: 'var(--mc-support-teal)' as const,
    supportSlate: 'var(--mc-support-slate)' as const,
    supportCyan: 'var(--mc-support-cyan)' as const,
  },
  chartPalette: [
    'var(--mc-chart-1)',
    'var(--mc-chart-2)',
    'var(--mc-chart-3)',
    'var(--mc-chart-4)',
    'var(--mc-chart-5)',
    'var(--mc-chart-6)',
    'var(--mc-chart-7)',
    'var(--mc-chart-8)',
  ] as const,

  // 8px based spacing scale
  space: {
    0.5: '4px' as const,
    1: '8px' as const,
    1.5: '12px' as const,
    2: '16px' as const,
    2.5: '20px' as const,
    3: '24px' as const,
    4: '32px' as const,
    5: '40px' as const,
    6: '48px' as const,
    8: '64px' as const,
  },

  // Container widths
  container: {
    compact: 'var(--container-compact)' as const,
    narrow: 'var(--container-narrow)' as const,
    standard: 'var(--container-standard)' as const,
    full: '100%' as const,
  },

  // Gaps between sections (major divisions on a page)
  sectionGap: 'var(--section-gap)' as const,
  // Gaps between cards/items within a section
  cardGap: 'var(--card-gap)' as const,

  // Page padding
  pagePx: 'var(--page-padding-x)' as const,
  pagePt: 'var(--page-padding-top)' as const,
  pagePb: 'var(--page-padding-bottom)' as const,

  // Header
  headerHeight: 'var(--header-height)' as const,

  // Border radius
  radius: {
    sm: 'var(--radius-sm)' as const,
    md: 'var(--radius-md)' as const,
    lg: 'var(--radius-lg)' as const,
    xl: 'var(--radius-xl)' as const,
  },

  // Transitions
  transition: {
    fast: 'var(--transition-fast)' as const,
    base: 'var(--transition-base)' as const,
  },

  // Shadows
  shadow: {
    sm: 'var(--shadow-sm)' as const,
    md: 'var(--shadow-md)' as const,
    lg: 'var(--shadow-lg)' as const,
  },
} as const

/**
 * Common MUI sx patterns using design tokens.
 * Use these for consistent spacing across all pages.
 *
 * Example: <Paper sx={sx.pageSection}>
 */
export const sx = {
  // Root page wrapper — use when a page needs its own maxWidth container
  pageSection: {
    maxWidth: 'var(--container-standard)',
    mx: 'auto' as const,
  },

  // Narrow page (settings, profile, forms)
  pageNarrow: {
    maxWidth: 'var(--container-narrow)',
    mx: 'auto' as const,
  },

  // Compact page (login, confirmations)
  pageCompact: {
    maxWidth: 'var(--container-compact)',
    mx: 'auto' as const,
  },

  // Standard card spacing
  cardStack: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 'var(--card-gap)',
  },

  // Section spacing (between major page sections)
  sectionStack: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: 'var(--section-gap)',
  },

  // Common Paper card
  card: {
    p: 3,
    borderRadius: 'var(--radius-lg)',
    border: '1px solid',
    borderColor: 'divider',
  },

  // Grid gap
  gridGap: {
    gap: 'var(--card-gap)',
  },
}
