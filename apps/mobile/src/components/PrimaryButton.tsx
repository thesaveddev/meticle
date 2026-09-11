import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { colors, commonStyles } from '../theme'

interface PrimaryButtonProps {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  tone?: 'navy' | 'emerald'
}

export function PrimaryButton({ label, onPress, loading = false, disabled = false, tone = 'navy' }: PrimaryButtonProps) {
  const inactive = disabled || loading
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        commonStyles.button,
        { backgroundColor: tone === 'emerald' ? colors.emeraldDeep : colors.navy },
        inactive && styles.disabled,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.white} /> : <Text style={commonStyles.buttonLabel}>{label}</Text>}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.5 },
  pressed: { transform: [{ translateY: 1 }] },
})
