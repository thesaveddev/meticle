import { useEffect, useState, useCallback } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, elevation, radii, spacing, type, FONT, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import { dyn } from '../utils/dynamicStyles'
import type { AuthSession } from '../types'
import { getManagerDashboard } from '../services/api'
import { IconCheck, IconClock, IconWarning, IconIncident } from '../components/Icons'
import { hapticLight } from '../services/haptics'

interface Props {
  session: AuthSession
  onNavigate?: (screen: string, params?: any) => void
}

function time(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function todayRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString()
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
  return { from, to }
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  scheduled: { bg: '#FEF3C7', text: '#92400E', label: 'Scheduled' },
  en_route: { bg: '#DBEAFE', text: '#1E40AF', label: 'En route' },
  checked_in: { bg: '#D1FAE5', text: '#065F46', label: 'Checked in' },
  completed: { bg: '#DCFCE7', text: '#166534', label: 'Done' },
  missed: { bg: '#FEE2E2', text: '#991B1B', label: 'Missed' },
  cancelled: { bg: '#F3F4F6', text: '#6B7280', label: 'Cancelled' },
}

export function ManagerDashboard({ session, onNavigate }: Props) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const range = todayRange()
      const result = await getManagerDashboard(session.accessToken, range.from, range.to)
      setData(result)
    } catch {} finally { setLoading(false); setRefreshing(false) }
  }, [session.accessToken])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => load(), 30000)
    return () => clearInterval(interval)
  }, [load])

  const visits = data?.visits || []
  const exceptions = data?.exceptions || []
  const staff = data?.staff || []
  const disruptions = data?.disruptions || []

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  // Compute stats
  const completed = visits.filter((v: any) => v.status === 'completed')
  const inProgress = visits.filter((v: any) => ['checked_in', 'en_route'].includes(v.status))
  const missed = visits.filter((v: any) => v.status === 'missed')
  const scheduled = visits.filter((v: any) => v.status === 'scheduled')
  const totalCalls = visits.length
  const completionRate = totalCalls > 0 ? Math.round((completed.length / totalCalls) * 100) : 0

  // Carers working today
  const carersWorking = [...new Set(visits.filter((v: any) => v.assigned_staff_name).map((v: any) => v.assigned_staff_name))]

  if (loading) {
    return (
      <SafeAreaView style={[s.screen, dyn(c).screen]} edges={['top']}>
        <View style={s.loadingWrap}><ActivityIndicator size="large" color={c.primary} /></View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[s.screen, dyn(c).screen]} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="transparent" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={[s.pageTitle, { color: c.ink }]}>Dashboard</Text>
            <Text style={[s.subtitle, { color: c.muted }]}>{today}</Text>
          </View>
          <View style={[s.roleBadge, { backgroundColor: c.primarySurface }]}>
            <Text style={[s.roleText, { color: c.primary }]}>Manager</Text>
          </View>
        </View>

        {/* Hero stats */}
        <View style={[s.heroCard, { backgroundColor: c.primary, ...elevation.md }]}>
          <View style={s.heroRow}>
            <View style={s.heroStat}>
              <Text style={s.heroStatValue}>{completed.length}</Text>
              <Text style={s.heroStatLabel}>Completed</Text>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroStatValue}>{inProgress.length}</Text>
              <Text style={s.heroStatLabel}>In progress</Text>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroStatValue}>{missed.length}</Text>
              <Text style={s.heroStatLabel}>Missed</Text>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroStatValue}>{completionRate}%</Text>
              <Text style={s.heroStatLabel}>Cover rate</Text>
            </View>
          </View>
        </View>

        {/* Coverage bar */}
        <View style={[s.coverageCard, { backgroundColor: c.surface }]}>
          <View style={s.coverageHeader}>
            <Text style={[s.coverageTitle, { color: c.ink }]}>Today's coverage</Text>
            <Text style={[s.coveragePct, { color: completionRate >= 80 ? c.success : completionRate >= 50 ? c.warning : c.danger }]}>{completionRate}%</Text>
          </View>
          <View style={[s.coverageTrack, { backgroundColor: c.surfaceAlt }]}>
            <View style={[s.coverageFill, { width: `${completionRate}%`, backgroundColor: completionRate >= 80 ? c.success : completionRate >= 50 ? c.warning : c.danger }]} />
          </View>
          <View style={s.coverageLabels}>
            <Text style={[s.coverageLabel, { color: c.muted }]}>{completed.length} done</Text>
            <Text style={[s.coverageLabel, { color: c.muted }]}>{inProgress.length} active</Text>
            <Text style={[s.coverageLabel, { color: c.muted }]}>{scheduled.length} pending</Text>
            <Text style={[s.coverageLabel, { color: c.muted }]}>{missed.length} missed</Text>
          </View>
        </View>

        {/* Alerts */}
        {(missed.length > 0 || exceptions.length > 0 || disruptions.length > 0) && (
          <View style={s.alertSection}>
            <Text style={[s.sectionHead, { color: c.subtle }]}>ALERTS</Text>

            {missed.length > 0 && (
              <Pressable
                onPress={() => onNavigate?.('allVisits', { status: 'missed' })}
                style={({ pressed }) => [[s.alertCard, { backgroundColor: c.dangerSurface || '#FEE2E2', borderColor: (c.danger || '#DC2626') + '20' }, pressed && { opacity: 0.8 }]]}
              >
                <View style={[s.alertIcon, { backgroundColor: c.danger || '#DC2626' }]}>
                  <IconWarning size={16} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertTitle, { color: c.danger || '#991B1B' }]}>{missed.length} missed {missed.length === 1 ? 'call' : 'calls'}</Text>
                  <Text style={[s.alertSub, { color: c.muted }]}>{missed.map((v: any) => v.person_name || 'Client').join(', ')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.danger || '#991B1B'} />
              </Pressable>
            )}

            {exceptions.length > 0 && (
              <Pressable
                onPress={() => onNavigate?.('allVisits', { status: 'exception' })}
                style={({ pressed }) => [[s.alertCard, { backgroundColor: c.warningSurface, borderColor: c.warning + '20' }, pressed && { opacity: 0.8 }]]}
              >
                <View style={[s.alertIcon, { backgroundColor: c.warning }]}>
                  <IconIncident size={16} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertTitle, { color: c.warning }]}>{exceptions.length} open {exceptions.length === 1 ? 'exception' : 'exceptions'}</Text>
                  <Text style={[s.alertSub, { color: c.muted }]}>Needs resolution</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.warning} />
              </Pressable>
            )}

            {disruptions.length > 0 && (
              <Pressable
                onPress={() => onNavigate?.('allVisits', { status: 'disruption' })}
                style={({ pressed }) => [[s.alertCard, { backgroundColor: c.warningSurface, borderColor: c.warning + '20' }, pressed && { opacity: 0.8 }]]}
              >
                <View style={[s.alertIcon, { backgroundColor: c.warning }]}>
                  <IconClock size={16} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.alertTitle, { color: c.warning }]}>{disruptions.length} disruption{disruptions.length > 1 ? 's' : ''} reported</Text>
                  <Text style={[s.alertSub, { color: c.muted }]}>Traffic, weather, or other</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={c.warning} />
              </Pressable>
            )}
          </View>
        )}

        {/* Carers working today */}
        {carersWorking.length > 0 && (
          <View>
            <Text style={[s.sectionHead, { color: c.subtle }]}>CARERS TODAY</Text>
            <View style={[s.card, { backgroundColor: c.surface }]}>
              {carersWorking.map((name: any, i: number) => {
                const carerVisits = visits.filter((v: any) => v.assigned_staff_name === name)
                const carerCompleted = carerVisits.filter((v: any) => v.status === 'completed').length
                const carerActive = carerVisits.filter((v: any) => ['checked_in', 'en_route'].includes(v.status)).length
                return (
                  <Pressable
                    key={name}
                    onPress={() => onNavigate?.('allVisits', { staffName: name })}
                    style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md, borderBottomWidth: i < carersWorking.length - 1 ? 1 : 0, borderBottomColor: c.borderLight }, pressed && { backgroundColor: c.surfaceAlt }]}
                  >
                    <View style={[s.carerAvatar, { backgroundColor: getAvatarColor(name) }]}>
                      <Text style={s.carerAvatarText}>{name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.carerName, { color: c.ink }]}>{name}</Text>
                      <Text style={[s.carerMeta, { color: c.muted }]}>
                        {carerVisits.length} {carerVisits.length === 1 ? 'call' : 'calls'}
                        {carerCompleted > 0 ? ` · ${carerCompleted} done` : ''}
                        {carerActive > 0 ? ` · ${carerActive} active` : ''}
                      </Text>
                    </View>
                    <View style={s.carerCalls}>
                      {carerCompleted === carerVisits.length ? (
                        <View style={[s.carerDone, { backgroundColor: c.successSurface }]}>
                          <IconCheck size={14} color={c.success} />
                        </View>
                      ) : (
                        <Text style={[s.carerCount, { color: c.muted }]}>{carerCompleted}/{carerVisits.length}</Text>
                      )}
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}

        {/* Quick actions */}
        <View>
          <Text style={[s.sectionHead, { color: c.subtle }]}>QUICK ACTIONS</Text>
          <View style={s.actionsGrid}>
            {[
              { icon: 'people-outline', label: 'Clients', screen: 'clientList', color: c.primary },
              { icon: 'calendar-outline', label: 'All visits', screen: 'allVisits', color: c.success },
              { icon: 'people-circle-outline', label: 'Staff', screen: 'staffDirectory', color: c.primary },
              { icon: 'document-text-outline', label: 'Timesheets', screen: 'timesheets', color: c.warning },
            ].map(action => (
              <Pressable
                key={action.screen}
                onPress={() => { hapticLight(); onNavigate?.(action.screen) }}
                style={({ pressed }) => [[s.actionCard, { backgroundColor: c.surface }, pressed && { opacity: 0.8 }]]}
              >
                <View style={[s.actionIcon, { backgroundColor: action.color + '15' }]}>
                  <Ionicons name={action.icon as any} size={22} color={action.color} />
                </View>
                <Text style={[s.actionLabel, { color: c.ink }]}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function getAvatarColor(name: string) {
  const AVATAR_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.base },
  pageTitle: { ...type.title, marginBottom: spacing.xs },
  subtitle: { ...type.body },
  roleBadge: { borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: 4 },
  roleText: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },

  /* Hero */
  heroCard: { borderRadius: radii.lg, padding: spacing.xl, marginBottom: spacing.base },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontFamily: 'System', fontSize: 24, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  heroStatLabel: { fontFamily: FONT, fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  heroDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)' },

  /* Coverage */
  coverageCard: { borderRadius: radii.lg, padding: spacing.base, marginBottom: spacing.base, ...elevation.sm },
  coverageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  coverageTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '600' },
  coveragePct: { fontFamily: 'System', fontSize: 20, fontWeight: '800' },
  coverageTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: spacing.sm },
  coverageFill: { height: '100%', borderRadius: 4 },
  coverageLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  coverageLabel: { fontFamily: FONT, fontSize: 11, fontWeight: '500' },

  /* Alerts */
  alertSection: { marginBottom: spacing.base },
  alertCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: radii.md,
    padding: spacing.md, gap: spacing.md, marginBottom: spacing.sm, borderWidth: 1,
  },
  alertIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '600' },
  alertSub: { fontFamily: FONT, fontSize: 12, marginTop: 1 },

  /* Carers */
  card: { borderRadius: radii.lg, ...elevation.sm, overflow: 'hidden' },
  carerAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  carerAvatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', fontFamily: FONT },
  carerName: { fontFamily: FONT, fontSize: 15, fontWeight: '600' },
  carerMeta: { fontFamily: FONT, fontSize: 12, marginTop: 2 },
  carerCalls: { alignItems: 'center' },
  carerDone: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  carerCount: { fontFamily: 'System', fontSize: 14, fontWeight: '600' },

  /* Section */
  sectionHead: {
    fontFamily: 'System', fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    textTransform: 'uppercase' as const, marginBottom: spacing.sm, marginTop: spacing.sm,
  },

  /* Actions */
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionCard: {
    width: '48%', borderRadius: radii.lg, padding: spacing.base, alignItems: 'center',
    gap: spacing.sm, ...elevation.sm,
  },
  actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
})
