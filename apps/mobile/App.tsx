import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, BackHandler, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter'
import { ThemeProvider, useTheme, elevation, radii, spacing, FONT } from './src/theme'
import { TabIcon } from './src/components/TabIcons'
import type { AuthSession, HomecareVisit, MobileUser, OfflineVisitAction, VisitAction } from './src/types'
import { readSession } from './src/services/storage'
import { getCurrentUser, getMyVisits, login, logout, createDisruption } from './src/services/api'
import { enqueueVisitAction, flushQueue, getQueue } from './src/services/visitQueue'
import { scheduleVisitReminder, registerForPushNotifications, addNotificationListeners, removeNotificationListeners } from './src/services/notifications'
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
import { ReportIncidentScreen } from './src/screens/ReportIncidentScreen'

type TabKey = 'today' | 'schedule' | 'mileage' | 'settings'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'mileage', label: 'Mileage' },
  { key: 'settings', label: 'Settings' },
]

/* ─── Screen stack for Android back button ──────────────────── */
type Screen =
  | { kind: 'incident'; visitId?: string; personId?: string; personName?: string }
  | { kind: 'tabs' }
  | { kind: 'visit'; visit: HomecareVisit }
  | { kind: 'clientDetail'; personId: string }
  | { kind: 'bodyMap'; personId: string; personName: string }
  | { kind: 'nutrition'; personId: string; personName: string }
  | { kind: 'profile' }
  | { kind: 'swap' }

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  )
}

function AppInner() {
  const { colors: c, scheme } = useTheme()
  const [fontsLoaded] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
  })
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
  const pushScreen = useCallback((screen: Screen) => setScreenStack(prev => [...prev, screen]), [])
  const popScreen = useCallback(() => setScreenStack(prev => prev.length <= 1 ? prev : prev.slice(0, -1)), [])

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screenStack.length > 1) { popScreen(); return true }
      return false
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
    } finally { if (refresh) setRefreshing(false) }
  }, [])

  const sync = useCallback(async (activeSession = session) => {
    if (!activeSession) return
    try { await flushQueue(activeSession.accessToken) } catch {}
    await loadQueue()
  }, [loadQueue, session])

  useEffect(() => {
    readSession().then(async stored => {
      if (!stored) { setBooting(false); return }
      try {
        const current = await getCurrentUser(stored.accessToken)
        const active = { ...stored, user: current.user, organization: current.organization }
        setSession(active); await loadQueue(); await loadVisits(active)
        registerForPushNotifications(active.accessToken).catch(() => {})
      } catch { setSession(null) }
      finally { setBooting(false) }
    })
    addNotificationListeners(() => {}, () => {})
    return () => { removeNotificationListeners() }
  }, [loadQueue, loadVisits])

  async function handleLogin(email: string, password: string) {
    setLoginLoading(true); setLoginError('')
    try {
      const active = await login(email, password)
      setSession(active); setTab('today'); setScreenStack([{ kind: 'tabs' }])
      await loadQueue(); await loadVisits(active)
      registerForPushNotifications(active.accessToken).catch(() => {})
    } catch (error: any) { setLoginError(error.message || 'Could not sign in.') }
    finally { setLoginLoading(false) }
  }

  async function handleAction(action: VisitAction, payload: OfflineVisitAction['payload']) {
    if (!session || currentScreen.kind !== 'visit') throw new Error('Session unavailable.')
    await enqueueVisitAction(currentScreen.visit.id, action, payload)
    await loadQueue()
    try { await flushQueue(session.accessToken); await loadQueue(); await loadVisits(session); return { synced: true } }
    catch { return { synced: false } }
  }

  async function handleDisruption(body: Record<string, unknown>) {
    if (!session || currentScreen.kind !== 'visit') throw new Error('Session unavailable.')
    await createDisruption(session.accessToken, currentScreen.visit.id, body)
    await loadVisits(session)
  }

  async function handleSignOut() {
    await logout()
    setSession(null); setVisits([]); setQueue([]); setScreenStack([{ kind: 'tabs' }])
  }

  const user: MobileUser | null = session?.user || null
  const activeQueue = useMemo(() => queue.filter(item => item.state !== 'synced'), [queue])
  const barStyle = scheme === 'dark' ? 'light-content' as const : 'dark-content' as const
  const goBack = popScreen

  /* ─── Tab icon mapping ──────────────────────────────────── */
  const tabIconName: Record<TabKey, 'today' | 'week' | 'mileage' | 'calendar' | 'settings'> = {
    today: 'today', schedule: 'week', mileage: 'mileage', settings: 'settings',
  }

  /* ─── Loading screens ────────────────────────────────────── */
  if (!fontsLoaded || booting) {
    return (
      <SafeAreaView style={[s.boot, { backgroundColor: c.bg }]} edges={['top']}>
        <StatusBar barStyle={barStyle} backgroundColor={c.bg} />
        <View style={s.bootCard}>
          <View style={[s.bootLogo, { backgroundColor: c.primary }]}>
            <Text style={[s.bootLogoText, { color: c.inverse }]}>M</Text>
          </View>
          <ActivityIndicator color={c.primary} style={{ marginTop: spacing.base }} />
          {booting && <Text style={[s.bootText, { color: c.muted }]}>MeticleCare</Text>}
        </View>
      </SafeAreaView>
    )
  }

  /* ─── Login ──────────────────────────────────────────────── */
  if (!session || !user) {
    return (
      <>
        <StatusBar barStyle={barStyle} backgroundColor={c.bg} />
        <LoginScreen onLogin={handleLogin} error={loginError} loading={loginLoading} />
      </>
    )
  }

  /* ─── Sub-screens ────────────────────────────────────────── */
  if (currentScreen.kind === 'bodyMap' && session) {
    return <><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><BodyMapScreen personId={currentScreen.personId} personName={currentScreen.personName} session={session} onBack={goBack} /></>
  }
  if (currentScreen.kind === 'nutrition' && session) {
    return <><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><NutritionScreen personId={currentScreen.personId} personName={currentScreen.personName} session={session} onBack={goBack} /></>
  }
  if (currentScreen.kind === 'clientDetail' && session) {
    return <><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><ClientDetailScreen personId={currentScreen.personId} session={session} onBack={goBack} onBodyMap={(id, name) => pushScreen({ kind: 'bodyMap', personId: id, personName: name })} onNutrition={(id, name) => pushScreen({ kind: 'nutrition', personId: id, personName: name })} /></>
  }
  if (currentScreen.kind === 'visit' && session) {
    // Find next visit after this one
    const sortedVisits = [...visits].sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
    const currentIdx = sortedVisits.findIndex(v => v.id === currentScreen.visit.id)
    const nextV = currentIdx >= 0 && currentIdx < sortedVisits.length - 1 ? sortedVisits[currentIdx + 1] : null
    return <><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><VisitScreen visit={currentScreen.visit} session={session} queue={activeQueue} onBack={goBack} onAction={handleAction} onDisruption={handleDisruption} onClientDetail={(pid) => pushScreen({ kind: 'clientDetail', personId: pid })} onReportIncident={() => pushScreen({ kind: 'incident', visitId: currentScreen.visit.id, personId: currentScreen.visit.person_id, personName: currentScreen.visit.person_name })} nextVisit={nextV} onVisitNext={(v) => pushScreen({ kind: 'visit', visit: v })} /></>
  }
  if (currentScreen.kind === 'profile' && session) {
    return <><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><ProfileScreen session={session} user={user} onBack={goBack} onSaved={() => { goBack(); loadVisits(session) }} /></>
  }
  if (currentScreen.kind === 'swap' && session) {
    return <><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SwapTransferScreen session={session} user={user} visits={visits} onBack={goBack} onRefresh={() => loadVisits(session)} /></>
  }
  if (currentScreen.kind === 'incident' && session) {
    return <><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><ReportIncidentScreen session={session} visitId={currentScreen.visitId} personId={currentScreen.personId} personName={currentScreen.personName} onBack={goBack} onSubmitted={() => { goBack(); loadVisits(session) }} /></>
  }

  /* ─── Main tab view ──────────────────────────────────────── */
  return (
    <>
      <StatusBar barStyle={barStyle} backgroundColor={c.bg} />
      <SafeAreaView style={[s.app, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
        <View style={[s.body, { backgroundColor: c.bg }]}>
          {tab === 'today' && <TodayScreen user={user} visits={visits} queue={activeQueue} onVisit={(v) => pushScreen({ kind: 'visit', visit: v })} onRefresh={() => loadVisits(session, true)} refreshing={refreshing} onSync={() => sync()} />}
          {tab === 'schedule' && <WeekScreen session={session} user={user} onVisit={(v) => pushScreen({ kind: 'visit', visit: v })} onSwap={() => pushScreen({ kind: 'swap' })} />}
          {tab === 'mileage' && <MileageScreen session={session} />}
          {tab === 'settings' && <SettingsScreen user={user} onSignOut={handleSignOut} onSync={() => sync()} onProfile={() => pushScreen({ kind: 'profile' })} onAvailability={() => pushScreen({ kind: 'tabs' })} />}
        </View>

        <View style={[s.tabBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
          {tabs.map(t => (
            <Pressable key={t.key} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: tab === t.key }}
              onPress={() => { setTab(t.key); setScreenStack([{ kind: 'tabs' }]) }}
              style={({ pressed }) => [s.tab, pressed && { opacity: 0.5 }]}
            >
              <TabIcon name={tabIconName[t.key]} size={24} color={tab === t.key ? c.primary : c.subtle} />
              <Text style={[s.tabLabel, { color: tab === t.key ? c.primary : c.subtle }]}>{t.label}</Text>
              {tab === t.key && <View style={[s.tabIndicator, { backgroundColor: c.primary }]} />}
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </>
  )
}

const s = StyleSheet.create({
  app: { flex: 1 },
  body: { flex: 1 },
  tabBar: {
    flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
    paddingTop: spacing.xs,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 2, minHeight: 48 },
  tabLabel: { fontFamily: FONT, fontSize: 10, fontWeight: '500', letterSpacing: 0.2 },
  tabIndicator: { width: 20, height: 2, borderRadius: 1, marginTop: 3 },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bootCard: { alignItems: 'center', gap: spacing.sm },
  bootLogo: { width: 64, height: 64, borderRadius: radii.xl, alignItems: 'center', justifyContent: 'center', ...elevation.md },
  bootLogoText: { fontSize: 32, fontWeight: '800', fontFamily: FONT },
  bootText: { fontFamily: FONT, fontSize: 16, fontWeight: '600', marginTop: spacing.sm },
})
