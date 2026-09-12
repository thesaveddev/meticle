import { StyleSheet } from 'react-native'

/* ─── Color system ─────────────────────────────────────────── */
export const colors = {
  /* Primary — deep indigo, professional and calm */
  primary: '#2D3A8C',
  primaryLight: '#4A5AC7',
  primarySurface: '#EEF0FA',

  /* Success — warm emerald */
  success: '#16A34A',
  successDeep: '#15803D',
  successSurface: '#DCFCE7',

  /* Warning — warm amber */
  warning: '#D97706',
  warningSurface: '#FEF3C7',

  /* Danger — warm red */
  danger: '#DC2626',
  dangerDeep: '#B91C1C',
  dangerSurface: '#FEE2E2',

  /* Accent — teal for secondary actions */
  accent: '#0D9488',
  accentSurface: '#CCFBF1',

  /* Neutrals — warm paper tones */
  bg: '#F5F2ED',
  surface: '#FFFFFF',
  surfaceAlt: '#FAF8F5',
  border: '#E5E0D8',
  borderLight: '#F0ECE6',

  /* Text */
  ink: '#1C1917',
  inkLight: '#44403C',
  muted: '#78716C',
  subtle: '#A8A29E',
  inverse: '#FFFFFF',
} as const

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

/* ─── Elevation (Android shadows + iOS shadows) ─────────────── */
export const elevation = {
  none: {
    shadowOpacity: 0,
  },
  sm: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
} as const

/* ─── Typography ────────────────────────────────────────────── */
export const type = {
  /** Hero greeting, login headline */
  hero: {
    fontFamily: 'System',
    fontSize: 28,
    fontWeight: '800' as const,
    lineHeight: 34,
    letterSpacing: -0.6,
    color: colors.ink,
  },
  /** Section titles */
  title: {
    fontFamily: 'System',
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 26,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  /** Card titles, strong body */
  bodyBold: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
    color: colors.ink,
  },
  /** Standard body text */
  body: {
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    color: colors.inkLight,
  },
  /** Small body, secondary text */
  small: {
    fontFamily: 'System',
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    color: colors.muted,
  },
  /** Labels, chips, badges */
  label: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
    color: colors.muted,
  },
  /** Tiny text, captions */
  caption: {
    fontFamily: 'System',
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    color: colors.subtle,
  },
  /** Tab bar labels */
  tab: {
    fontFamily: 'System',
    fontSize: 10,
    fontWeight: '500' as const,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  /** Big numbers in summary cards */
  stat: {
    fontFamily: 'System',
    fontSize: 24,
    fontWeight: '800' as const,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  /** Small stat numbers */
  statSmall: {
    fontFamily: 'System',
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 22,
    letterSpacing: -0.3,
  },
} as const

/* ─── Shared component styles ───────────────────────────────── */
export const commonStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...elevation.sm,
  },
  field: {
    minHeight: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    color: colors.ink,
    fontFamily: 'System',
    fontSize: 15,
    fontWeight: '400' as const,
  },
  fieldFocused: {
    borderColor: colors.primary,
  },
  button: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.lg,
  },
  buttonLabel: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.inverse,
  },
  outlineButton: {
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radii.md,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  outlineLabel: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  sectionHeader: {
    fontFamily: 'System',
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    color: colors.subtle,
    marginBottom: spacing.sm,
  },
})
