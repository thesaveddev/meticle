import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, elevation, radii, spacing, type } from '../theme'
import { hapticLight } from '../services/haptics'

interface PrimaryButtonProps {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  tone?: 'primary' | 'success' | 'danger' | 'outline'
  size?: 'normal' | 'small'
  icon?: string
}

const toneMap = {
  primary: { bg: colors.primary, text: colors.inverse },
  success: { bg: colors.successDeep, text: colors.inverse },
  danger: { bg: colors.danger, text: colors.inverse },
  outline: { bg: colors.surface, text: colors.primary, border: colors.primary },
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  tone = 'primary',
  size = 'normal',
  icon,
}: PrimaryButtonProps) {
  const inactive = disabled || loading
  const t = toneMap[tone]
  const isOutline = tone === 'outline'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={() => { hapticLight(); onPress() }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        size === 'small' && styles.buttonSmall,
        {
          backgroundColor: t.bg,
          borderColor: isOutline ? (t as any).border : 'transparent',
          borderWidth: isOutline ? 1.5 : 0,
        },
        !isOutline && elevation.sm,
        inactive && styles.disabled,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={t.text} size="small" />
      ) : (
        <View style={styles.labelRow}>
          {icon ? <Text style={[styles.icon, { color: t.text }]}>{icon}</Text> : null}
          <Text
            style={[
              styles.label,
              { color: t.text },
              size === 'small' && styles.labelSmall,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  buttonSmall: {
    minHeight: 40,
    paddingHorizontal: spacing.base,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    fontFamily: 'System',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  labelSmall: {
    fontSize: 14,
  },
  icon: {
    fontSize: 16,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
})
