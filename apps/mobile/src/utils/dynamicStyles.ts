import { StyleSheet } from 'react-native'
import { radii, spacing, FONT, elevation } from '../theme'

type Colors = Record<string, string>

/**
 * Generate dynamic color overrides that merge with static StyleSheet styles.
 * Usage: <View style={[styles.card, dyn(c).card]}>
 */
export function dyn(c: Colors) {
  return {
    screen: { backgroundColor: c.bg },
    surface: { backgroundColor: c.surface },
    surfaceAlt: { backgroundColor: c.surfaceAlt },
    card: { backgroundColor: c.surface, borderColor: c.borderLight },
    cardPrimary: { backgroundColor: c.primarySurface, borderColor: c.primary + '20' },
    cardDanger: { backgroundColor: c.dangerSurface, borderColor: c.danger + '40' },
    cardWarning: { backgroundColor: c.warningSurface, borderColor: c.warning + '20' },
    text: { color: c.ink },
    textMuted: { color: c.muted },
    textSubtle: { color: c.subtle },
    textPrimary: { color: c.primary },
    textDanger: { color: c.danger },
    textSuccess: { color: c.success },
    textInverse: { color: c.inverse },
    border: { borderColor: c.border },
    borderLight: { borderColor: c.borderLight },
    input: { borderColor: c.border, backgroundColor: c.surfaceAlt, color: c.ink },
    header: { backgroundColor: c.surface, borderBottomColor: c.borderLight },
    modalBackdrop: { backgroundColor: 'rgba(15, 23, 42, 0.4)' },
    modal: { backgroundColor: c.surface },
    tab: { backgroundColor: c.surfaceAlt, borderColor: c.borderLight },
    tabActive: { backgroundColor: c.primarySurface, borderColor: c.primary + '30' },
    badge: { backgroundColor: c.primarySurface },
    divider: { backgroundColor: c.borderLight },
  } as const
}
