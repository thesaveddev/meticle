import { useEffect, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, elevation, radii, spacing, type, FONT, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import { SkeletonScreen } from '../components/Skeleton'
import { dyn } from '../utils/dynamicStyles'
import type { AuthSession } from '../types'
import { getMyEarnings } from '../services/api'
import { IconCheck, IconClock, IconMiles, IconWarning } from '../components/Icons'
import { hapticLight } from '../services/haptics'

interface Props {
  session: AuthSession
}

function money(pence: number | null | undefined) {
  return pence == null ? '—' : `£${(Number(pence) / 100).toFixed(2)}`
}

function mins(h: number) {
  const hrs = Math.floor(h / 60)
  const m = h % 60
  return hrs > 0 ? `${hrs}h ${m}m` : `${m}m`
}

function monthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  return { from: from.toISOString(), to: to.toISOString() }
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  completed: { bg: '#DCFCE7', text: '#166534' },
  checked_in: { bg: '#DBEAFE', text: '#1E40AF' },
  scheduled: { bg: '#FEF3C7', text: '#92400E' },
  en_route: { bg: '#E0E7FF', text: '#3730A3' },
  missed: { bg: '#FEE2E2', text: '#991B1B' },
}

export function MileageScreen({ session }: Props) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'completed' | 'upcoming'>('overview')

  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const range = monthRange()
      const earnings = await getMyEarnings(session.accessToken, range.from, range.to)
      setData(earnings)
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false) }
  }

  useEffect(() => { load() }, [])

  const summary = data?.summary || {}
  const completed = (data?.visits || [])
    .filter((v: any) => v.status === 'completed')
    .sort((a: any, b: any) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())
  const scheduled = (data?.scheduled || [])
    .sort((a: any, b: any) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())

  const now = new Date()
  const monthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  if (loading) {
    return (
      <SafeAreaView style={[s.screen, dyn(c).screen]}>
        <SkeletonScreen c={c} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[s.screen, dyn(c).screen]}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="transparent" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={[s.pageTitle, { color: c.ink }]}>Earnings</Text>
        <Text style={[s.subtitle, { color: c.muted }]}>{monthLabel}</Text>

        {/* Gross pay hero */}
        <View style={[s.heroCard, { backgroundColor: c.primary, ...elevation.md }]}>
          <Text style={s.heroLabel}>Estimated gross pay</Text>
          <Text style={s.heroValue}>{money(summary.total_gross_pay_pence)}</Text>
          <View style={s.heroRow}>
            <View style={s.heroStat}>
              <Text style={s.heroStatValue}>{summary.visit_count || 0}</Text>
              <Text style={s.heroStatLabel}>calls completed</Text>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroStatValue}>{mins(summary.total_work_minutes || 0)}</Text>
              <Text style={s.heroStatLabel}>worked</Text>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroStatValue}>{(Number(summary.total_mileage_miles) || 0).toFixed(1)}mi</Text>
              <Text style={s.heroStatLabel}>driven</Text>
            </View>
          </View>
        </View>

        {/* Tab bar */}
        <View style={s.tabBar}>
          {(['overview', 'completed', 'upcoming'] as const).map(tab => (
            <Pressable
              key={tab}
              onPress={() => { hapticLight(); setActiveTab(tab) }}
              style={[s.tab, activeTab === tab && { borderBottomColor: c.primary }]}
            >
              <Text style={[s.tabText, activeTab === tab ? { color: c.primary } : { color: c.muted }]}>
                {tab === 'overview' ? 'Summary' : tab === 'completed' ? `Done (${completed.length})` : `Upcoming (${scheduled.length})`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Overview tab ── */}
        {activeTab === 'overview' && (
          <View>
            {/* Breakdown cards */}
            <Text style={[s.sectionHead, { color: c.subtle }]}>BREAKDOWN</Text>

            <View style={[s.breakdownCard, { backgroundColor: c.surface }]}>
              <View style={s.breakdownRow}>
                <View style={[s.breakdownIcon, { backgroundColor: c.primarySurface }]}>
                  <IconClock size={18} color={c.primary} />
                </View>
                <View style={s.breakdownInfo}>
                  <Text style={[s.breakdownTitle, { color: c.ink }]}>Work hours</Text>
                  <Text style={[s.breakdownSub, { color: c.muted }]}>{mins(summary.total_work_minutes || 0)} at {money(summary.hourly_rate_pence)}/hr</Text>
                </View>
                <Text style={[s.breakdownAmount, { color: c.primary }]}>
                  {money(Math.round(((summary.total_work_minutes || 0) / 60) * Number(summary.hourly_rate_pence || 0)))}
                </Text>
              </View>
            </View>

            {Number(summary.total_paid_travel_minutes || 0) > 0 && (
              <View style={[s.breakdownCard, { backgroundColor: c.surface }]}>
                <View style={s.breakdownRow}>
                  <View style={[s.breakdownIcon, { backgroundColor: c.warningSurface }]}>
                    <IconClock size={18} color={c.warning} />
                  </View>
                  <View style={s.breakdownInfo}>
                    <Text style={[s.breakdownTitle, { color: c.ink }]}>Travel time (paid)</Text>
                    <Text style={[s.breakdownSub, { color: c.muted }]}>{mins(summary.total_paid_travel_minutes || 0)} at {money(summary.hourly_rate_pence)}/hr</Text>
                  </View>
                  <Text style={[s.breakdownAmount, { color: c.warning }]}>
                    {money(Math.round(((summary.total_paid_travel_minutes || 0) / 60) * Number(summary.hourly_rate_pence || 0)))}
                  </Text>
                </View>
              </View>
            )}

            <View style={[s.breakdownCard, { backgroundColor: c.surface }]}>
              <View style={s.breakdownRow}>
                <View style={[s.breakdownIcon, { backgroundColor: c.successSurface }]}>
                  <IconMiles size={18} color={c.success} />
                </View>
                <View style={s.breakdownInfo}>
                  <Text style={[s.breakdownTitle, { color: c.ink }]}>Mileage</Text>
                  <Text style={[s.breakdownSub, { color: c.muted }]}>{(Number(summary.total_mileage_miles) || 0).toFixed(1)} miles at {money(summary.mileage_rate_pence)}/mi</Text>
                </View>
                <Text style={[s.breakdownAmount, { color: c.success }]}>
                  {money(Math.round((Number(summary.total_mileage_miles) || 0) * Number(summary.mileage_rate_pence || 0)))}
                </Text>
              </View>
            </View>

            {Number(summary.total_travel_minutes || 0) > Number(summary.total_paid_travel_minutes || 0) && (
              <View style={[s.breakdownCard, { backgroundColor: c.surface, opacity: 0.6 }]}>
                <View style={s.breakdownRow}>
                  <View style={[s.breakdownIcon, { backgroundColor: c.surfaceAlt }]}>
                    <IconClock size={18} color={c.muted} />
                  </View>
                  <View style={s.breakdownInfo}>
                    <Text style={[s.breakdownTitle, { color: c.ink }]}>Travel time (unpaid)</Text>
                    <Text style={[s.breakdownSub, { color: c.muted }]}>{mins((Number(summary.total_travel_minutes) || 0) - (Number(summary.total_paid_travel_minutes) || 0))}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Rates summary */}
            <View style={[s.ratesCard, { backgroundColor: c.surfaceAlt }]}>
              <Text style={[s.ratesTitle, { color: c.ink }]}>Your rates</Text>
              <View style={s.ratesRow}>
                <View style={s.rateItem}>
                  <Text style={[s.rateLabel, { color: c.muted }]}>Hourly</Text>
                  <Text style={[s.rateValue, { color: c.ink }]}>{money(summary.hourly_rate_pence)}</Text>
                </View>
                <View style={s.rateItem}>
                  <Text style={[s.rateLabel, { color: c.muted }]}>Mileage</Text>
                  <Text style={[s.rateValue, { color: c.ink }]}>{money(summary.mileage_rate_pence)}/mi</Text>
                </View>
                <View style={s.rateItem}>
                  <Text style={[s.rateLabel, { color: c.muted }]}>Travel paid</Text>
                  <Text style={[s.rateValue, { color: c.ink }]}>{summary.total_paid_travel_minutes > 0 ? 'Yes' : 'No'}</Text>
                </View>
              </View>
            </View>

            {/* Projected upcoming */}
            {Number(summary.scheduled_count || 0) > 0 && (
              <View style={[s.projectedCard, { backgroundColor: c.primarySurface, borderColor: c.primary + '15' }]}>
                <Text style={[s.projectedTitle, { color: c.primary }]}>Upcoming this month</Text>
                <View style={s.projectedRow}>
                  <Text style={[s.projectedValue, { color: c.primary }]}>{summary.scheduled_count} scheduled calls</Text>
                  <Text style={[s.projectedAmount, { color: c.primary }]}>≈ {money(summary.projected_gross_pay_pence)}</Text>
                </View>
                <Text style={[s.projectedNote, { color: c.muted }]}>Projected from scheduled visits</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Completed tab ── */}
        {activeTab === 'completed' && (
          <View>
            {completed.length === 0 ? (
              <View style={s.emptyCard}>
                <IconCheck size={32} color={c.subtle} />
                <Text style={[s.emptyTitle, { color: c.ink }]}>No completed calls yet</Text>
                <Text style={[s.emptyCopy, { color: c.muted }]}>Your completed calls and their pay will appear here.</Text>
              </View>
            ) : (
              completed.map((v: any) => {
                const sc = STATUS_COLORS[v.status] || STATUS_COLORS.completed
                return (
                  <View key={v.id} style={[s.visitCard, { backgroundColor: c.surface }]}>
                    <View style={s.visitHeader}>
                      <View style={s.visitInfo}>
                        <Text style={[s.visitName, { color: c.ink }]}>{v.person_name || 'Client'}</Text>
                        <Text style={[s.visitMeta, { color: c.muted }]}>
                          {v.label} · {new Date(v.scheduled_start).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </Text>
                      </View>
                      <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[s.statusText, { color: sc.text }]}>Completed</Text>
                      </View>
                    </View>
                    <View style={s.visitChips}>
                      {v.work_minutes != null && (
                        <View style={[s.chip, { backgroundColor: c.surfaceAlt }]}>
                          <IconClock size={12} color={c.muted} />
                          <Text style={[s.chipText, { color: c.muted }]}>{mins(v.work_minutes)} work</Text>
                        </View>
                      )}
                      {Number(v.mileage_miles) > 0 && (
                        <View style={[s.chip, { backgroundColor: c.successSurface }]}>
                          <IconMiles size={12} color={c.success} />
                          <Text style={[s.chipText, { color: c.successDeep }]}>{Number(v.mileage_miles).toFixed(1)} mi</Text>
                        </View>
                      )}
                    </View>
                    <View style={[s.visitPayRow, { borderTopColor: c.borderLight }]}>
                      <Text style={[s.visitPayLabel, { color: c.muted }]}>Gross pay</Text>
                      <Text style={[s.visitPayAmount, { color: c.ink }]}>{money(v.gross_pay_pence)}</Text>
                    </View>
                  </View>
                )
              })
            )}
          </View>
        )}

        {/* ── Upcoming tab ── */}
        {activeTab === 'upcoming' && (
          <View>
            {scheduled.length === 0 ? (
              <View style={s.emptyCard}>
                <IconClock size={32} color={c.subtle} />
                <Text style={[s.emptyTitle, { color: c.ink }]}>No upcoming calls</Text>
                <Text style={[s.emptyCopy, { color: c.muted }]}>Your scheduled calls for this month will appear here.</Text>
              </View>
            ) : (
              scheduled.map((v: any) => {
                const start = new Date(v.scheduled_start)
                const end = new Date(v.scheduled_end)
                const dur = Math.round((end.getTime() - start.getTime()) / 60000)
                const workPay = Math.round((dur / 60) * Number(v.hourly_rate_pence || 0))
                return (
                  <View key={v.id} style={[s.visitCard, { backgroundColor: c.surface }]}>
                    <View style={s.visitHeader}>
                      <View style={s.visitInfo}>
                        <Text style={[s.visitName, { color: c.ink }]}>{v.person_name || 'Client'}</Text>
                        <Text style={[s.visitMeta, { color: c.muted }]}>
                          {v.label} · {start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      <View style={[s.statusBadge, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[s.statusText, { color: '#92400E' }]}>Scheduled</Text>
                      </View>
                    </View>
                    <View style={s.visitChips}>
                      <View style={[s.chip, { backgroundColor: c.surfaceAlt }]}>
                        <IconClock size={12} color={c.muted} />
                        <Text style={[s.chipText, { color: c.muted }]}>{mins(dur)} call</Text>
                      </View>
                    </View>
                    <View style={[s.visitPayRow, { borderTopColor: c.borderLight }]}>
                      <Text style={[s.visitPayLabel, { color: c.muted }]}>Est. pay</Text>
                      <Text style={[s.visitPayAmount, { color: c.primary }]}>{money(workPay)}</Text>
                    </View>
                  </View>
                )
              })
            )}
          </View>
        )}

        {/* Empty state for no data at all */}
        {!loading && completed.length === 0 && scheduled.length === 0 && (
          <View style={[s.emptyCard, { marginTop: spacing.lg }]}>
            <IconWarning size={32} color={c.subtle} />
            <Text style={[s.emptyTitle, { color: c.ink }]}>No earnings data</Text>
            <Text style={[s.emptyCopy, { color: c.muted }]}>Your earnings will appear here after you complete calls.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },

  /* Header */
  pageTitle: { ...type.title, marginBottom: spacing.xs },
  subtitle: { ...type.body, marginBottom: spacing.base },

  /* Hero card */
  heroCard: {
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.base,
  },
  heroLabel: { fontFamily: FONT, fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.7)', marginBottom: spacing.xs },
  heroValue: { fontFamily: 'System', fontSize: 36, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1, marginBottom: spacing.base },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontFamily: FONT, fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  heroStatLabel: { fontFamily: FONT, fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  heroDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },

  /* Tabs */
  tabBar: { flexDirection: 'row', marginBottom: spacing.base, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },

  /* Section */
  sectionHead: {
    fontFamily: 'System', fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    textTransform: 'uppercase' as const, marginBottom: spacing.sm,
  },

  /* Breakdown */
  breakdownCard: {
    borderRadius: radii.md, padding: spacing.base, marginBottom: spacing.sm, ...elevation.sm,
  },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  breakdownIcon: { width: 36, height: 36, borderRadius: radii.sm, alignItems: 'center', justifyContent: 'center' },
  breakdownInfo: { flex: 1 },
  breakdownTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '600' },
  breakdownSub: { fontFamily: FONT, fontSize: 12, marginTop: 1 },
  breakdownAmount: { fontFamily: 'System', fontSize: 16, fontWeight: '700' },

  /* Rates */
  ratesCard: { borderRadius: radii.md, padding: spacing.base, marginBottom: spacing.base },
  ratesTitle: { fontFamily: FONT, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm },
  ratesRow: { flexDirection: 'row', gap: spacing.base },
  rateItem: { flex: 1 },
  rateLabel: { fontFamily: FONT, fontSize: 11, fontWeight: '500', marginBottom: 2 },
  rateValue: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },

  /* Projected */
  projectedCard: { borderRadius: radii.md, padding: spacing.base, marginBottom: spacing.base, borderWidth: 1 },
  projectedTitle: { fontFamily: FONT, fontSize: 13, fontWeight: '600', marginBottom: spacing.xs },
  projectedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  projectedValue: { fontFamily: FONT, fontSize: 14, fontWeight: '500' },
  projectedAmount: { fontFamily: 'System', fontSize: 16, fontWeight: '700' },
  projectedNote: { fontFamily: FONT, fontSize: 11, marginTop: spacing.xs },

  /* Empty */
  emptyCard: {
    backgroundColor: colors.surface, borderRadius: radii.lg,
    padding: spacing.xxl, alignItems: 'center', ...elevation.sm,
  },
  emptyTitle: { ...type.bodyBold, marginTop: spacing.md, marginBottom: spacing.xs },
  emptyCopy: { ...type.small, textAlign: 'center', paddingHorizontal: spacing.lg },

  /* Visit cards */
  visitCard: { borderRadius: radii.lg, padding: spacing.base, marginBottom: spacing.sm, ...elevation.sm },
  visitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  visitInfo: { flex: 1, marginRight: spacing.sm },
  visitName: { fontFamily: FONT, fontSize: 15, fontWeight: '600' },
  visitMeta: { fontFamily: FONT, fontSize: 12, marginTop: 2 },
  statusBadge: { borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 4 },
  statusText: { fontFamily: FONT, fontSize: 11, fontWeight: '600' },
  visitChips: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  chipText: { fontFamily: FONT, fontSize: 11, fontWeight: '500' },
  visitPayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1 },
  visitPayLabel: { fontFamily: FONT, fontSize: 12, fontWeight: '500' },
  visitPayAmount: { fontFamily: 'System', fontSize: 16, fontWeight: '700' },
})
