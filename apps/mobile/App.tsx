import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, BackHandler, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
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
import { BodyMapScreen } from './src/screens/BodyMapScreen'
import { NutritionScreen } from './src/screens/NutritionScreen'
import { ProfileScreen } from './src/screens/ProfileScreen'
import { WeekScreen } from './src/screens/WeekScreen'
import { SwapTransferScreen } from './src/screens/SwapTransferScreen'

type TabKey = 'today' | 'week' | 'mileage' | 'availability' | 'settings'

const tabs: { key: TabKey; icon: string; label: string }[] = [
  { key: 'today', icon: '📋', label: 'Today' },
  { key: 'week', icon: '📆', label: 'Week' },
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

/* ─── Screen stack for Android back button ──────────────────── */
type Screen =
  | { kind: 'tabs' }
  | { kind: 'visit'; visit: HomecareVisit }
  | { kind: 'clientDetail'; personId: string }
  | { kind: 'bodyMap'; personId: string; personName: string }
  | { kind: 'nutrition'; personId: string; personName: string }
  | { kind: 'profile' }
  | { kind: 'swap' }

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [booting, setBooting] = useState(true)
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [visits, setVisits] = useState<HomecareVisit[]>([])
  const [queue, setQueue] = useState<OfflineVisitAction[]>([])
  const [tab, setTab] = useState<TabKey>('today')
  const [refreshing, setRefreshing] = useState(false)
  const [screenStack, setScreenStack] = useState<Screen[]>([{ kind: 'tabs' }])

  const currentScreen = screenStack[screenStack.length - 1]

  const pushScreen = useCallback((screen: Screen) => {
    setScreenStack(prev => [...prev, screen])
  }, [])

  const popScreen = useCallback(() => {
    setScreenStack(prev => {
      if (prev.length <= 1) return prev
      return prev.slice(0, -1)
    })
  }, [])

  // Android hardware back button
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screenStack.length > 1) {
        popScreen()
        return true // handled — don't close app
      }
      return false // let default behavior (minimize app)
    })
    return () => handler.remove()
  }, [screenStack.length, popScreen])

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
    if (!session || currentScreen.kind !== 'visit') throw new Error('Your session is no longer available.')
    const item = await enqueueVisitAction(currentScreen.visit.id, action, payload)
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
    if (!session || currentScreen.kind !== 'visit') throw new Error('Your session is no longer available.')
    await createDisruption(session.accessToken, currentScreen.visit.id, body)
    await loadVisits(session)
  }

  async function handleSignOut() {
    await logout()
    setSession(null); setVisits([]); setQueue([]); setScreenStack([{ kind: 'tabs' }])
  }

  const user: MobileUser | null = session?.user || null
  const activeQueue = useMemo(() => queue.filter(item => item.state !== 'synced'), [queue])

  /* ─── Boot ─────────────────────────────────────────────────── */
  if (booting) {
    return (
      <SafeAreaView style={styles.boot} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
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

  /* ─── Login ─────────────────────────────────────────────────── */
  if (!session || !user) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <LoginScreen onLogin={handleLogin} error={loginError} loading={loginLoading} />
      </>
    )
  }

  /* ─── Render current screen ──────────────────────────────────── */
  const goBack = popScreen

  if (currentScreen.kind === 'bodyMap' && session) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <BodyMapScreen personId={currentScreen.personId} personName={currentScreen.personName} session={session} onBack={goBack} />
      </>
    )
  }

  if (currentScreen.kind === 'nutrition' && session) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <NutritionScreen personId={currentScreen.personId} personName={currentScreen.personName} session={session} onBack={goBack} />
      </>
    )
  }

  if (currentScreen.kind === 'clientDetail' && session) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <ClientDetailScreen
          personId={currentScreen.personId}
          session={session}
          onBack={goBack}
          onBodyMap={(id, name) => pushScreen({ kind: 'bodyMap', personId: id, personName: name })}
          onNutrition={(id, name) => pushScreen({ kind: 'nutrition', personId: id, personName: name })}
        />
      </>
    )
  }

  if (currentScreen.kind === 'visit' && session) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <VisitScreen
          visit={currentScreen.visit}
          queue={activeQueue}
          onBack={goBack}
          onAction={handleAction}
          onDisruption={handleDisruption}
          onClientDetail={(personId) => pushScreen({ kind: 'clientDetail', personId })}
        />
      </>
    )
  }

  if (currentScreen.kind === 'profile' && session) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <ProfileScreen session={session} user={user} onBack={goBack} onSaved={() => { goBack(); loadVisits(session) }} />
      </>
    )
  }

  if (currentScreen.kind === 'swap' && session) {
    return (
      <>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <SwapTransferScreen session={session} user={user} visits={visits} onBack={goBack} onRefresh={() => loadVisits(session)} />
      </>
    )
  }

  /* ─── Main tab view ──────────────────────────────────────────── */
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <SafeAreaView style={styles.app} edges={['top', 'left', 'right']}>
        <View style={styles.body}>
          {tab === 'today' && (
            <TodayScreen
              user={user}
              visits={visits}
              queue={activeQueue}
              onVisit={(v) => pushScreen({ kind: 'visit', visit: v })}
              onRefresh={() => loadVisits(session, true)}
              refreshing={refreshing}
              onSync={() => sync()}
            />
          )}
          {tab === 'week' && (
            <WeekScreen
              session={session}
              user={user}
              onVisit={(v) => pushScreen({ kind: 'visit', visit: v })}
              onSwap={() => pushScreen({ kind: 'swap' })}
            />
          )}
          {tab === 'mileage' && <MileageScreen session={session} />}
          {tab === 'availability' && <AvailabilityScreen session={session} />}
          {tab === 'settings' && (
            <SettingsScreen
              user={user}
              onSignOut={handleSignOut}
              onSync={() => sync()}
              onProfile={() => pushScreen({ kind: 'profile' })}
            />
          )}
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {tabs.map(t => (
            <AppTab
              key={t.key}
              icon={t.icon}
              label={t.label}
              active={tab === t.key}
              onPress={() => { setTab(t.key); setScreenStack([{ kind: 'tabs' }]) }}
            />
          ))}
        </View>
      </SafeAreaView>
    </>
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
