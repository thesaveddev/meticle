import { useEffect, useState, useCallback } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, elevation, radii, spacing, FONT, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import { dyn } from '../utils/dynamicStyles'
import { SkeletonInline } from '../components/Skeleton'
import type { AuthSession, HomecareVisit } from '../types'
import { PrimaryButton } from '../components/PrimaryButton'
import { listRideShareRequests, createRideShareRequest, respondRideShareRequest, getMyVisits } from '../services/api'
import { hapticLight, hapticMedium } from '../services/haptics'

function time(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

interface RideShareRequest {
  id: string
  visit_id: string
  target_visit_id: string
  visit_label: string
  scheduled_start: string
  scheduled_end: string
  client_name: string
  target_client_name: string | null
  carer_name: string
  target_carer_name: string | null
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

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const [reqs, visits] = await Promise.all([
        listRideShareRequests(session.accessToken),
        getMyVisits(session.accessToken, new Date().toISOString().split('T')[0], new Date(Date.now() + 86400000).toISOString().split('T')[0]),
      ])
      setRequests(Array.isArray(reqs) ? reqs : [])
      setTodayVisits(Array.isArray(visits) ? visits.filter((v: HomecareVisit) => !['completed', 'missed', 'cancelled'].includes(v.status)) : [])
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [session.accessToken])

  useEffect(() => { loadData() }, [loadData])

  const pendingIncoming = requests.filter(r => r.status === 'pending' && r.requested_by !== session.user?.id)
  const pendingOutgoing = requests.filter(r => r.status === 'pending' && r.requested_by === session.user?.id)
  const accepted = requests.filter(r => r.status === 'accepted')
  const declined = requests.filter(r => r.status === 'declined')

  const handleSendRequest = async () => {
    if (!selectedVisit) return
    const otherVisits = todayVisits.filter(v => v.id !== selectedVisit.id && v.assigned_staff_id)
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
    } finally { setSending(false) }
  }

  const handleRespond = async (requestId: string, status: 'accepted' | 'declined') => {
    hapticMedium()
    setProcessingId(requestId)
    try {
      await respondRideShareRequest(session.accessToken, requestId, status)
      await loadData()
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not respond')
    } finally { setProcessingId(null) }
  }

  const otherVisits = todayVisits.filter(v => v.id !== selectedVisit?.id && v.assigned_staff_id)

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.borderLight }]}>
        <Pressable onPress={() => { hapticLight(); onBack() }} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.ink} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.ink }]}>Share Ride</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor="transparent" />}
      >
        {loading ? (
          <SkeletonInline c={c} />
        ) : (
          <>
            {/* Current visit selector */}
            <Text style={[s.sectionLabel, { color: c.subtle }]}>YOUR VISIT</Text>
            <Pressable
              onPress={() => setShowPicker(true)}
              style={({ pressed }) => [s.visitSelector, { backgroundColor: c.surface, borderColor: c.border }, pressed && { opacity: 0.8 }]}
            >
              {selectedVisit ? (
                <View style={s.visitSelectorContent}>
                  <View style={[s.visitIcon, { backgroundColor: c.primarySurface }]}>
                    <Ionicons name="car" size={18} color={c.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.visitSelectorName, { color: c.ink }]} numberOfLines={1}>{selectedVisit.label}</Text>
                    <Text style={[s.visitSelectorTime, { color: c.muted }]}>
                      {time(selectedVisit.scheduled_start)} – {time(selectedVisit.scheduled_end)}
                      {selectedVisit.person_name ? ` · ${selectedVisit.person_name}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={c.subtle} />
                </View>
              ) : (
                <View style={s.visitSelectorContent}>
                  <View style={[s.visitIcon, { backgroundColor: c.surfaceAlt }]}>
                    <Ionicons name="car-outline" size={18} color={c.muted} />
                  </View>
                  <Text style={[s.visitSelectorPlaceholder, { color: c.muted }]}>Select a visit to share</Text>
                </View>
              )}
            </Pressable>

            {/* Message */}
            <View style={[s.inputWrap, { backgroundColor: c.surface, borderColor: c.border, borderWidth: 1 }]}>
              <TextInput
                style={[s.input, { color: c.ink }]}
                value={message}
                onChangeText={setMessage}
                placeholder="Optional message (e.g. I'm heading that way)"
                placeholderTextColor={c.subtle}
                multiline
                maxLength={200}
              />
            </View>

            {/* Send request button */}
            <PrimaryButton
              label={selectedVisit ? `Send ride share request` : 'Select a visit first'}
              onPress={handleSendRequest}
              loading={sending}
              disabled={!selectedVisit || sending}
              tone="primary"
            />

            {/* Pending incoming requests */}
            {pendingIncoming.length > 0 && (
              <View style={s.section}>
                <Text style={[s.sectionLabel, { color: c.subtle }]}>INCOMING REQUESTS ({pendingIncoming.length})</Text>
                {pendingIncoming.map(req => (
                  <View key={req.id} style={[s.requestCard, { backgroundColor: c.surface, borderColor: c.primary + '30', borderWidth: 1 }]}>
                    <View style={s.requestHeader}>
                      <View style={[s.requestAvatar, { backgroundColor: c.primarySurface }]}>
                        <Ionicons name="person" size={16} color={c.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.requestName, { color: c.ink }]}>{req.carer_name || 'Carer'}</Text>
                        <Text style={[s.requestSub, { color: c.muted }]}>wants to share a ride with you</Text>
                      </View>
                    </View>
                    <View style={[s.requestVisit, { backgroundColor: c.primarySurface + '60', borderColor: c.primary + '15' }]}>
                      <Ionicons name="location" size={14} color={c.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.requestVisitName, { color: c.ink }]}>{req.visit_label}</Text>
                        <Text style={[s.requestVisitTime, { color: c.muted }]}>
                          {dateLabel(req.scheduled_start)} · {time(req.scheduled_start)} – {time(req.scheduled_end)}
                        </Text>
                      </View>
                    </View>
                    {req.message && (
                      <View style={[s.messageBubble, { backgroundColor: c.surfaceAlt }]}>
                        <Text style={[s.messageText, { color: c.ink }]}>{`“${req.message}”`}</Text>
                      </View>
                    )}
                    <View style={s.requestActions}>
                      <Pressable
                        onPress={() => handleRespond(req.id, 'declined')}
                        disabled={processingId === req.id}
                        style={({ pressed }) => [[s.respondBtn, { backgroundColor: c.surfaceAlt, borderColor: c.border }], pressed && { opacity: 0.7 }]}
                      >
                        <Text style={[s.respondBtnText, { color: c.muted }]}>Decline</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleRespond(req.id, 'accepted')}
                        disabled={processingId === req.id}
                        style={({ pressed }) => [[s.respondBtn, s.respondBtnAccept, { backgroundColor: c.primary }], pressed && { opacity: 0.8 }]}
                      >
                        <Text style={[s.respondBtnText, { color: '#FFFFFF' }]}>Accept</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Pending outgoing requests */}
            {pendingOutgoing.length > 0 && (
              <View style={s.section}>
                <Text style={[s.sectionLabel, { color: c.subtle }]}>SENT REQUESTS ({pendingOutgoing.length})</Text>
                {pendingOutgoing.map(req => (
                  <View key={req.id} style={[s.requestCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
                    <View style={s.requestHeader}>
                      <View style={[s.requestAvatar, { backgroundColor: c.warningSurface }]}>
                        <Ionicons name="time" size={16} color={c.warning} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.requestName, { color: c.ink }]}>To {req.target_carer_name || 'carer'}</Text>
                        <Text style={[s.requestSub, { color: c.muted }]}>Awaiting response</Text>
                      </View>
                      <View style={[s.statusBadge, { backgroundColor: c.warningSurface }]}>
                        <Text style={[s.statusText, { color: c.warning }]}>Pending</Text>
                      </View>
                    </View>
                    <View style={[s.requestVisit, { backgroundColor: c.surfaceAlt }]}>
                      <Ionicons name="location" size={14} color={c.muted} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.requestVisitName, { color: c.ink }]}>{req.target_client_name || req.visit_label}</Text>
                        <Text style={[s.requestVisitTime, { color: c.muted }]}>
                          {time(req.scheduled_start)} – {time(req.scheduled_end)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Accepted */}
            {accepted.length > 0 && (
              <View style={s.section}>
                <Text style={[s.sectionLabel, { color: c.subtle }]}>ACTIVE SHARED RIDES</Text>
                {accepted.map(req => (
                  <View key={req.id} style={[s.requestCard, { backgroundColor: c.successSurface, borderColor: c.success + '30', borderWidth: 1 }]}>
                    <View style={s.requestHeader}>
                      <View style={[s.requestAvatar, { backgroundColor: c.success + '20' }]}>
                        <Ionicons name="checkmark-circle" size={16} color={c.success} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.requestName, { color: c.ink }]}>
                          {req.requested_by === session.user?.id ? `With ${req.target_carer_name}` : `With ${req.carer_name}`}
                        </Text>
                        <Text style={[s.requestSub, { color: c.success }]}>Ride shared — mileage split 50/50</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Empty state */}
            {requests.length === 0 && todayVisits.length <= 1 && (
              <View style={s.emptyState}>
                <View style={[s.emptyIcon, { backgroundColor: c.primarySurface }]}>
                  <Ionicons name="car" size={28} color={c.primary} />
                </View>
                <Text style={[s.emptyTitle, { color: c.ink }]}>Share rides with other carers</Text>
                <Text style={[s.emptySub, { color: c.muted }]}>
                  When you and another carer have nearby visits, you can share a ride and split the mileage 50/50.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Visit picker modal */}
      {showPicker && (
        <View style={[s.pickerBackdrop, { backgroundColor: 'rgba(15, 23, 42, 0.4)' }]}>
          <Pressable style={s.pickerBackdropTouch} onPress={() => setShowPicker(false)}>
            <Pressable>
              <View style={[s.pickerSheet, { backgroundColor: c.surface }]}>
                <View style={[s.pickerHandle, { backgroundColor: c.border }]} />
                <Text style={[s.pickerTitle, { color: c.ink }]}>Select a visit to share a ride with</Text>
                <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                  {otherVisits.length === 0 ? (
                    <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
                      <Text style={{ fontFamily: FONT, fontSize: 14, color: c.muted, textAlign: 'center' }}>
                        No other open visits today to share a ride with.
                      </Text>
                    </View>
                  ) : (
                    otherVisits.map(v => (
                      <Pressable
                        key={v.id}
                        onPress={() => { sendToVisit(v) }}
                        style={({ pressed }) => [s.pickerRow, { borderBottomColor: c.borderLight }, pressed && { backgroundColor: c.surfaceAlt }]}
                      >
                        <View style={[s.pickerAvatar, { backgroundColor: c.primarySurface }]}>
                          <Ionicons name="person" size={16} color={c.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.pickerName, { color: c.ink }]} numberOfLines={1}>{v.label}</Text>
                          <Text style={[s.pickerSub, { color: c.muted }]}>
                            {v.assigned_staff_name || 'Unassigned'} · {time(v.scheduled_start)} – {time(v.scheduled_end)}
                          </Text>
                        </View>
                        <Ionicons name="add-circle" size={22} color={c.primary} />
                      </Pressable>
                    ))
                  )}
                </ScrollView>
                <Pressable onPress={() => setShowPicker(false)} style={s.cancelBtn}>
                  <Text style={[s.cancelText, { color: c.muted }]}>Cancel</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: FONT, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.xxxl },

  section: { marginTop: spacing.xl },
  sectionLabel: { fontFamily: FONT, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: spacing.sm },

  visitSelector: { borderRadius: radii.lg, padding: spacing.base, marginBottom: spacing.md, borderWidth: 1, ...elevation.sm },
  visitSelectorContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  visitIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  visitSelectorName: { fontFamily: FONT, fontSize: 15, fontWeight: '600' },
  visitSelectorTime: { fontFamily: FONT, fontSize: 12, marginTop: 2 },
  visitSelectorPlaceholder: { fontFamily: FONT, fontSize: 15, fontWeight: '500' },

  inputWrap: { borderRadius: radii.md, marginBottom: spacing.base, paddingHorizontal: spacing.base, paddingVertical: spacing.xs },
  input: { fontFamily: FONT, fontSize: 14, paddingVertical: spacing.sm, minHeight: 40 },

  requestCard: { borderRadius: radii.lg, padding: spacing.base, marginBottom: spacing.sm, ...elevation.sm },
  requestHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  requestAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  requestName: { fontFamily: FONT, fontSize: 14, fontWeight: '600' },
  requestSub: { fontFamily: FONT, fontSize: 12, marginTop: 1 },
  requestVisit: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.sm },
  requestVisitName: { fontFamily: FONT, fontSize: 13, fontWeight: '600', flex: 1 },
  requestVisitTime: { fontFamily: FONT, fontSize: 11, marginTop: 1 },
  messageBubble: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md, marginBottom: spacing.sm },
  messageText: { fontFamily: FONT, fontSize: 13, fontStyle: 'italic' },
  requestActions: { flexDirection: 'row', gap: spacing.sm },
  respondBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radii.md, alignItems: 'center', borderWidth: 1 },
  respondBtnAccept: { borderColor: 'transparent' },
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
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  pickerName: { fontFamily: FONT, fontSize: 15, fontWeight: '600' },
  pickerSub: { fontFamily: FONT, fontSize: 12, marginTop: 1 },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  cancelText: { fontFamily: FONT, fontSize: 14, fontWeight: '600' },
})
