import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme, spacing, radii, elevation, FONT } from '../theme'
import type { AuthSession } from '../types'
import {
  getDashboardStats,
  getDashboardTodayRota,
  getDashboardWidgets,
  type DashboardStats,
  type DashboardWidgets,
  type TodayRotaShift,
} from '../services/api'
import { hapticLight } from '../services/haptics'
import { livingServiceLabel } from '../utils/serviceType'

/**
 * The supported-living manager's home — the first item of the blueprint's phase 4.
 *
 * The Team tab used to mount `ManagerDashboard`, which is the domiciliary one: it
 * asks `/homecare/visits`, `/homecare/staff` and `/homecare/exceptions`, and for a
 * supported-living provider those are empty by definition. A manager opened the
 * phone and read "0 completed, 0 missed, 0% cover" — an app telling the person
 * responsible for the service that nothing was happening, on the strength of a
 * table their model of care does not write to.
 *
 * This reads the supported-living dashboard endpoints instead (`/dashboard/stats`,
 * `/dashboard/widgets`, `/dashboard/today-rota`), which the API only serves to
 * supported-living and residential organisations — so the shell picks this screen
 * by service model, not by hoping.
 *
 * Three deliberate shapes:
 *
 *  * **A failed load is an error with a retry, never a zero.** The domiciliary
 *    screen swallowed failures into empty arrays, which is how "0% compliance"
 *    became indistinguishable from "we could not ask". Stats and the attention
 *    list fail independently: one can be shown while the other says it could not
 *    load.
 *  * **The attention list is only what somebody can act on**, ordered by how badly
 *    it hurts a CQC inspection: severe incidents, overdue medication, staff below
 *    the compliance threshold, expiring checks and training, leave waiting. Rows
 *    that open a screen in this app are tappable; rows that do not are plain text,
 *    because a tap that does nothing is worse than a sentence that does not invite
 *    one.
 *  * **The rota is today's, read from the shifts themselves** — the same query the
 *    web dashboard's rota panel uses — so the phone and the desk cannot disagree.
 */
type Props = {
  session: AuthSession
  /** Same contract as `ManagerDashboard`: App owns the stack and the tabs. */
  onNavigate?: (screen: string, params?: any) => void
}

function timeOfDay(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function staffList(assigned: string): string[] {
  return (assigned || '')
    .split(',')
    .map(name => name.trim())
    .filter(Boolean)
}

export function SupportedLivingDashboard({ session, onNavigate }: Props) {
  const { colors: c } = useTheme()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [widgets, setWidgets] = useState<DashboardWidgets | null>(null)
  const [rota, setRota] = useState<TodayRotaShift[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [statsError, setStatsError] = useState('')
  const [widgetsError, setWidgetsError] = useState('')
  const [rotaError, setRotaError] = useState('')

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    const [statsResult, widgetsResult, rotaResult] = await Promise.allSettled([
      getDashboardStats(session.accessToken),
      getDashboardWidgets(session.accessToken),
      getDashboardTodayRota(session.accessToken),
    ])

    if (statsResult.status === 'fulfilled') { setStats(statsResult.value); setStatsError('') }
    else setStatsError('Your figures could not be loaded.')

    if (widgetsResult.status === 'fulfilled') { setWidgets(widgetsResult.value); setWidgetsError('') }
    else setWidgetsError('What needs attention could not be loaded.')

    if (rotaResult.status === 'fulfilled') { setRota(rotaResult.value); setRotaError('') }
    else setRotaError("Today's rota could not be loaded.")

    setLoading(false)
    setRefreshing(false)
  }, [session.accessToken])

  useEffect(() => { load() }, [load])

  // The day changes under a manager who leaves the app open on a desk.
  useEffect(() => {
    const interval = setInterval(() => load(), 60000)
    return () => clearInterval(interval)
  }, [load])

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const firstName = session.user.first_name || session.user.email.split('@')[0]
  // Residential providers reach the same endpoints (`requireSupportedLivingOnly`
  // covers both), so the badge says which model it is rather than guessing.
  const serviceLabel = livingServiceLabel(session.organization)

  /**
   * The rows worth interrupting someone for. Each carries the screen it opens, if
   * this app has one; a null destination is a fact, not a broken button.
   */
  const attention = useMemo(() => {
    if (!widgets) return []
    const rows: { key: string; label: string; detail: string; count: number; to?: string }[] = [
      { key: 'severe', label: 'Severe incidents open', detail: 'Reported or under investigation', count: widgets.open_severe_incidents, to: 'allVisits' },
      { key: 'meds', label: 'Medication overdue', detail: 'Scheduled more than 30 minutes ago', count: widgets.overdue_medications },
      { key: 'below', label: 'Staff below compliance threshold', detail: 'Fewer than the required records complete', count: widgets.staff_below_threshold, to: 'staffDirectory' },
      { key: 'checks', label: 'Background checks expiring', detail: 'Within the next 30 days', count: widgets.dbs_expiring_soon, to: 'staffDirectory' },
      { key: 'training', label: 'Training expiring', detail: 'Within the next 30 days', count: widgets.training_expiring_soon, to: 'staffDirectory' },
      { key: 'leave', label: 'Leave waiting for a decision', detail: 'Requests nobody has approved or refused', count: widgets.pending_leave_requests },
    ]
    return rows.filter(row => row.count > 0)
  }, [widgets])

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: c.bg }]}>
        <View style={styles.centre}><ActivityIndicator size="large" color={c.primary} /></View>
      </View>
    )
  }

  const onDuty = stats ? `${stats.staff_on_duty}/${stats.total_staff}` : '—'
  const compliance = stats ? `${Math.round(stats.compliance_rate)}%` : '—'

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={c.primary} />}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pageTitle, { color: c.ink }]}>Dashboard</Text>
            <Text style={[styles.subtitle, { color: c.muted }]} numberOfLines={1}>
              {today} · {firstName}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: c.primarySurface }]}>
            <Text style={[styles.badgeText, { color: c.primary }]}>{serviceLabel}</Text>
          </View>
        </View>

        {statsError ? (
          <View style={[styles.errorCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
            <Text style={[styles.errorText, { color: c.danger }]}>{statsError}</Text>
            <Pressable accessibilityRole="button" onPress={() => { setStatsError(''); load() }} style={[styles.retry, { borderColor: c.border }]}>
              <Text style={[styles.retryText, { color: c.primary }]}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.heroCard, { backgroundColor: c.primary }, elevation.md]}>
            <View style={styles.heroRow}>
              <View style={styles.heroStat}>
                <Text style={[styles.heroValue, { color: c.inverse }]}>{compliance}</Text>
                <Text style={[styles.heroLabel, { color: c.inverse }]}>Compliance</Text>
              </View>
              <View style={[styles.heroDivider, { backgroundColor: c.inverse }]} />
              <View style={styles.heroStat}>
                <Text style={[styles.heroValue, { color: c.inverse }]}>{onDuty}</Text>
                <Text style={[styles.heroLabel, { color: c.inverse }]}>On duty</Text>
              </View>
              <View style={[styles.heroDivider, { backgroundColor: c.inverse }]} />
              <View style={styles.heroStat}>
                <Text style={[styles.heroValue, { color: c.inverse }]}>{stats?.active_people ?? '—'}</Text>
                <Text style={[styles.heroLabel, { color: c.inverse }]}>Residents</Text>
              </View>
              <View style={[styles.heroDivider, { backgroundColor: c.inverse }]} />
              <View style={styles.heroStat}>
                <Text style={[styles.heroValue, { color: c.inverse }]}>{stats?.open_shifts ?? '—'}</Text>
                <Text style={[styles.heroLabel, { color: c.inverse }]}>Open shifts</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={[styles.sectionLabel, { color: c.subtle }]}>NEEDS ATTENTION</Text>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
          {widgetsError ? (
            <Text style={[styles.errorText, { color: c.danger }]}>{widgetsError}</Text>
          ) : attention.length === 0 ? (
            <Text style={[styles.emptyText, { color: c.muted }]}>
              Nothing overdue. Severe incidents, medication rounds, staff compliance, expiring checks and leave
              requests all read clear.
            </Text>
          ) : (
            attention.map((row, index) => (
              <Pressable
                key={row.key}
                accessibilityRole={row.to ? 'button' : undefined}
                accessibilityLabel={row.to ? `${row.label}: ${row.count}` : undefined}
                disabled={!row.to}
                onPress={() => { if (row.to) { hapticLight(); onNavigate?.(row.to) } }}
                style={[styles.attentionRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderLight }]}
              >
                <View style={[styles.countChip, { backgroundColor: c.dangerSurface }]}>
                  <Text style={[styles.countChipText, { color: c.danger }]}>{row.count}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: c.ink }]}>{row.label}</Text>
                  <Text style={[styles.rowDetail, { color: c.muted }]}>{row.detail}</Text>
                </View>
                {row.to ? <Ionicons name="chevron-forward" size={18} color={c.subtle} /> : null}
              </Pressable>
            ))
          )}
        </View>

        <Text style={[styles.sectionLabel, { color: c.subtle }]}>TODAY'S ROTA</Text>
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
          {rotaError ? (
            <Text style={[styles.errorText, { color: c.danger }]}>{rotaError}</Text>
          ) : !rota || rota.length === 0 ? (
            <Text style={[styles.emptyText, { color: c.muted }]}>
              No shifts on the rota today. If that is a surprise, the rota is where to look — not this card.
            </Text>
          ) : (
            rota.map((shift, index) => {
              const staff = staffList(shift.assigned_staff)
              return (
                <View
                  key={shift.id}
                  style={[styles.rotaRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderLight }]}
                >
                  <View style={styles.rotaTimes}>
                    <Text style={[styles.rotaTime, { color: c.ink }]}>{timeOfDay(shift.start_time)}</Text>
                    <Text style={[styles.rotaTimeEnd, { color: c.muted }]}>{timeOfDay(shift.end_time)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: c.ink }]}>{shift.location_name}</Text>
                    <Text style={[styles.rowDetail, { color: staff.length > 0 ? c.muted : c.danger }]} numberOfLines={2}>
                      {staff.length > 0 ? staff.join(', ') : 'Nobody rostered'}
                    </Text>
                  </View>
                </View>
              )
            })
          )}
        </View>

        <Text style={[styles.sectionLabel, { color: c.subtle }]}>GO TO</Text>
        <View style={styles.actions}>
          {[
            { key: 'clients', label: 'Residents', icon: 'people-outline' as const },
            { key: 'allVisits', label: 'Visits', icon: 'calendar-outline' as const },
            { key: 'staffDirectory', label: 'Staff', icon: 'id-card-outline' as const },
            { key: 'timesheets', label: 'Timesheets', icon: 'time-outline' as const },
          ].map(action => (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => { hapticLight(); onNavigate?.(action.key) }}
              style={({ pressed }) => [
                styles.actionCard,
                { backgroundColor: c.surface, borderColor: c.borderLight },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name={action.icon} size={22} color={c.primary} />
              <Text style={[styles.actionLabel, { color: c.ink }]}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  pageTitle: { fontFamily: FONT, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontFamily: FONT, fontSize: 13, fontWeight: '500', marginTop: 2 },
  badge: { borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: 4 },
  badgeText: { fontFamily: FONT, fontSize: 11, fontWeight: '700' },
  heroCard: { borderRadius: radii.lg, padding: spacing.md },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center', gap: 2 },
  heroDivider: { width: StyleSheet.hairlineWidth, height: 28, opacity: 0.35 },
  heroValue: { fontFamily: FONT, fontSize: 20, fontWeight: '800' },
  heroLabel: { fontFamily: FONT, fontSize: 10, fontWeight: '600', opacity: 0.85 },
  sectionLabel: { fontFamily: FONT, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: spacing.lg, marginBottom: spacing.xs },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.md, padding: spacing.sm },
  attentionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
  countChip: { minWidth: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countChipText: { fontFamily: FONT, fontSize: 13, fontWeight: '800' },
  rowTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '600' },
  rowDetail: { fontFamily: FONT, fontSize: 12, fontWeight: '500', marginTop: 1 },
  emptyText: { fontFamily: FONT, fontSize: 13, lineHeight: 19, padding: spacing.sm },
  errorText: { fontFamily: FONT, fontSize: 13, lineHeight: 19, padding: spacing.sm },
  errorCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.md, padding: spacing.sm, alignItems: 'flex-start', gap: spacing.sm },
  retry: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
  retryText: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  rotaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
  rotaTimes: { width: 56, gap: 1 },
  rotaTime: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },
  rotaTimeEnd: { fontFamily: FONT, fontSize: 12, fontWeight: '500' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionCard: {
    flexGrow: 1, flexBasis: '47%', borderWidth: StyleSheet.hairlineWidth, borderRadius: radii.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.sm, alignItems: 'center', gap: spacing.xs,
  },
  actionLabel: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
})
