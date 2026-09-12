import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'
import { colors, elevation, radii, spacing, type } from './src/theme'
import type { AuthSession, HomecareVisit, MobileUser, OfflineVisitAction, VisitAction } from './src/types'
import { readSession } from './src/services/storage'
import { getCurrentUser, getMyVisits, login, logout, createDisruption } from './src/services/api'
import { enqueueVisitAction, flushQueue, getQueue } from './src/services/visitQueue'
import { scheduleVisitReminder } from './src/services/notifications'
import { LoginScreen } from './src/screens/LoginScreen'
import { TodayScreen, dayRange } from './src/screens/TodayScreen'
import { VisitScreen } from './src/screens/VisitScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { AvailabilityScreen } from './src/screens/AvailabilityScreen'
import { ClientDetailScreen } from './src/screens/ClientDetailScreen'
import { MileageScreen } from './src/screens/MileageScreen'

type TabKey = 'today' | 'mileage' | 'availability' | 'settings'

const tabs: { key: TabKey; icon: string; label: string }[] = [
  { key: 'today', icon: '📋', label: 'Today' },
  { key: 'mileage', icon: '🚗', label: 'Mileage' },
  { key: 'availability', icon: '📅', label: 'Availability' },
  { key: 'settings', icon: '⚙️', label: 'Settings' },
]

function AppTab({ icon, label, active, onPress }: { icon: string; label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
    >
      <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
      {active && <View style={styles.tabIndicator} />}
    </Pressable>
  )
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [booting, setBooting] = useState(true)
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [visits, setVisits] = useState<HomecareVisit[]>([])
  const [queue, setQueue] = useState<OfflineVisitAction[]>([])
  const [selectedVisit, setSelectedVisit] = useState<HomecareVisit | null>(null)
  const [tab, setTab] = useState<TabKey>('today')
  const [clientDetail, setClientDetail] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadQueue = useCallback(async () => setQueue(await getQueue()), [])

  const loadVisits = useCallback(async (activeSession: AuthSession, refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const range = dayRange()
      const nextVisits = await getMyVisits(activeSession.accessToken, range.from, range.to)
      setVisits(nextVisits.sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()))
      for (const visit of nextVisits) await scheduleVisitReminder(visit, visit.travel_buffer_minutes || 30)
    } catch (error: any) {
      if (error.status === 401) setSession(null)
    } finally {
      if (refresh) setRefreshing(false)
    }
  }, [])

  const sync = useCallback(async (activeSession = session) => {
    if (!activeSession) return
    try { await flushQueue(activeSession.accessToken) } catch { /* queue remains durable */ }
    await loadQueue()
  }, [loadQueue, session])

  useEffect(() => {
    readSession().then(async stored => {
      if (!stored) { setBooting(false); return }
      try {
        const current = await getCurrentUser(stored.accessToken)
        const active = { ...stored, user: current.user, organization: current.organization }
        setSession(active); await loadQueue(); await loadVisits(active)
      } catch { setSession(null) }
      finally { setBooting(false) }
    })
  }, [loadQueue, loadVisits])

  async function handleLogin(email: string, password: string) {
    setLoginLoading(true); setLoginError('')
    try {
      const active = await login(email, password)
      setSession(active); await loadQueue(); await loadVisits(active)
    } catch (error: any) {
      setLoginError(error.message || 'Could not sign in.')
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleAction(action: VisitAction, payload: OfflineVisitAction['payload']) {
    if (!session || !selectedVisit) throw new Error('Your session is no longer available.')
    const item = await enqueueVisitAction(selectedVisit.id, action, payload)
    await loadQueue()
    try {
      await flushQueue(session.accessToken)
      await loadQueue()
      await loadVisits(session)
      return { synced: true }
    } catch {
      return { synced: false }
    }
  }

  async function handleDisruption(body: Record<string, unknown>) {
    if (!session || !selectedVisit) throw new Error('Your session is no longer available.')
    await createDisruption(session.accessToken, selectedVisit.id, body)
    await loadVisits(session)
  }

  async function handleSignOut() {
    await logout()
    setSession(null); setVisits([]); setQueue([]); setSelectedVisit(null)
  }

  const user: MobileUser | null = session?.user || null
  const activeQueue = useMemo(() => queue.filter(item => item.state !== 'synced'), [queue])

  if (booting) {
    return (
      <SafeAreaView style={styles.boot}>
        <View style={styles.bootCard}>
          <View style={styles.bootLogo}>
            <Text style={styles.bootLogoText}>M</Text>
          </View>
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.base }} />
          <Text style={styles.bootText}>MeticleCare</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!session || !user) {
    return <LoginScreen onLogin={handleLogin} error={loginError} loading={loginLoading} />
  }

  if (clientDetail && session) {
    return <ClientDetailScreen personId={clientDetail} session={session} onBack={() => setClientDetail(null)} />
  }

  if (selectedVisit) {
    return (
      <VisitScreen
        visit={selectedVisit}
        queue={activeQueue}
        onBack={() => setSelectedVisit(null)}
        onAction={handleAction}
        onDisruption={handleDisruption}
        onClientDetail={(personId) => setClientDetail(personId)}
      />
    )
  }

  return (
    <SafeAreaView style={styles.app}>
      <View style={styles.body}>
        {tab === 'today' && (
          <TodayScreen
            user={user}
            visits={visits}
            queue={activeQueue}
            onVisit={setSelectedVisit}
            onRefresh={() => loadVisits(session, true)}
            refreshing={refreshing}
            onSync={() => sync()}
          />
        )}
        {tab === 'mileage' && <MileageScreen session={session} />}
        {tab === 'availability' && <AvailabilityScreen session={session} />}
        {tab === 'settings' && <SettingsScreen user={user} onSignOut={handleSignOut} onSync={() => sync()} />}
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {tabs.map(t => (
          <AppTab
            key={t.key}
            icon={t.icon}
            label={t.label}
            active={tab === t.key}
            onPress={() => setTab(t.key)}
          />
        ))}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },

  /* Tab bar */
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingBottom: Platform.OS === 'ios' ? 8 : 4,
    paddingTop: spacing.sm,
    ...elevation.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    gap: 2,
  },
  tabPressed: { opacity: 0.7 },
  tabIcon: { fontSize: 20, opacity: 0.45 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontFamily: 'System', fontSize: 10, fontWeight: '500', color: colors.subtle },
  tabLabelActive: { color: colors.primary, fontWeight: '600' },
  tabIndicator: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 2,
  },

  /* Boot */
  boot: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  bootCard: { alignItems: 'center', gap: spacing.sm },
  bootLogo: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.md,
  },
  bootLogoText: { color: colors.inverse, fontSize: 28, fontWeight: '800' },
  bootText: { ...type.bodyBold, color: colors.muted, marginTop: spacing.sm },
})
