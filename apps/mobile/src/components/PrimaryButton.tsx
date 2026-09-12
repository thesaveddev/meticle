import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, elevation, radii, spacing, FONT } from '../theme'
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
  const bg = tone === 'primary' ? colors.primary
    : tone === 'success' ? colors.success
    : tone === 'danger' ? colors.danger
    : 'transparent'

  const fg = tone === 'outline' ? colors.primary : colors.inverse

  const border = tone === 'outline' ? colors.primary + '40' : bg

  return (
    <Pressable
      onPress={() => { hapticLight(); onPress() }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        size === 'small' && styles.btnSmall,
        { backgroundColor: bg, borderColor: border },
        pressed && !disabled && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        disabled && { opacity: 0.5 },
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
    borderWidth: 1.5,
    ...elevation.sm,
  },
  btnSmall: {
    minHeight: 40,
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
