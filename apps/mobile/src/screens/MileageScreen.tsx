import { useEffect, useState } from 'react'
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, commonStyles, radii, spacing, type } from '../theme'
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
      <SafeAreaView style={commonStyles.screen}>
        <View style={styles.loading}><ActivityIndicator color={colors.navy} /><Text style={styles.loadingText}>Loading mileage...</Text></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={commonStyles.screen}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.navy} />}>
        <Text style={type.title}>Mileage</Text>
        <Text style={styles.subtitle}>{monthLabel}</Text>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: colors.navy }]}>{totalMiles.toFixed(1)}</Text>
            <Text style={styles.summaryLabel}>Total miles</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: colors.emeraldDeep }]}>{money(totalPay)}</Text>
            <Text style={styles.summaryLabel}>Mileage pay</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: colors.ink }]}>{visits.length}</Text>
            <Text style={styles.summaryLabel}>Trips</Text>
          </View>
        </View>

        {totalTravelMinutes > 0 && (
          <View style={styles.travelCard}>
            <Text style={styles.travelLabel}>Total travel time this month</Text>
            <Text style={styles.travelValue}>{Math.floor(totalTravelMinutes / 60)}h {totalTravelMinutes % 60}m</Text>
          </View>
        )}

        {/* Visit list */}
        {visits.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No mileage recorded this month</Text>
            <Text style={styles.emptyCopy}>Mileage appears here after you check in and out of visits with mileage recorded.</Text>
          </View>
        ) : (
          <View style={styles.visitList}>
            <Text style={styles.listTitle}>Visit records</Text>
            {visits.sort((a: any, b: any) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime()).map((v: any) => (
              <View key={v.id} style={styles.visitCard}>
                <View style={styles.visitHeader}>
                  <Text style={styles.visitName}>{v.person_name || 'Client'}</Text>
                  <Text style={styles.visitMiles}>{Number(v.actual_mileage_miles).toFixed(1)} mi</Text>
                </View>
                <Text style={styles.visitMeta}>{v.label} · {new Date(v.scheduled_start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                <View style={styles.visitDetails}>
                  {v.actual_travel_minutes && <Text style={styles.visitDetail}>Travel: {v.actual_travel_minutes}m</Text>}
                  <Text style={styles.visitDetail}>Rate: {money(v.mileage_rate_pence)}/mi</Text>
                  <Text style={[styles.visitDetail, { color: colors.emeraldDeep, fontWeight: '600' }]}>Pay: {money((Number(v.actual_mileage_miles) || 0) * (Number(v.mileage_rate_pence) || 0))}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  content: { ...commonStyles.content, paddingTop: spacing.lg },
  subtitle: { ...type.body, color: colors.mist, marginTop: spacing.xs, marginBottom: spacing.lg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { ...type.caption, color: colors.mist },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  summaryCard: { flex: 1, backgroundColor: colors.paper, borderRadius: radii.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.hairline },
  summaryValue: { ...type.title, fontSize: 22 },
  summaryLabel: { ...type.caption, color: colors.mist, marginTop: 2 },
  travelCard: { backgroundColor: '#E0F2FE', borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  travelLabel: { ...type.body, color: '#0F4C81', flex: 1 },
  travelValue: { ...type.bodyStrong, color: '#0F4C81' },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl * 2 },
  emptyTitle: { ...type.bodyStrong, color: colors.ink, marginBottom: spacing.xs },
  emptyCopy: { ...type.caption, color: colors.mist, textAlign: 'center', paddingHorizontal: spacing.xl },
  visitList: { marginTop: spacing.md },
  listTitle: { ...type.bodyStrong, color: colors.ink, marginBottom: spacing.sm },
  visitCard: { backgroundColor: colors.paper, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.hairline },
  visitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  visitName: { ...type.bodyStrong, color: colors.ink },
  visitMiles: { ...type.bodyStrong, color: colors.navy, fontSize: 16 },
  visitMeta: { ...type.caption, color: colors.mist, marginTop: 2 },
  visitDetails: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' },
  visitDetail: { ...type.caption, color: colors.mist },
})
