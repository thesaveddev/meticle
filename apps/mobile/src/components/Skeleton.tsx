import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { colors, radii, spacing, useAppColors } from '../theme'

interface SkeletonProps {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: any
}

/** A single skeleton bone — animated pulse rectangle */
export function Skeleton({ width, height = 14, borderRadius = radii.sm, style }: SkeletonProps) {
  const c = useAppColors()
  const pulse = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: c.border, opacity: pulse },
        style,
      ]}
    />
  )
}

/** Skeleton for a visit card */
export function SkeletonVisitCard({ c }: { c: any }) {
  return (
    <View style={[skStyles.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
      <View style={skStyles.cardRow}>
        <View style={skStyles.timeCol}>
          <Skeleton width={40} height={14} borderRadius={4} />
          <Skeleton width={30} height={10} borderRadius={4} style={{ marginTop: 4 }} />
        </View>
        <View style={skStyles.cardContent}>
          <Skeleton width="70%" height={16} borderRadius={4} />
          <Skeleton width="50%" height={12} borderRadius={4} style={{ marginTop: 6 }} />
          <Skeleton width="90%" height={10} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
        <Skeleton width={20} height={20} borderRadius={10} />
      </View>
    </View>
  )
}

/** Full-page skeleton for screens */
export function SkeletonScreen({ c }: { c: any }) {
  return (
    <View style={[skStyles.page, { backgroundColor: c.bg }]}>
      {/* Header skeleton */}
      <View style={skStyles.headerRow}>
        <Skeleton width={120} height={14} borderRadius={4} />
      </View>
      <Skeleton width={200} height={26} borderRadius={4} style={{ marginBottom: spacing.base }} />

      {/* Card skeleton */}
      <View style={[skStyles.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
        <Skeleton width="60%" height={16} borderRadius={4} />
        <Skeleton width="40%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
        <Skeleton width="80%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
      </View>

      {/* List skeleton */}
      {[1, 2, 3].map(i => (
        <SkeletonVisitCard key={i} c={c} />
      ))}
    </View>
  )
}

/** Skeleton for a calendar grid */
export function SkeletonCalendar({ c }: { c: any }) {
  return (
    <View style={[skStyles.page, { backgroundColor: c.bg }]}>
      <View style={skStyles.calHeader}>
        <Skeleton width={36} height={36} borderRadius={18} />
        <Skeleton width={160} height={20} borderRadius={4} />
        <Skeleton width={36} height={36} borderRadius={18} />
      </View>
      <View style={skStyles.calGrid}>
        {[...Array(35)].map((_, i) => (
          <Skeleton key={i} width={36} height={36} borderRadius={18} style={{ margin: 2 }} />
        ))}
      </View>
      {[1, 2].map(i => (
        <SkeletonVisitCard key={i} c={c} />
      ))}
    </View>
  )
}

/** Inline loading skeleton for modals */
export function SkeletonInline({ c }: { c: any }) {
  return (
    <View style={skStyles.inline}>
      {[1, 2, 3].map(i => (
        <View key={i} style={[skStyles.card, { backgroundColor: c.surface, borderColor: c.borderLight, marginBottom: spacing.sm }]}>
          <Skeleton width="80%" height={14} borderRadius={4} />
          <Skeleton width="50%" height={10} borderRadius={4} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  )
}

const skStyles = StyleSheet.create({
  page: { flex: 1, padding: spacing.base },
  headerRow: { marginBottom: spacing.sm },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.base },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.base },
  card: {
    borderRadius: radii.lg, borderWidth: 1, padding: spacing.base,
    marginBottom: spacing.sm,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  timeCol: { alignItems: 'center', minWidth: 48 },
  cardContent: { flex: 1 },
  inline: { paddingVertical: spacing.sm },
})
