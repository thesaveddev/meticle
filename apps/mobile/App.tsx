import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'
import { colors, commonStyles, spacing, type } from './src/theme'
import type { AuthSession, HomecareVisit, MobileUser, OfflineVisitAction, VisitAction } from './src/types'
import { readSession } from './src/services/storage'
import { getCurrentUser, getMyVisits, login, logout, createDisruption } from './src/services/api'
import { enqueueVisitAction, flushQueue, getQueue } from './src/services/visitQueue'
import { scheduleVisitReminder } from './src/services/notifications'
import { LoginScreen } from './src/screens/LoginScreen'
import { TodayScreen, dayRange } from './src/screens/TodayScreen'
import { VisitScreen } from './src/screens/VisitScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'

function AppTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => [styles.tab, active && styles.activeTab, pressed && styles.pressed]}><Text style={[styles.tabLabel, active && styles.activeTabLabel]}>{label}</Text></Pressable>
}

export default function App() {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [booting, setBooting] = useState(true)
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [visits, setVisits] = useState<HomecareVisit[]>([])
  const [queue, setQueue] = useState<OfflineVisitAction[]>([])
  const [selectedVisit, setSelectedVisit] = useState<HomecareVisit | null>(null)
  const [tab, setTab] = useState<'today' | 'settings'>('today')
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
    } finally { if (refresh) setRefreshing(false) }
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
    try { const active = await login(email, password); setSession(active); await loadQueue(); await loadVisits(active) } catch (error: any) { setLoginError(error.message || 'Could not sign in.') } finally { setLoginLoading(false) }
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
    } catch { return { synced: false } }
  }

  async function handleDisruption(body: Record<string, unknown>) {
    if (!session || !selectedVisit) throw new Error('Your session is no longer available.')
    await createDisruption(session.accessToken, selectedVisit.id, body)
    await loadVisits(session)
  }

  async function handleSignOut() { await logout(); setSession(null); setVisits([]); setQueue([]); setSelectedVisit(null) }

  const user: MobileUser | null = session?.user || null
  const activeQueue = useMemo(() => queue.filter(item => item.state !== 'synced'), [queue])

  if (booting) return <SafeAreaView style={styles.boot}><ActivityIndicator color={colors.navy} /><Text style={styles.bootText}>Opening MeticleCare</Text></SafeAreaView>
  if (!session || !user) return <LoginScreen onLogin={handleLogin} error={loginError} loading={loginLoading} />
  if (selectedVisit) return <VisitScreen visit={selectedVisit} queue={activeQueue} onBack={() => setSelectedVisit(null)} onAction={handleAction} onDisruption={handleDisruption} />

  return <SafeAreaView style={styles.app}><View style={styles.body}>{tab === 'today' ? <TodayScreen user={user} visits={visits} queue={activeQueue} onVisit={setSelectedVisit} onRefresh={() => loadVisits(session, true)} refreshing={refreshing} onSync={() => sync()} /> : <SettingsScreen user={user} onSignOut={handleSignOut} onSync={() => sync()} />}</View><View style={styles.tabs}><AppTab label="Today" active={tab === 'today'} onPress={() => setTab('today')} /><AppTab label="Settings" active={tab === 'settings'} onPress={() => setTab('settings')} /></View></SafeAreaView>
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.bone },
  body: { flex: 1 },
  tabs: { height: 68, borderTopWidth: 1, borderTopColor: colors.hairline, backgroundColor: colors.paper, flexDirection: 'row', paddingHorizontal: spacing.md, paddingBottom: 8 },
  tab: { flex: 1, minHeight: 56, justifyContent: 'center', alignItems: 'center', borderTopWidth: 2, borderTopColor: 'transparent' },
  activeTab: { borderTopColor: colors.emerald },
  tabLabel: { ...type.label, color: colors.mist },
  activeTabLabel: { color: colors.navy },
  pressed: { opacity: 0.7 },
  boot: { ...commonStyles.screen, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  bootText: { ...type.caption, color: colors.mist },
})
