import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, elevation, radii, spacing, FONT, useAppColors } from '../theme'
import { hapticLight } from '../services/haptics'

type Tone = 'primary' | 'success' | 'danger' | 'outline'

interface Props {
  label: string
  onPress: () => void
  tone?: Tone
  size?: 'small' | 'normal'
  loading?: boolean
  disabled?: boolean
}

export function PrimaryButton({ label, onPress, tone = 'primary', size = 'normal', loading = false, disabled = false }: Props) {
  const c = useAppColors()
  const bg = tone === 'primary' ? c.primary
    : tone === 'success' ? c.success
    : tone === 'danger' ? c.danger
    : 'transparent'

  const fg = tone === 'outline' ? c.primary : c.inverse

  const border = tone === 'outline' ? c.border : 'transparent'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={() => { hapticLight(); onPress() }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        size === 'small' && styles.btnSmall,
        { backgroundColor: bg, borderColor: border },
        pressed && !disabled && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        disabled && { opacity: 0.4 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <Text style={[styles.label, size === 'small' && styles.labelSmall, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    ...elevation.sm,
  },
  btnSmall: {
    minHeight: 44,
    paddingHorizontal: spacing.base,
  },
  label: {
    fontFamily: FONT,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelSmall: {
    fontSize: 14,
  },
})
