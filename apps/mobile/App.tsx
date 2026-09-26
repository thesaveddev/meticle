import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, BackHandler, Platform, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold } from '@expo-google-fonts/inter'
import { ThemeProvider, useTheme, spacing, FONT } from './src/theme'
import { TabIcon } from './src/components/TabIcons'
import MeticleSplashScreen from './src/components/MeticleSplashScreen'
import { Ionicons } from '@expo/vector-icons'
import { hapticLight, hapticMedium } from './src/services/haptics'
import type { AuthSession, HomecareVisit, MobileUser, OfflineVisitAction, VisitAction } from './src/types'
import { readSession, clearSession } from './src/services/storage'
import { getCurrentUser, getMyVisits, login, logout, createDisruption, getUnreadNotificationCount, getChatUnread, selfDeactivate } from './src/services/api'
import { enqueueVisitAction, flushQueue, getQueue } from './src/services/visitQueue'
import { scheduleVisitReminder, registerForPushNotifications, addNotificationListeners, removeNotificationListeners, getLaunchNotification } from './src/services/notifications'
import { LoginScreen } from './src/screens/LoginScreen'
import { TodayScreen, dayRange } from './src/screens/TodayScreen'
import { VisitScreen } from './src/screens/VisitScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'
import { LearnScreen } from './src/screens/LearnScreen'
import { AvailabilityScreen } from './src/screens/AvailabilityScreen'
import { AnnualLeaveScreen } from './src/screens/AnnualLeaveScreen'
import { ClientDetailScreen } from './src/screens/ClientDetailScreen'
import { MileageScreen } from './src/screens/MileageScreen'
import { BodyMapScreen } from './src/screens/BodyMapScreen'
import { NutritionScreen } from './src/screens/NutritionScreen'
import { ProfileScreen } from './src/screens/ProfileScreen'
import { WeekScreen } from './src/screens/WeekScreen'
import { SwapTransferScreen } from './src/screens/SwapTransferScreen'
import { ReportIncidentScreen } from './src/screens/ReportIncidentScreen'
import { ChatScreen } from './src/screens/ChatScreen'
import { NotificationsScreen } from './src/screens/NotificationsScreen'
import { ManagerDashboard } from './src/screens/ManagerDashboard'
import { ClientListScreen } from './src/screens/ClientListScreen'
import { AllVisitsScreen } from './src/screens/AllVisitsScreen'
import { StaffDirectoryScreen } from './src/screens/StaffDirectoryScreen'
import { TimesheetsScreen } from './src/screens/TimesheetsScreen'
import { CarerTotalsScreen } from './src/screens/CarerTotalsScreen'
import { RideShareScreen } from './src/screens/RideShareScreen'
import { SwipeBack } from './src/components/SwipeBack'
import { EmergencyButton, organisationSosContacts } from './src/components/EmergencyButton'

type TabKey = 'today' | 'schedule' | 'chat' | 'mileage' | 'settings' | 'team' | 'clients' | 'visits'

/** Provides the status-bar inset for stack screens that render their own root View. */
function SubScreenFrame({ children, backgroundColor, contacts = [] }: { children: ReactNode; backgroundColor: string; contacts?: ReturnType<typeof organisationSosContacts> }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={['top', 'left', 'right', 'bottom']}>
      {children}
      <EmergencyButton contacts={contacts} />
    </SafeAreaView>
  )
}

function EmergencyLayer({ children, contacts }: { children: ReactNode; contacts: ReturnType<typeof organisationSosContacts> }) {
  return <View style={{ flex: 1 }}>{children}<EmergencyButton contacts={contacts} /></View>
}

const carerTabs: { key: TabKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'chat', label: 'Chat' },
  { key: 'mileage', label: 'Earnings' },
  { key: 'settings', label: 'Settings' },
]

const managerTabs: { key: TabKey; label: string }[] = [
  { key: 'today', label: 'Team' },
  { key: 'clients', label: 'Clients' },
  { key: 'visits', label: 'Visits' },
  { key: 'chat', label: 'Chat' },
  { key: 'settings', label: 'Settings' },
]

/* ─── Screen stack for Android back button ──────────────────── */
type Screen =
  | { kind: 'incident'; visitId?: string; personId?: string; personName?: string }
  | { kind: 'tabs' }
  | { kind: 'visit'; visit: HomecareVisit }
  | { kind: 'clientDetail'; personId: string }
  | { kind: 'clientSection'; personId: string; section: 'overview' | 'care' | 'risks' | 'meds' | 'records' | 'personal' | 'contacts' }
  | { kind: 'bodyMap'; personId: string; personName: string }
  | { kind: 'nutrition'; personId: string; personName: string }
  | { kind: 'profile' }
  | { kind: 'availability' }
  | { kind: 'annualLeave' }
  | { kind: 'swap'; mode?: 'swap' | 'transfer'; visitId?: string }
  | { kind: 'chat' }
  | { kind: 'notifications' }
  | { kind: 'allVisits'; status?: string; staffName?: string; staffId?: string }
  | { kind: 'staffDirectory' }
  | { kind: 'timesheets' }
  | { kind: 'carerTotals' }
  | { kind: 'rideShare'; visit?: HomecareVisit }
  | { kind: 'learn' }

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppInner />
      </ThemeProvider>
    </SafeAreaProvider>
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
  const [unreadCount, setUnreadCount] = useState(0)
  const [chatUnreadCount, setChatUnreadCount] = useState(0)

  const isManager = session?.user?.role === 'ORG_ADMIN' || session?.user?.role === 'MANAGER'
  const tabs = isManager ? managerTabs : carerTabs
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

  // Organisation SOS contacts, taken from the session so the emergency sheet
  // still has them when the device is offline.
  const sosContacts = useMemo(() => organisationSosContacts(session?.organization), [session?.organization])

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
        // If the stored access token had expired, that call refreshed it and
        // rewrote the session. Use the new token rather than the stale one, so
        // the app does not burn another single-use refresh token on the very
        // next request.
        const live = (await readSession()) || stored
        const active = { ...live, user: current.user, organization: current.organization }
        setSession(active); await loadQueue(); await loadVisits(active)
        registerForPushNotifications(active.accessToken).catch(() => {})
        getUnreadNotificationCount(active.accessToken).then(setUnreadCount).catch(() => {})
        getChatUnread(active.accessToken).then(counts => setChatUnreadCount(Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0))).catch(() => {})
      } catch { setSession(null) }
      finally { setBooting(false) }
    })
    return () => { removeNotificationListeners() }
  }, [loadQueue, loadVisits])

  /* ─── Notification taps ───────────────────────────────────── */
  // A tapped notification should take the carer to the thing it is about.
  // Previously a tap only cleared the chat badge, and a notification that
  // launched the app was ignored entirely.
  const openFromNotification = useCallback((data: Record<string, any> | null) => {
    if (!data) return
    const visitId = data.visitId as string | undefined
    if (visitId) {
      const target = visits.find(v => v.id === visitId)
      if (target) { setScreenStack([{ kind: 'tabs' }, { kind: 'visit', visit: target }]); return }
    }
    if (data.type === 'chat' || data.channelId) {
      setTab('chat')
      setScreenStack([{ kind: 'tabs' }])
    }
  }, [visits])

  // A notification that launched the app is delivered once the session exists
  // and the day's visits are loaded, otherwise the target visit is not known.
  const launchHandled = useRef(false)
  useEffect(() => {
    if (launchHandled.current || !session?.accessToken || visits.length === 0) return
    launchHandled.current = true
    getLaunchNotification().then(openFromNotification).catch(() => {})
  }, [session?.accessToken, visits.length, openFromNotification])


  // Keep push registration and chat notification handling tied to the authenticated session.
  useEffect(() => {
    if (!session?.accessToken) return
    let disposed = false
    addNotificationListeners((type, _data) => {
      if (type !== 'chat' || disposed) return
      hapticMedium()
      setChatUnreadCount(count => count + 1)
    }, (_type, data) => {
      setChatUnreadCount(0)
      openFromNotification(data)
    })
    return () => { disposed = true; removeNotificationListeners() }
  }, [session?.accessToken, openFromNotification])

  useEffect(() => {
    if (!session?.accessToken) return
    const interval = setInterval(() => {
      getChatUnread(session.accessToken)
        .then(counts => setChatUnreadCount(Object.values(counts).reduce((sum, count) => sum + Number(count || 0), 0)))
        .catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [session?.accessToken])

  // Poll unread notification count every 30 seconds
  useEffect(() => {
    if (!session?.accessToken) return
    const interval = setInterval(() => {
      getUnreadNotificationCount(session.accessToken).then(setUnreadCount).catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [session?.accessToken])

  // Refresh the bell badge when returning to the tabs, so it reflects what the
  // carer has actually read rather than the count they arrived with.
  useEffect(() => {
    if (!session?.accessToken || currentScreen.kind !== 'tabs') return
    getUnreadNotificationCount(session.accessToken).then(setUnreadCount).catch(() => {})
  }, [currentScreen.kind, session?.accessToken])

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
    // Visit evidence that has not reached the server yet would be destroyed by
    // signing out, because the queue lives behind the session. Try to sync
    // first and make the carer choose knowingly if anything is left.
    if (session?.accessToken) {
      await flushQueue(session.accessToken).catch(() => null)
      const stranded = (await getQueue()).filter(item => item.state !== 'synced').length
      if (stranded > 0) {
        const proceed = await new Promise<boolean>(resolve => {
          Alert.alert(
            `${stranded} action${stranded === 1 ? '' : 's'} not yet saved`,
            'These are visit check-ins or check-outs that have not reached the server. Signing out now will lose them.',
            [
              { text: 'Keep me signed in', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Sign out anyway', style: 'destructive', onPress: () => resolve(true) },
            ],
            { cancelable: true, onDismiss: () => resolve(false) },
          )
        })
        if (!proceed) { await loadQueue(); return }
      }
    }
    await logout()
    setSession(null); setVisits([]); setQueue([]); setScreenStack([{ kind: 'tabs' }])
  }

  /** Deactivates the signed-in account, then signs out. Wired to Settings. */
  const handleDeleteAccount = useCallback(async () => {
    if (!session?.accessToken) return
    await selfDeactivate(session.accessToken)
    await clearSession()
    setSession(null); setVisits([]); setQueue([]); setScreenStack([{ kind: 'tabs' }])
  }, [session?.accessToken])

  const user: MobileUser | null = session?.user || null
  const activeQueue = useMemo(() => queue.filter(item => item.state !== 'synced'), [queue])
  const barStyle = scheme === 'dark' ? 'light-content' as const : 'dark-content' as const
  const goBack = popScreen

  /* ─── Tab icon mapping ──────────────────────────────────── */
  const tabIconName: Record<TabKey, 'today' | 'week' | 'chat' | 'mileage' | 'calendar' | 'settings'> = {
    today: 'today', schedule: 'week', chat: 'chat', mileage: 'mileage', settings: 'settings',
    team: 'today', clients: 'week', visits: 'calendar',
  }

  /* ─── Loading screens ────────────────────────────────────── */
  // The branded splash takes over as soon as React Native mounts and continues
  // the native launch screen: same centred logo, with the wave layers drifting
  // underneath. It stands in for the old generic "M" boot card, so it shows
  // exactly while fonts and the session bootstrap are pending and never again
  // during navigation. It adds no minimum on-screen time.
  if (!fontsLoaded || booting) {
    return (
      <View style={s.boot}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <MeticleSplashScreen />
      </View>
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
    return <EmergencyLayer contacts={sosContacts}><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SwipeBack onBack={goBack}><BodyMapScreen personId={currentScreen.personId} personName={currentScreen.personName} session={session} onBack={goBack} /></SwipeBack></EmergencyLayer>
  }
  if (currentScreen.kind === 'nutrition' && session) {
    return <EmergencyLayer contacts={sosContacts}><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SwipeBack onBack={goBack}><NutritionScreen personId={currentScreen.personId} personName={currentScreen.personName} session={session} onBack={goBack} /></SwipeBack></EmergencyLayer>
  }
  if (currentScreen.kind === 'clientDetail' && session) {
    return <><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SubScreenFrame backgroundColor={c.bg} contacts={sosContacts}><SwipeBack onBack={goBack}><ClientDetailScreen personId={currentScreen.personId} session={session} onBack={goBack} onBodyMap={(id, name) => pushScreen({ kind: 'bodyMap', personId: id, personName: name })} onNutrition={(id, name) => pushScreen({ kind: 'nutrition', personId: id, personName: name })} onOpenSection={(id, section) => pushScreen({ kind: 'clientSection', personId: id, section })} /></SwipeBack></SubScreenFrame></>
  }
  if (currentScreen.kind === 'clientSection' && session) {
    return <><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SubScreenFrame backgroundColor={c.bg} contacts={sosContacts}><SwipeBack onBack={goBack}><ClientDetailScreen personId={currentScreen.personId} session={session} onBack={goBack} initialTab={currentScreen.section} sectionOnly onBodyMap={(id, name) => pushScreen({ kind: 'bodyMap', personId: id, personName: name })} onNutrition={(id, name) => pushScreen({ kind: 'nutrition', personId: id, personName: name })} /></SwipeBack></SubScreenFrame></>
  }
  if (currentScreen.kind === 'visit' && session) {
    // Find next visit after this one
    const sortedVisits = [...visits].sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
    const currentIdx = sortedVisits.findIndex(v => v.id === currentScreen.visit.id)
    const nextV = currentIdx >= 0 && currentIdx < sortedVisits.length - 1 ? sortedVisits[currentIdx + 1] : null
    return <EmergencyLayer contacts={sosContacts}><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SwipeBack onBack={goBack}><VisitScreen visit={currentScreen.visit} session={session} queue={activeQueue} onBack={goBack} onAction={handleAction} onDisruption={handleDisruption} onClientDetail={(pid) => pushScreen({ kind: 'clientDetail', personId: pid })} onReportIncident={() => pushScreen({ kind: 'incident', visitId: currentScreen.visit.id, personId: currentScreen.visit.person_id, personName: currentScreen.visit.person_name })} onSwap={() => pushScreen({ kind: 'swap', mode: 'swap' })} onTransfer={() => pushScreen({ kind: 'swap', mode: 'transfer', visitId: currentScreen.visit.id })} onRideShare={() => pushScreen({ kind: 'rideShare', visit: currentScreen.visit })} nextVisit={nextV} onVisitNext={(v) => pushScreen({ kind: 'visit', visit: v })} /></SwipeBack></EmergencyLayer>
  }
  if (currentScreen.kind === 'availability' && session) {
    return <EmergencyLayer contacts={sosContacts}><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SwipeBack onBack={goBack}><AvailabilityScreen session={session} onBack={goBack} /></SwipeBack></EmergencyLayer>
  }
  if (currentScreen.kind === 'annualLeave' && session) {
    return <EmergencyLayer contacts={sosContacts}><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SwipeBack onBack={goBack}><AnnualLeaveScreen session={session} onBack={goBack} /></SwipeBack></EmergencyLayer>
  }
  if (currentScreen.kind === 'profile' && session) {
    return <EmergencyLayer contacts={sosContacts}><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SwipeBack onBack={goBack}><ProfileScreen session={session} user={user} onBack={goBack} onSaved={() => { goBack(); loadVisits(session) }} /></SwipeBack></EmergencyLayer>
  }
  if (currentScreen.kind === 'swap' && session) {
    return <EmergencyLayer contacts={sosContacts}><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SwipeBack onBack={goBack}><SwapTransferScreen session={session} user={user} visits={visits} initialRequestType={currentScreen.mode} initialVisitId={currentScreen.visitId} onBack={goBack} onRefresh={() => loadVisits(session)} /></SwipeBack></EmergencyLayer>
  }
  if (currentScreen.kind === 'incident' && session) {
    return <EmergencyLayer contacts={sosContacts}><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SwipeBack onBack={goBack}><ReportIncidentScreen session={session} visitId={currentScreen.visitId} personId={currentScreen.personId} personName={currentScreen.personName} onBack={goBack} onSubmitted={() => { goBack(); loadVisits(session) }} /></SwipeBack></EmergencyLayer>
  }
  if (currentScreen.kind === 'chat' && session) {
    return <><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SubScreenFrame backgroundColor={c.bg} contacts={sosContacts}><SwipeBack onBack={goBack}><ChatScreen session={session} onBack={goBack} /></SwipeBack></SubScreenFrame></>
  }
  if (currentScreen.kind === 'notifications' && session) {
    return <><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SubScreenFrame backgroundColor={c.bg} contacts={sosContacts}><SwipeBack onBack={goBack}><NotificationsScreen session={session} onBack={goBack} /></SwipeBack></SubScreenFrame></>
  }
  if (currentScreen.kind === 'allVisits' && session) {
    return <EmergencyLayer contacts={sosContacts}><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SwipeBack onBack={goBack}><AllVisitsScreen session={session} onBack={goBack} initialStatus={currentScreen.status} initialStaffName={currentScreen.staffName} initialStaffId={currentScreen.staffId} onSelect={(visit) => {
      if (visit) { popScreen(); pushScreen({ kind: 'visit', visit }) }
    }} /></SwipeBack></EmergencyLayer>
  }
  if (currentScreen.kind === 'staffDirectory' && session) {
    return <EmergencyLayer contacts={sosContacts}><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SwipeBack onBack={goBack}><StaffDirectoryScreen session={session} onBack={goBack} /></SwipeBack></EmergencyLayer>
  }
  if (currentScreen.kind === 'timesheets' && session) {
    return <><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SubScreenFrame backgroundColor={c.bg} contacts={sosContacts}><SwipeBack onBack={goBack}><TimesheetsScreen session={session} onBack={goBack} /></SwipeBack></SubScreenFrame></>
  }
  if (currentScreen.kind === 'carerTotals' && session) {
    return <><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SubScreenFrame backgroundColor={c.bg} contacts={sosContacts}><SwipeBack onBack={goBack}><CarerTotalsScreen session={session} onBack={goBack} /></SwipeBack></SubScreenFrame></>
  }
  if (currentScreen.kind === 'rideShare' && session) {
    return <EmergencyLayer contacts={sosContacts}><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SwipeBack onBack={goBack}><RideShareScreen session={session} currentVisit={currentScreen.visit} onBack={goBack} /></SwipeBack></EmergencyLayer>
  }
  if (currentScreen.kind === 'learn' && session) {
    const isDomiciliary = (session.organization?.service_types || []).some(type => ['domiciliary', 'live_in'].includes(type))
    return <><StatusBar barStyle={barStyle} backgroundColor={c.bg} /><SubScreenFrame backgroundColor={c.bg} contacts={sosContacts}><SwipeBack onBack={goBack}><LearnScreen user={user} isDomiciliary={isDomiciliary} onBack={goBack} /></SwipeBack></SubScreenFrame></>
  }

  /* ─── Main tab view ──────────────────────────────────────── */
  return (
    <>
      <StatusBar barStyle={barStyle} backgroundColor={c.bg} />
      <SafeAreaView style={[s.app, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
        {/* Header with notification bell */}
        <View style={[s.header, { backgroundColor: c.bg }]}>  
          <View style={{ flex: 1 }} />
          {/* The badge tracks the server's unread count, so it is not cleared on
              open — marking notifications read is what brings it down. */}
          <Pressable
            onPress={() => { hapticLight(); pushScreen({ kind: 'notifications' }) }}
            style={s.notifBtn}
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
          >
            <Ionicons name={unreadCount > 0 ? 'notifications' : 'notifications-outline'} size={24} color={c.ink} />
            {unreadCount > 0 && (
              <View style={[s.notifBadge, { backgroundColor: c.danger, borderColor: c.bg }]}>
                <Text style={[s.notifBadgeText, { color: c.inverse }]}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
              </View>
            )}
          </Pressable>
        </View>
        <View style={[s.body, { backgroundColor: c.bg }]}>
          {/* Carer tabs */}
          {!isManager && tab === 'today' && <TodayScreen user={user} visits={visits} queue={activeQueue} onVisit={(v) => pushScreen({ kind: 'visit', visit: v })} onRefresh={() => loadVisits(session, true)} refreshing={refreshing} onSync={() => sync()} session={session} />}
          {!isManager && tab === 'schedule' && <WeekScreen session={session} onVisit={(v) => pushScreen({ kind: 'visit', visit: v })} onSwap={() => pushScreen({ kind: 'swap', mode: 'swap' })} />}
          {!isManager && tab === 'mileage' && <MileageScreen session={session} />}

          {/* Manager tabs */}
          {isManager && tab === 'today' && <ManagerDashboard session={session!} onNavigate={(screen, params) => {
            if (screen === 'clientList') setTab('clients')
            else if (screen === 'allVisits') { pushScreen({ kind: 'allVisits', ...params }) }
            else if (screen === 'staffDirectory') { pushScreen({ kind: 'staffDirectory' }) }
            else if (screen === 'timesheets') { pushScreen({ kind: 'timesheets' }) }
            else if (screen === 'carerTotals') { pushScreen({ kind: 'carerTotals' }) }
          }} />}
          {isManager && tab === 'clients' && <ClientListScreen session={session!} onSelect={(personId) => pushScreen({ kind: 'clientDetail', personId })} />}
          {isManager && tab === 'visits' && <AllVisitsScreen session={session!} onSelect={(visit) => {
            if (visit) pushScreen({ kind: 'visit', visit })
          }} />}

          {/* Shared tabs */}
          {tab === 'chat' && <ChatScreen session={session} />}
          {tab === 'settings' && <SettingsScreen user={user} onSignOut={handleSignOut} onSync={() => sync()} onProfile={() => pushScreen({ kind: 'profile' })} onLearn={() => pushScreen({ kind: 'learn' })} onAvailability={!isManager ? () => pushScreen({ kind: 'availability' }) : undefined} onAnnualLeave={!isManager ? () => pushScreen({ kind: 'annualLeave' }) : undefined} onDeleteAccount={handleDeleteAccount} />}
        </View>

        <View style={[s.tabBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
          {tabs.map(t => (
            <Pressable key={t.key} accessibilityRole="tab" accessibilityLabel={t.label} accessibilityState={{ selected: tab === t.key }}
              onPress={() => { setTab(t.key); if (t.key === 'chat') setChatUnreadCount(0); setScreenStack([{ kind: 'tabs' }]) }}
              style={({ pressed }) => [s.tab, pressed && { opacity: 0.5 }]}
            >
              <TabIcon name={tabIconName[t.key]} size={24} color={tab === t.key ? c.primary : c.subtle} />
              {t.key === 'chat' && chatUnreadCount > 0 && (
                <View style={[s.chatBadge, { backgroundColor: c.danger }]}>
                  <Text style={[s.chatBadgeText, { color: c.inverse }]}>{chatUnreadCount > 99 ? '99+' : String(chatUnreadCount)}</Text>
                </View>
              )}
              <Text style={[s.tabLabel, { color: tab === t.key ? c.primary : c.subtle }]}>{t.label}</Text>
              {tab === t.key && <View style={[s.tabIndicator, { backgroundColor: c.primary }]} />}
            </Pressable>
          ))}
        </View>
        <EmergencyButton contacts={sosContacts} />
      </SafeAreaView>
    </>
  )
}

const s = StyleSheet.create({
  app: { flex: 1 },
  body: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.md,
    paddingTop: spacing.xs,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, gap: 2, minHeight: 48 },
  chatBadge: { position: 'absolute', top: 1, right: '50%', marginRight: -20, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, zIndex: 2 },
  chatBadgeText: { fontSize: 10, fontWeight: '700', fontFamily: FONT, lineHeight: 13 },
  tabLabel: { fontFamily: FONT, fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
  tabIndicator: { width: 20, height: 2, borderRadius: 1, marginTop: 3 },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  notifBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', position: 'relative', borderRadius: 20 },
  notifBadge: {
    position: 'absolute', top: 3, right: 2,
    minWidth: 18, height: 18, borderRadius: 9, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  notifBadgeText: { fontFamily: FONT, fontSize: 10, fontWeight: '700', lineHeight: 13 },
})
