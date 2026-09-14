/**
 * Design tokens for MUI sx props.
 * These reference the CSS custom properties defined in index.css.
 *
 * Usage: sx={{ mb: tokens.sectionGap, maxWidth: tokens.container.standard }}
 */
export const tokens = {
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
