import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { elevation, radii, spacing, FONT, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import { SkeletonInline } from '../components/Skeleton'
import type { AuthSession, HomecareVisit } from '../types'
import { PrimaryButton } from '../components/PrimaryButton'
import { listRideShareRequests, createRideShareRequest, respondRideShareRequest, getMyVisits } from '../services/api'
import { hapticLight, hapticMedium } from '../services/haptics'

function time(value?: string | null) {
  return value ? new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'
}

function dateLabel(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'
}

interface RideShareRequest {
  id: string
  visit_id: string
  target_visit_id: string
  visit_label: string
  target_visit_label?: string | null
  scheduled_start: string
  scheduled_end: string
  target_scheduled_start?: string | null
  target_scheduled_end?: string | null
  client_name: string
  target_client_name: string | null
  carer_name: string
  target_carer_name: string | null
  mileage_miles?: number | null
  target_mileage_miles?: number | null
  mileage_rate_pence?: number | null
  estimated_mileage_savings_miles?: number | null
  estimated_savings_pence?: number | null
  status: 'pending' | 'accepted' | 'declined'
  message: string | null
  requested_by: string
  created_at: string
}

interface Props {
  session: AuthSession
  currentVisit?: HomecareVisit | null
  onBack: () => void
}

export function RideShareScreen({ session, currentVisit, onBack }: Props) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const [requests, setRequests] = useState<RideShareRequest[]>([])
  const [todayVisits, setTodayVisits] = useState<HomecareVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedVisit, setSelectedVisit] = useState<HomecareVisit | null>(currentVisit || null)
  const [showPicker, setShowPicker] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'requests' | 'history'>('requests')

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const [reqs, visits] = await Promise.all([
        listRideShareRequests(session.accessToken),
        getMyVisits(session.accessToken, new Date().toISOString().slice(0, 10), new Date(Date.now() + 86400000).toISOString().slice(0, 10)),
      ])
      setRequests(Array.isArray(reqs) ? reqs : [])
      setTodayVisits(Array.isArray(visits) ? visits.filter((v: HomecareVisit) => !['completed', 'missed', 'cancelled'].includes(v.status)) : [])
    } catch {
      // The screen remains usable with the current data when a refresh fails.
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [session.accessToken])

  useEffect(() => { void loadData() }, [loadData])

  const pendingIncoming = requests.filter(r => r.status === 'pending' && r.requested_by !== session.user?.id)
  const pendingOutgoing = requests.filter(r => r.status === 'pending' && r.requested_by === session.user?.id)
  const accepted = requests.filter(r => r.status === 'accepted')
  const history = requests.filter(r => r.status !== 'pending')
  const otherVisits = todayVisits.filter(v => v.id !== selectedVisit?.id && v.assigned_staff_id)

  const savingsLabel = (request: RideShareRequest) => {
    const miles = Number(request.estimated_mileage_savings_miles || 0)
    const pence = Number(request.estimated_savings_pence || 0)
    if (!miles && !pence) return 'Savings will appear after mileage is recorded'
    return `${miles.toFixed(1)} mi · £${(pence / 100).toFixed(2)} estimated mileage saving`
  }

  const handleSendRequest = () => {
    if (otherVisits.length === 0) {
      Alert.alert('No visits', 'There are no other open visits today to share a ride with.')
      return
    }
    setShowPicker(true)
  }

  const sendToVisit = async (targetVisit: HomecareVisit) => {
    if (!selectedVisit) return
    hapticLight()
    setShowPicker(false)
    setSending(true)
    try {
      await createRideShareRequest(session.accessToken, selectedVisit.id, targetVisit.id, message.trim() || undefined)
      setMessage('')
      Alert.alert('Request sent', `Ride share request sent to ${targetVisit.assigned_staff_name || 'carer'} for ${targetVisit.label}.`)
      await loadData()
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send request')
    } finally {
      setSending(false)
    }
  }

  const handleRespond = async (requestId: string, status: 'accepted' | 'declined') => {
    hapticMedium()
    setProcessingId(requestId)
    try {
      await respondRideShareRequest(session.accessToken, requestId, status)
      await loadData()
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not respond')
    } finally {
      setProcessingId(null)
    }
  }

  const renderRequestCard = (request: RideShareRequest, incoming = false) => (
    <View key={request.id} style={[s.requestCard, { backgroundColor: c.surface, borderColor: incoming ? c.primary + '30' : c.borderLight }]}>
      <View style={s.requestHeader}>
        <View style={[s.requestAvatar, { backgroundColor: incoming ? c.primarySurface : c.surfaceAlt }]}>
          <Ionicons name={incoming ? 'person-outline' : 'time-outline'} size={17} color={incoming ? c.primary : c.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.requestName, { color: c.ink }]}>{incoming ? request.carer_name || 'Carer' : `To ${request.target_carer_name || 'carer'}`}</Text>
          <Text style={[s.requestSub, { color: c.muted }]}>{incoming ? 'wants to share a ride with you' : 'Awaiting response'}</Text>
        </View>
        {!incoming && <View style={[s.statusBadge, { backgroundColor: c.warningSurface }]}><Text style={[s.statusText, { color: c.warning }]}>Pending</Text></View>}
      </View>
      <View style={[s.requestVisit, { backgroundColor: c.surfaceAlt }]}>
        <Ionicons name="location-outline" size={15} color={c.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[s.requestVisitName, { color: c.ink }]}>{incoming ? request.visit_label : request.target_client_name || request.target_visit_label || request.visit_label}</Text>
          <Text style={[s.requestVisitTime, { color: c.muted }]}>{dateLabel(incoming ? request.scheduled_start : request.target_scheduled_start || request.scheduled_start)} · {time(incoming ? request.scheduled_start : request.target_scheduled_start || request.scheduled_start)}</Text>
        </View>
      </View>
      <Text style={[s.savingsText, { color: c.success }]}>{savingsLabel(request)}</Text>
      {request.message && <View style={[s.messageBubble, { backgroundColor: c.surfaceAlt }]}><Text style={[s.messageText, { color: c.ink }]}>{request.message}</Text></View>}
      {incoming && <View style={s.requestActions}>
        <Pressable onPress={() => handleRespond(request.id, 'declined')} disabled={processingId === request.id} style={[s.respondBtn, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}><Text style={[s.respondBtnText, { color: c.muted }]}>Decline</Text></Pressable>
        <Pressable onPress={() => handleRespond(request.id, 'accepted')} disabled={processingId === request.id} style={[s.respondBtn, { backgroundColor: c.primary, borderColor: c.primary }]}><Text style={[s.respondBtnText, { color: '#FFFFFF' }]}>Accept</Text></Pressable>
      </View>}
    </View>
  )

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]}>
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.borderLight }]}>
        <Pressable onPress={() => { hapticLight(); onBack() }} style={s.backBtn} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={22} color={c.ink} /></Pressable>
        <Text style={[s.headerTitle, { color: c.ink }]}>Share Ride</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadData(true)} tintColor="transparent" />}>
        {loading ? <SkeletonInline c={c} /> : <>
          <View style={s.tabs}>
            <Pressable onPress={() => setActiveTab('requests')} style={[s.tab, activeTab === 'requests' && { borderBottomColor: c.primary }]}><Text style={[s.tabText, { color: activeTab === 'requests' ? c.primary : c.muted }]}>Requests</Text></Pressable>
            <Pressable onPress={() => setActiveTab('history')} style={[s.tab, activeTab === 'history' && { borderBottomColor: c.primary }]}><Text style={[s.tabText, { color: activeTab === 'history' ? c.primary : c.muted }]}>Ride history</Text></Pressable>
          </View>
          {activeTab === 'requests' ? <>
            <Text style={[s.sectionLabel, { color: c.subtle }]}>YOUR VISIT</Text>
            <Pressable onPress={() => setShowPicker(true)} style={[s.visitSelector, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={s.visitSelectorContent}>
                <View style={[s.visitIcon, { backgroundColor: c.primarySurface }]}><Ionicons name="car-outline" size={18} color={c.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.visitSelectorName, { color: c.ink }]} numberOfLines={1}>{selectedVisit?.label || 'Select a visit to share'}</Text>
                  {selectedVisit && <Text style={[s.visitSelectorTime, { color: c.muted }]}>{time(selectedVisit.scheduled_start)} – {time(selectedVisit.scheduled_end)}{selectedVisit.person_name ? ` · ${selectedVisit.person_name}` : ''}</Text>}
                </View>
                <Ionicons name="chevron-down" size={18} color={c.subtle} />
              </View>
            </Pressable>
            <View style={[s.inputWrap, { backgroundColor: c.surface, borderColor: c.border }]}><TextInput style={[s.input, { color: c.ink }]} value={message} onChangeText={setMessage} placeholder="Optional message" placeholderTextColor={c.subtle} multiline maxLength={200} /></View>
            <PrimaryButton label="Send ride share request" onPress={handleSendRequest} loading={sending} disabled={!selectedVisit || sending} tone="primary" />
            {pendingIncoming.length > 0 && <View style={s.section}><Text style={[s.sectionLabel, { color: c.subtle }]}>INCOMING REQUESTS ({pendingIncoming.length})</Text>{pendingIncoming.map(r => renderRequestCard(r, true))}</View>}
            {pendingOutgoing.length > 0 && <View style={s.section}><Text style={[s.sectionLabel, { color: c.subtle }]}>SENT REQUESTS ({pendingOutgoing.length})</Text>{pendingOutgoing.map(r => renderRequestCard(r))}</View>}
            {accepted.length > 0 && <View style={s.section}><Text style={[s.sectionLabel, { color: c.subtle }]}>ACTIVE SHARED RIDES</Text>{accepted.map(r => <View key={r.id} style={[s.requestCard, { backgroundColor: c.successSurface, borderColor: c.success + '30' }]}><View style={s.requestHeader}><View style={[s.requestAvatar, { backgroundColor: c.success + '20' }]}><Ionicons name="checkmark-circle-outline" size={17} color={c.success} /></View><View style={{ flex: 1 }}><Text style={[s.requestName, { color: c.ink }]}>With {r.requested_by === session.user?.id ? r.target_carer_name || 'carer' : r.carer_name || 'carer'}</Text><Text style={[s.requestSub, { color: c.success }]}>Mileage split 50/50</Text><Text style={[s.savingsText, { color: c.success }]}>{savingsLabel(r)}</Text></View></View></View>)}</View>}
            {requests.length === 0 && <View style={s.emptyState}><View style={[s.emptyIcon, { backgroundColor: c.primarySurface }]}><Ionicons name="car-outline" size={28} color={c.primary} /></View><Text style={[s.emptyTitle, { color: c.ink }]}>Share rides with other carers</Text><Text style={[s.emptySub, { color: c.muted }]}>When nearby visits can share a journey, request a ride share and split the mileage.</Text></View>}
          </> : <>
            {history.length === 0 ? <View style={s.emptyState}><View style={[s.emptyIcon, { backgroundColor: c.primarySurface }]}><Ionicons name="time-outline" size={28} color={c.primary} /></View><Text style={[s.emptyTitle, { color: c.ink }]}>No ride history yet</Text><Text style={[s.emptySub, { color: c.muted }]}>Accepted and declined requests will appear here.</Text></View> : history.map(r => <View key={r.id} style={[s.requestCard, { backgroundColor: c.surface, borderColor: r.status === 'accepted' ? c.success + '30' : c.borderLight }]}><View style={s.requestHeader}><View style={[s.requestAvatar, { backgroundColor: r.status === 'accepted' ? c.success + '18' : c.surfaceAlt }]}><Ionicons name={r.status === 'accepted' ? 'checkmark-circle-outline' : 'close-circle-outline'} size={17} color={r.status === 'accepted' ? c.success : c.muted} /></View><View style={{ flex: 1 }}><Text style={[s.requestName, { color: c.ink }]}>{r.target_client_name || r.target_visit_label || r.visit_label}</Text><Text style={[s.requestSub, { color: c.muted }]}>{dateLabel(r.target_scheduled_start || r.scheduled_start)} · {time(r.target_scheduled_start || r.scheduled_start)}</Text><Text style={[s.savingsText, { color: r.status === 'accepted' ? c.success : c.muted }]}>{r.status === 'accepted' ? savingsLabel(r) : 'Request declined'}</Text></View><View style={[s.statusBadge, { backgroundColor: r.status === 'accepted' ? c.successSurface : c.surfaceAlt }]}><Text style={[s.statusText, { color: r.status === 'accepted' ? c.success : c.muted }]}>{r.status === 'accepted' ? 'Accepted' : 'Declined'}</Text></View></View></View>)}
          </>}
        </>}
      </ScrollView>
      {showPicker && <View style={[s.pickerBackdrop, { backgroundColor: 'rgba(15, 23, 42, 0.4)' }]}><Pressable style={s.pickerBackdropTouch} onPress={() => setShowPicker(false)}><View style={[s.pickerSheet, { backgroundColor: c.surface }]}><View style={[s.pickerHandle, { backgroundColor: c.border }]} /><Text style={[s.pickerTitle, { color: c.ink }]}>Select a visit to share a ride with</Text><ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>{otherVisits.length === 0 ? <Text style={[s.emptySub, { color: c.muted }]}>No other open visits today to share a ride with.</Text> : otherVisits.map(v => <Pressable key={v.id} onPress={() => void sendToVisit(v)} style={s.pickerRow}><View style={[s.pickerAvatar, { backgroundColor: c.primarySurface }]}><Ionicons name="person-outline" size={16} color={c.primary} /></View><View style={{ flex: 1 }}><Text style={[s.pickerName, { color: c.ink }]}>{v.label}</Text><Text style={[s.pickerSub, { color: c.muted }]}>{v.assigned_staff_name || 'Unassigned'} · {time(v.scheduled_start)} – {time(v.scheduled_end)}</Text></View><Ionicons name="add-circle-outline" size={22} color={c.primary} /></Pressable>)}</ScrollView><Pressable onPress={() => setShowPicker(false)} style={s.cancelBtn}><Text style={[s.cancelText, { color: c.muted }]}>Cancel</Text></Pressable></View></Pressable></View>}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: FONT, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.xxxl },
  tabs: { flexDirection: 'row', marginBottom: spacing.lg },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  section: { marginTop: spacing.xl },
  sectionLabel: { fontFamily: FONT, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: spacing.sm },
  visitSelector: { borderRadius: radii.lg, padding: spacing.base, marginBottom: spacing.md, borderWidth: 1, ...elevation.sm },
  visitSelectorContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  visitIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  visitSelectorName: { fontFamily: FONT, fontSize: 15, fontWeight: '600' },
  visitSelectorTime: { fontFamily: FONT, fontSize: 12, marginTop: 2 },
  inputWrap: { borderRadius: radii.md, marginBottom: spacing.base, paddingHorizontal: spacing.base, paddingVertical: spacing.xs, borderWidth: 1 },
  input: { fontFamily: FONT, fontSize: 14, paddingVertical: spacing.sm, minHeight: 40 },
  requestCard: { borderRadius: radii.lg, padding: spacing.base, marginBottom: spacing.sm, borderWidth: 1, ...elevation.sm },
  requestHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  requestAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  requestName: { fontFamily: FONT, fontSize: 14, fontWeight: '600' },
  requestSub: { fontFamily: FONT, fontSize: 12, marginTop: 1 },
  requestVisit: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.xs },
  requestVisitName: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  requestVisitTime: { fontFamily: FONT, fontSize: 11, marginTop: 1 },
  savingsText: { fontFamily: FONT, fontSize: 12, fontWeight: '700', marginTop: spacing.xs },
  messageBubble: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, marginTop: spacing.sm },
  messageText: { fontFamily: FONT, fontSize: 13 },
  requestActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  respondBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radii.md, alignItems: 'center', borderWidth: 1 },
  respondBtnText: { fontFamily: FONT, fontSize: 14, fontWeight: '600' },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.sm },
  statusText: { fontFamily: FONT, fontSize: 11, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: spacing.xxxl, gap: spacing.md },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontFamily: FONT, fontSize: 14, textAlign: 'center', paddingHorizontal: spacing.xl, lineHeight: 20 },
  pickerBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  pickerBackdropTouch: { flex: 1, justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.xl, paddingBottom: spacing.xxxl, ...elevation.lg },
  pickerHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.base },
  pickerTitle: { fontFamily: FONT, fontSize: 17, fontWeight: '700', marginBottom: spacing.base },
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'transparent' },
  pickerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pickerName: { fontFamily: FONT, fontSize: 15, fontWeight: '600' },
  pickerSub: { fontFamily: FONT, fontSize: 12, marginTop: 1 },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  cancelText: { fontFamily: FONT, fontSize: 14, fontWeight: '600' },
})
