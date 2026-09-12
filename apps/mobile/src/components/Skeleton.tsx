import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { colors, radii, spacing } from '../theme'

interface SkeletonProps {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: any
}

export function Skeleton({ width = '100%', height = 16, borderRadius = radii.sm, style }: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 1000, easing: Easing.ease, useNativeDriver: false }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, easing: Easing.ease, useNativeDriver: false }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] })

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as any, height, borderRadius, opacity },
        style,
      ]}
    />
  )
}

/* ─── Composite skeletons for common patterns ────────────────── */

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.card}>
      <Skeleton width="60%" height={16} />
      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} height={12} width={i === lines - 1 ? '70%' : '100%'} />
        ))}
      </View>
    </View>
  )
}

export function SkeletonVisitRow() {
  return (
    <View style={styles.visitRow}>
      <View style={styles.visitTime}>
        <Skeleton width={44} height={14} />
        <Skeleton width={30} height={10} />
      </View>
      <View style={styles.visitContent}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="50%" height={12} />
        <Skeleton width="80%" height={10} />
      </View>
    </View>
  )
}

export function SkeletonStatRow() {
  return (
    <View style={styles.statRow}>
      {[1, 2, 3].map(i => (
        <View key={i} style={styles.statCard}>
          <Skeleton width={40} height={24} />
          <Skeleton width={50} height={10} />
        </View>
      ))}
    </View>
  )
}

export function SkeletonClientCard() {
  return (
    <View style={styles.card}>
      <Skeleton width="50%" height={20} />
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
        <Skeleton width={60} height={20} borderRadius={radii.full} />
        <Skeleton width={80} height={20} borderRadius={radii.full} />
      </View>
      <Skeleton width="40%" height={12} style={{ marginTop: spacing.sm }} />
    </View>
  )
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  visitRow: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: spacing.md,
  },
  visitTime: { width: 52, gap: 4 },
  visitContent: { flex: 1, gap: 6 },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
})
