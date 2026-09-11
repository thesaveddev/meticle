import { StyleSheet } from 'react-native'

export const colors = {
  navy: '#0F4C81',
  navyDeep: '#0A3A63',
  emerald: '#10B981',
  emeraldDeep: '#047857',
  bone: '#F7F4EE',
  paper: '#FCFAF6',
  white: '#FFFFFF',
  ink: '#1B2430',
  mist: '#5B6672',
  hairline: '#E7E1D6',
  error: '#B42318',
  errorSoft: '#FDECEC',
  successSoft: '#E9F7F0',
  warningSoft: '#FFF5D9',
} as const

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
} as const

export const type = {
  display: { fontFamily: 'Inter', fontSize: 30, fontWeight: '800' as const, lineHeight: 36, letterSpacing: -0.7 },
  title: { fontFamily: 'Inter', fontSize: 20, fontWeight: '800' as const, lineHeight: 26, letterSpacing: -0.2 },
  body: { fontFamily: 'Inter', fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyStrong: { fontFamily: 'Inter', fontSize: 16, fontWeight: '700' as const, lineHeight: 24 },
  label: { fontFamily: 'Inter', fontSize: 13, fontWeight: '700' as const, lineHeight: 18, letterSpacing: 0.3 },
  caption: { fontFamily: 'Inter', fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
} as const

export const commonStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bone },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  field: { minHeight: 48, borderWidth: 1, borderColor: colors.hairline, borderRadius: radii.sm, backgroundColor: colors.paper, paddingHorizontal: spacing.md, color: colors.ink, ...type.body },
  button: { minHeight: 48, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  buttonLabel: { ...type.bodyStrong, color: colors.white },
  outlineButton: { minHeight: 48, borderWidth: 1, borderColor: colors.navy, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  outlineLabel: { ...type.bodyStrong, color: colors.navy },
  divider: { height: 1, backgroundColor: colors.hairline },
})
