import { useEffect, useState } from 'react'
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, elevation, radii, spacing, type } from '../theme'
import type { AuthSession } from '../types'
import { getMyVisits } from '../services/api'

interface Props {
  session: AuthSession
}

function money(pence: number | null | undefined) {
  return pence == null ? '—' : `£${(pence / 100).toFixed(2)}`
}

function monthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  return { from: from.toISOString(), to: to.toISOString() }
}

export function MileageScreen({ session }: Props) {
  const [visits, setVisits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const range = monthRange()
      const data = await getMyVisits(session.accessToken, range.from, range.to)
      setVisits(data.filter((v: any) => v.actual_mileage_miles != null && Number(v.actual_mileage_miles) > 0))
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { load() }, [])

  const totalMiles = visits.reduce((s: number, v: any) => s + (Number(v.actual_mileage_miles) || 0), 0)
  const totalPay = visits.reduce((s: number, v: any) => s + ((Number(v.actual_mileage_miles) || 0) * (Number(v.mileage_rate_pence) || 0)), 0)
  const totalTravelMinutes = visits.reduce((s: number, v: any) => s + (Number(v.actual_travel_minutes) || 0), 0)
  const now = new Date()
  const monthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading mileage...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Mileage</Text>
        <Text style={styles.subtitle}>{monthLabel}</Text>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: colors.primary }]}>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>{totalMiles.toFixed(1)}</Text>
            <Text style={styles.summaryLabel}>Total miles</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: colors.success }]}>
            <Text style={[styles.summaryValue, { color: colors.success }]}>{money(totalPay)}</Text>
            <Text style={styles.summaryLabel}>Mileage pay</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: colors.accent }]}>
            <Text style={[styles.summaryValue, { color: colors.accent }]}>{visits.length}</Text>
            <Text style={styles.summaryLabel}>Trips</Text>
          </View>
        </View>

        {totalTravelMinutes > 0 && (
          <View style={styles.travelCard}>
            <Text style={styles.travelLabel}>Total travel time</Text>
            <Text style={styles.travelValue}>{Math.floor(totalTravelMinutes / 60)}h {totalTravelMinutes % 60}m</Text>
          </View>
        )}

        {/* Visit list */}
        {visits.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🚗</Text>
            <Text style={styles.emptyTitle}>No mileage recorded</Text>
            <Text style={styles.emptyCopy}>Mileage appears here after you check in and out of visits with mileage recorded.</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.sectionHead}>VISIT RECORDS</Text>
            {visits
              .sort((a: any, b: any) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())
              .map((v: any) => (
                <View key={v.id} style={styles.visitCard}>
                  <View style={styles.visitHeader}>
                    <View style={styles.visitInfo}>
                      <Text style={styles.visitName}>{v.person_name || 'Client'}</Text>
                      <Text style={styles.visitMeta}>
                        {v.label} · {new Date(v.scheduled_start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    <View style={styles.milesBadge}>
                      <Text style={styles.milesValue}>{Number(v.actual_mileage_miles).toFixed(1)}</Text>
                      <Text style={styles.milesUnit}>mi</Text>
                    </View>
                  </View>
                  <View style={styles.visitDetails}>
                    {v.actual_travel_minutes && (
                      <View style={styles.detailChip}>
                        <Text style={styles.detailText}>🕐 {v.actual_travel_minutes}m travel</Text>
                      </View>
                    )}
                    <View style={styles.detailChip}>
                      <Text style={styles.detailText}>💷 {money(v.mileage_rate_pence)}/mi</Text>
                    </View>
                    <View style={[styles.detailChip, styles.detailChipAccent]}>
                      <Text style={styles.detailTextAccent}>
                        {money((Number(v.actual_mileage_miles) || 0) * (Number(v.mileage_rate_pence) || 0))}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  pageTitle: { ...type.title, marginBottom: spacing.xs },
  subtitle: { ...type.body, color: colors.muted, marginBottom: spacing.base },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { ...type.small },

  /* Summary */
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    ...elevation.sm,
  },
  summaryValue: { fontFamily: 'System', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  summaryLabel: { ...type.small, marginTop: 2 },

  /* Travel */
  travelCard: {
    backgroundColor: colors.primarySurface,
    borderRadius: radii.md,
    padding: spacing.base,
    marginBottom: spacing.base,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '15',
  },
  travelLabel: { ...type.body, color: colors.primary, flex: 1 },
  travelValue: { fontFamily: 'System', fontSize: 16, fontWeight: '700', color: colors.primary },

  /* Empty */
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: spacing.xxl,
  },
  emptyIcon: { fontSize: 32, marginBottom: spacing.md },
  emptyTitle: { ...type.bodyBold, marginBottom: spacing.xs },
  emptyCopy: { ...type.small, textAlign: 'center', paddingHorizontal: spacing.lg },

  /* Visits */
  sectionHead: {
    fontFamily: 'System',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.subtle,
    marginBottom: spacing.sm,
  },
  visitCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.base,
    marginBottom: spacing.sm,
    ...elevation.sm,
  },
  visitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  visitInfo: { flex: 1 },
  visitName: { ...type.bodyBold },
  visitMeta: { ...type.small, marginTop: 2 },
  milesBadge: { alignItems: 'center' },
  milesValue: { fontFamily: 'System', fontSize: 20, fontWeight: '800', color: colors.primary, letterSpacing: -0.3 },
  milesUnit: { fontFamily: 'System', fontSize: 11, fontWeight: '500', color: colors.muted },
  visitDetails: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' },
  detailChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  detailText: { fontFamily: 'System', fontSize: 12, fontWeight: '500', color: colors.muted },
  detailChipAccent: { backgroundColor: colors.successSurface, borderColor: colors.success + '20' },
  detailTextAccent: { fontFamily: 'System', fontSize: 12, fontWeight: '600', color: colors.successDeep },
})
