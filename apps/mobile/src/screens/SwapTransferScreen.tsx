import { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, elevation, radii, spacing, type, FONT, useAppColors } from '../theme'
import { dyn } from '../utils/dynamicStyles'
import type { AuthSession, HomecareVisit, MobileUser } from '../types'
import { PrimaryButton } from '../components/PrimaryButton'
import { getStaffVisits } from '../services/api'
import { hapticLight, hapticWarning } from '../services/haptics'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://meticlecare.com/api'

function time(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

interface SwapRequest {
  id: string
  visit_id: string
  visit_label: string
  visit_type: string
  scheduled_start: string
  scheduled_end: string
  client_name: string
  request_type: 'swap' | 'transfer'
  status: string
  message: string | null
  requested_by_name: string
  target_name: string | null
  created_at: string
}

interface TeamMember {
  id: string
  first_name: string | null
  last_name: string | null
  user_id: string
}

interface Props {
  session: AuthSession
  user: MobileUser
  visits: HomecareVisit[]
  onBack: () => void
  onRefresh: () => void
}

export function SwapTransferScreen({ session, user, visits, onBack, onRefresh }: Props) {
  const c = useAppColors()
  const [requests, setRequests] = useState<SwapRequest[]>([])
  const [team, setTeam] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [requestType, setRequestType] = useState<'swap' | 'transfer'>('swap')
  const [step, setStep] = useState(1)
  const [selectedVisit, setSelectedVisit] = useState<HomecareVisit | null>(null)
  const [targetStaff, setTargetStaff] = useState<TeamMember | null>(null)
  const [targetVisits, setTargetVisits] = useState<HomecareVisit[]>([])
  const [selectedTargetVisit, setSelectedTargetVisit] = useState<HomecareVisit | null>(null)
  const [loadingTargetVisits, setLoadingTargetVisits] = useState(false)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const [reqRes, teamRes] = await Promise.all([
        fetch(`${API_BASE}/homecare/swap-requests`, { headers: { Authorization: `Bearer ${session.accessToken}` } }).then(r => r.json()),
        fetch(`${API_BASE}/homecare/staff`, { headers: { Authorization: `Bearer ${session.accessToken}` } }).then(r => r.json()).catch(() => []),
      ])
      setRequests(Array.isArray(reqRes) ? reqRes : [])
      setTeam(Array.isArray(teamRes) ? teamRes : [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openNewRequest = (type: 'swap' | 'transfer') => {
    hapticLight()
    setRequestType(type)
    setStep(1)
    setSelectedVisit(null)
    setTargetStaff(null)
    setTargetVisits([])
    setSelectedTargetVisit(null)
    setMessage('')
    setModalOpen(true)
  }

  const selectTeamMember = async (member: TeamMember) => {
    hapticLight()
    setTargetStaff(member)
    if (requestType === 'swap') {
      // Fetch their scheduled visits
      setLoadingTargetVisits(true)
      try {
        const now = new Date()
        const from = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14).toISOString()
        const theirVisits = await getStaffVisits(session.accessToken, member.id, from, to)
        setTargetVisits(theirVisits.filter((v: HomecareVisit) => v.status === 'scheduled'))
      } catch { setTargetVisits([]) }
      finally { setLoadingTargetVisits(false) }
    }
    setStep(requestType === 'swap' ? 3 : 2)
  }

  const handleSubmit = async () => {
    if (!selectedVisit) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/homecare/swap-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify({
          visit_id: selectedVisit.id,
          target_staff_id: targetStaff?.id || undefined,
          target_visit_id: selectedTargetVisit?.id || undefined,
          request_type: requestType,
          message: message.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Could not submit')
      }
      setModalOpen(false)
      await load()
    } catch (e: any) {
      hapticWarning()
      alert(e.message || 'Could not submit request')
    } finally { setSaving(false) }
  }

  const handleRespond = async (swapId: string, status: 'accepted' | 'rejected') => {
    try {
      const res = await fetch(`${API_BASE}/homecare/swap-requests/${swapId}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Could not respond')
      await load()
      onRefresh()
    } catch (e: any) {
      alert(e.message || 'Could not respond')
    }
  }

  const filtered = requests.filter(r => {
    if (filter === 'sent') return r.requested_by_name === (user.first_name || user.email)
    if (filter === 'received') return r.target_name === (user.first_name || user.email)
    return true
  })

  const pendingCount = requests.filter(r => r.status === 'pending').length
  const myVisits = visits.filter(v => v.status === 'scheduled')
  const totalSteps = requestType === 'swap' ? 3 : 2

  const stepLabels = requestType === 'swap'
    ? ['Your call', 'Team member', 'Their call']
    : ['Your call', 'Transfer to']

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={[styles.backArrow, { color: c.primary }]}>←</Text>
          <Text style={[styles.backText, { color: c.primary }]}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.ink }]}>Swap & Transfer</Text>
        {pendingCount > 0 && (
          <Text style={[styles.subtitle, { color: c.muted }]}>{pendingCount} pending request{pendingCount !== 1 ? 's' : ''}</Text>
        )}

        {/* Action cards */}
        <View style={styles.actionRow}>
          <Pressable onPress={() => openNewRequest('swap')} style={({ pressed }) => [[styles.actionCard, { backgroundColor: c.primarySurface, borderColor: c.primary + '20' }], pressed && { opacity: 0.8 }]}>
            <Text style={styles.actionIcon}>🔄</Text>
            <Text style={[styles.actionTitle, { color: c.primary }]}>Swap a call</Text>
            <Text style={[styles.actionDesc, { color: c.muted }]}>Exchange a call with a colleague</Text>
          </Pressable>
          <Pressable onPress={() => openNewRequest('transfer')} style={({ pressed }) => [[styles.actionCard, { backgroundColor: c.accentSurface, borderColor: c.accent + '20' }], pressed && { opacity: 0.8 }]}>
            <Text style={styles.actionIcon}>➡️</Text>
            <Text style={[styles.actionTitle, { color: c.accent }]}>Transfer a call</Text>
            <Text style={[styles.actionDesc, { color: c.muted }]}>Give a call to a colleague</Text>
          </Pressable>
        </View>

        {/* Filter */}
        <View style={styles.filterRow}>
          {(['all', 'sent', 'received'] as const).map(f => (
            <Pressable key={f} onPress={() => { hapticLight(); setFilter(f) }}
              style={[styles.filterBtn, { backgroundColor: c.surface, borderColor: c.borderLight }, filter === f && { backgroundColor: c.primary, borderColor: c.primary }]}>
              <Text style={[styles.filterText, { color: c.muted }, filter === f && { color: c.inverse }]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
            </Pressable>
          ))}
        </View>

        {/* Request list */}
        {filtered.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
            <Text style={[styles.emptyTitle, { color: c.ink }]}>No requests</Text>
            <Text style={[styles.emptyCopy, { color: c.muted }]}>Swap and transfer requests will appear here.</Text>
          </View>
        ) : (
          filtered.map(req => (
            <View key={req.id} style={[styles.reqCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
              <View style={styles.reqHeader}>
                <View style={[styles.reqTypeBadge, { backgroundColor: req.request_type === 'swap' ? c.primarySurface : c.accentSurface }]}>
                  <Text style={[styles.reqTypeText, { color: req.request_type === 'swap' ? c.primary : c.accent }]}>
                    {req.request_type === 'swap' ? '🔄 Swap' : '➡️ Transfer'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: req.status === 'pending' ? c.warningSurface : req.status === 'accepted' ? c.successSurface : c.dangerSurface }]}>
                  <Text style={[styles.statusText, { color: req.status === 'pending' ? c.warning : req.status === 'accepted' ? c.success : c.danger }]}>
                    {req.status}
                  </Text>
                </View>
              </View>
              <Text style={[styles.reqVisit, { color: c.ink }]}>{req.visit_label}</Text>
              <Text style={[styles.reqClient, { color: c.muted }]}>{req.client_name} · {dateLabel(req.scheduled_start)} {time(req.scheduled_start)}–{time(req.scheduled_end)}</Text>
              <Text style={[styles.reqMeta, { color: c.subtle }]}>By {req.requested_by_name}{req.target_name ? ` → ${req.target_name}` : ''}</Text>
              {req.message && <Text style={[styles.reqMsg, { color: c.inkLight }]}>{req.message}</Text>}

              {req.status === 'pending' && req.target_name === (user.first_name || user.email) && (
                <View style={styles.reqActions}>
                  <PrimaryButton label="Accept" onPress={() => handleRespond(req.id, 'accepted')} tone="success" size="small" />
                  <PrimaryButton label="Decline" onPress={() => handleRespond(req.id, 'rejected')} tone="danger" size="small" />
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* ═══════════════ NEW REQUEST MODAL ═══════════════ */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(15, 23, 42, 0.4)' }]}>
          <View style={[styles.modal, { backgroundColor: c.surface }]}>
            <View style={[styles.modalHandle, { backgroundColor: c.border }]} />

            {/* Step indicator */}
            <View style={styles.stepRow}>
              {stepLabels.map((label, i) => (
                <View key={i} style={styles.stepItem}>
                  <View style={[styles.stepDot, { backgroundColor: i + 1 <= step ? c.primary : c.border }]}>
                    <Text style={[styles.stepNum, { color: i + 1 <= step ? c.inverse : c.muted }]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.stepLabel, { color: i + 1 <= step ? c.primary : c.subtle }]} numberOfLines={1}>{label}</Text>
                  {i < stepLabels.length - 1 && <View style={[styles.stepLine, { backgroundColor: i + 1 < step ? c.primary : c.border }]} />}
                </View>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: '70%' }}>
              {/* Step 1: Select your call */}
              {step === 1 && (
                <>
                  <Text style={[styles.stepTitle, { color: c.ink }]}>Which of your calls?</Text>
                  <Text style={[styles.stepDesc, { color: c.muted }]}>
                    {requestType === 'swap' ? 'Pick the call you want to swap.' : 'Pick the call you want to transfer.'}
                  </Text>
                  <View style={styles.visitList}>
                    {myVisits.map(v => (
                      <Pressable key={v.id} onPress={() => { hapticLight(); setSelectedVisit(v); setStep(2) }}
                        style={({ pressed }) => [[styles.visitOption, { backgroundColor: c.surfaceAlt, borderColor: c.borderLight }, pressed && { opacity: 0.8 }]]}>
                        <View style={styles.visitOptionHeader}>
                          <Text style={[styles.visitOptionLabel, { color: c.ink }]}>{v.label}</Text>
                          <Text style={[styles.visitOptionTime, { color: c.primary }]}>{time(v.scheduled_start)}</Text>
                        </View>
                        <Text style={[styles.visitOptionMeta, { color: c.muted }]}>{v.person_name} · {dateLabel(v.scheduled_start)}</Text>
                      </Pressable>
                    ))}
                    {myVisits.length === 0 && (
                      <Text style={[styles.noVisits, { color: c.subtle }]}>No scheduled calls available to swap.</Text>
                    )}
                  </View>
                </>
              )}

              {/* Step 2: Select team member */}
              {step === 2 && (
                <>
                  <Text style={[styles.stepTitle, { color: c.ink }]}>
                    {requestType === 'swap' ? 'Who do you want to swap with?' : 'Who should receive this call?'}
                  </Text>
                  <Text style={[styles.stepDesc, { color: c.muted }]}>
                    {requestType === 'swap' ? 'We\'ll show their calls so you can pick one to swap.' : 'They\'ll be notified about the transfer.'}
                  </Text>
                  <View style={styles.teamList}>
                    {team.map(m => {
                      const name = `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Unknown'
                      return (
                        <Pressable key={m.id} onPress={() => selectTeamMember(m)}
                          style={({ pressed }) => [[styles.teamOption, { backgroundColor: c.surfaceAlt, borderColor: c.borderLight }, targetStaff?.id === m.id && { backgroundColor: c.primary, borderColor: c.primary }, pressed && { opacity: 0.8 }]]}>
                          <View style={[styles.teamAvatar, { backgroundColor: c.primarySurface }]}>
                            <Text style={[styles.teamAvatarText, { color: c.primary }]}>{(m.first_name || '?')[0]}</Text>
                          </View>
                          <Text style={[styles.teamName, { color: c.ink }, targetStaff?.id === m.id && { color: c.inverse }]}>{name}</Text>
                        </Pressable>
                      )
                    })}
                    {team.length === 0 && (
                      <Text style={[styles.noVisits, { color: c.subtle }]}>No team members found.</Text>
                    )}
                  </View>
                </>
              )}

              {/* Step 3: Select target's call (swap only) */}
              {step === 3 && requestType === 'swap' && (
                <>
                  <Text style={[styles.stepTitle, { color: c.ink }]}>Which of their calls?</Text>
                  <Text style={[styles.stepDesc, { color: c.muted }]}>
                    Pick the call from {targetStaff?.first_name || 'them'} that you'd like to take.
                  </Text>
                  {loadingTargetVisits ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator color={c.primary} />
                      <Text style={[styles.loadingText, { color: c.muted }]}>Loading their calls...</Text>
                    </View>
                  ) : (
                    <View style={styles.visitList}>
                      {targetVisits.map(v => (
                        <Pressable key={v.id} onPress={() => { hapticLight(); setSelectedTargetVisit(v); setStep(4) }}
                          style={({ pressed }) => [[styles.visitOption, { backgroundColor: c.surfaceAlt, borderColor: c.borderLight }, pressed && { opacity: 0.8 }]]}>
                          <View style={styles.visitOptionHeader}>
                            <Text style={[styles.visitOptionLabel, { color: c.ink }]}>{v.label}</Text>
                            <Text style={[styles.visitOptionTime, { color: c.primary }]}>{time(v.scheduled_start)}</Text>
                          </View>
                          <Text style={[styles.visitOptionMeta, { color: c.muted }]}>{v.person_name} · {dateLabel(v.scheduled_start)}</Text>
                        </Pressable>
                      ))}
                      {targetVisits.length === 0 && (
                        <Text style={[styles.noVisits, { color: c.subtle }]}>They have no scheduled calls to swap.</Text>
                      )}
                    </View>
                  )}
                </>
              )}

              {/* Step 3 (transfer) or Step 4 (swap): Summary + message */}
              {(step === (requestType === 'swap' ? 4 : 3)) && (
                <>
                  <Text style={[styles.stepTitle, { color: c.ink }]}>Review & submit</Text>

                  {/* Summary card */}
                  <View style={[styles.summaryCard, { backgroundColor: c.surfaceAlt, borderColor: c.borderLight }]}>
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: c.subtle }]}>Your call</Text>
                      <Text style={[styles.summaryValue, { color: c.ink }]}>{selectedVisit?.label}</Text>
                      <Text style={[styles.summaryMeta, { color: c.muted }]}>{dateLabel(selectedVisit?.scheduled_start || '')} {time(selectedVisit?.scheduled_start || '')}</Text>
                    </View>
                    {requestType === 'swap' && selectedTargetVisit && (
                      <>
                        <View style={[styles.summaryDivider, { backgroundColor: c.border }]} />
                        <View style={styles.summaryRow}>
                          <Text style={[styles.summaryLabel, { color: c.subtle }]}>Their call</Text>
                          <Text style={[styles.summaryValue, { color: c.ink }]}>{selectedTargetVisit.label}</Text>
                          <Text style={[styles.summaryMeta, { color: c.muted }]}>{dateLabel(selectedTargetVisit.scheduled_start)} {time(selectedTargetVisit.scheduled_start)}</Text>
                        </View>
                      </>
                    )}
                    <View style={[styles.summaryDivider, { backgroundColor: c.border }]} />
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: c.subtle }]}>{requestType === 'swap' ? 'Swap with' : 'Transfer to'}</Text>
                      <Text style={[styles.summaryValue, { color: c.ink }]}>{targetStaff?.first_name} {targetStaff?.last_name}</Text>
                    </View>
                  </View>

                  <Text style={[styles.fieldLabel, { color: c.inkLight }]}>Message (optional)</Text>
                  <TextInput value={message} onChangeText={setMessage}
                    placeholder="Why are you requesting this?" placeholderTextColor={c.subtle}
                    multiline style={[styles.input, styles.textArea, { borderColor: c.border, backgroundColor: c.surfaceAlt, color: c.ink }]} />

                  <PrimaryButton
                    label={requestType === 'swap' ? 'Submit swap request' : 'Submit transfer'}
                    onPress={handleSubmit}
                    loading={saving}
                    disabled={saving || !selectedVisit || !targetStaff}
                    tone="primary"
                  />
                </>
              )}
            </ScrollView>

            {/* Navigation buttons */}
            <View style={styles.navRow}>
              {step > 1 && (
                <Pressable onPress={() => { hapticLight(); setStep(s => s - 1) }} style={styles.navBack}>
                  <Text style={[styles.navBackText, { color: c.primary }]}>← Back</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setModalOpen(false)} style={styles.cancelBtn}>
                <Text style={[styles.cancelText, { color: c.muted }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xxxl },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.base },
  backArrow: { fontFamily: FONT, fontSize: 18, color: colors.primary, fontWeight: '600' },
  backText: { fontFamily: FONT, fontSize: 15, fontWeight: '500', color: colors.primary },
  title: { fontFamily: FONT, fontSize: 22, fontWeight: '700', color: colors.ink, letterSpacing: -0.4, marginBottom: spacing.xs },
  subtitle: { fontFamily: FONT, fontSize: 14, fontWeight: '400', color: colors.muted, marginBottom: spacing.base },

  /* Action cards */
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base },
  actionCard: {
    flex: 1, borderRadius: radii.lg, borderWidth: 1,
    padding: spacing.base, gap: spacing.xs, ...elevation.sm,
  },
  actionIcon: { fontSize: 24 },
  actionTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },
  actionDesc: { fontFamily: FONT, fontSize: 11, fontWeight: '400' },

  /* Filter */
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base },
  filterBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.sm, borderWidth: 1 },
  filterText: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },

  /* Empty */
  emptyCard: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.xxl, alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight },
  emptyTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '700', color: colors.ink, marginBottom: spacing.xs },
  emptyCopy: { fontFamily: FONT, fontSize: 13, fontWeight: '400', color: colors.muted, textAlign: 'center' },

  /* Request cards */
  reqCard: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.base, marginBottom: spacing.sm, ...elevation.sm },
  reqHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  reqTypeBadge: { paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: radii.full },
  reqTypeText: { fontFamily: FONT, fontSize: 11, fontWeight: '600' },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: radii.full },
  statusText: { fontFamily: FONT, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  reqVisit: { fontFamily: FONT, fontSize: 15, fontWeight: '700', color: colors.ink },
  reqClient: { fontFamily: FONT, fontSize: 12, fontWeight: '400', color: colors.muted, marginTop: 2 },
  reqMeta: { fontFamily: FONT, fontSize: 12, fontWeight: '400', color: colors.subtle, marginTop: spacing.xs },
  reqMsg: { fontFamily: FONT, fontSize: 12, fontWeight: '400', marginTop: spacing.sm, fontStyle: 'italic', color: colors.inkLight },
  reqActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modal: { borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.xl, ...elevation.lg },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.base },

  /* Step indicator */
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.base, gap: 0 },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontFamily: FONT, fontSize: 11, fontWeight: '700' },
  stepLabel: { fontFamily: FONT, fontSize: 10, fontWeight: '600', marginLeft: spacing.xs, maxWidth: 50 },
  stepLine: { width: 24, height: 2, marginHorizontal: spacing.xs },

  /* Step content */
  stepTitle: { fontFamily: FONT, fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: spacing.xs },
  stepDesc: { fontFamily: FONT, fontSize: 13, fontWeight: '400', color: colors.muted, marginBottom: spacing.base },

  /* Visit list */
  visitList: { gap: spacing.sm },
  visitOption: { borderRadius: radii.md, borderWidth: 1, padding: spacing.md },
  visitOptionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  visitOptionLabel: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: colors.ink, flex: 1 },
  visitOptionTime: { fontFamily: FONT, fontSize: 13, fontWeight: '700', color: colors.primary },
  visitOptionMeta: { fontFamily: FONT, fontSize: 12, fontWeight: '400', color: colors.muted, marginTop: 2 },
  noVisits: { fontFamily: FONT, fontSize: 13, fontWeight: '500', color: colors.subtle, textAlign: 'center', paddingVertical: spacing.base },

  /* Team list */
  teamList: { gap: spacing.sm },
  teamOption: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderRadius: radii.md, borderWidth: 1.5,
  },
  teamAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  teamAvatarText: { fontFamily: FONT, fontSize: 14, fontWeight: '700' },
  teamName: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: colors.ink },

  /* Summary */
  summaryCard: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.base, marginBottom: spacing.base, gap: spacing.sm },
  summaryRow: { gap: 2 },
  summaryLabel: { fontFamily: FONT, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontFamily: FONT, fontSize: 15, fontWeight: '700', color: colors.ink },
  summaryMeta: { fontFamily: FONT, fontSize: 12, fontWeight: '400', color: colors.muted },
  summaryDivider: { height: 1, marginVertical: spacing.xs },

  /* Form */
  fieldLabel: { fontFamily: FONT, fontSize: 12, fontWeight: '600', color: colors.inkLight, marginTop: spacing.base, marginBottom: spacing.sm },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.base, paddingVertical: spacing.md, color: colors.ink, fontFamily: FONT, fontSize: 14 },
  textArea: { minHeight: 70, textAlignVertical: 'top', paddingTop: spacing.md },

  /* Loading */
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  loadingText: { fontFamily: FONT, fontSize: 13, fontWeight: '500', color: colors.muted },

  /* Nav */
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.base, paddingTop: spacing.base, borderTopWidth: 1, borderTopColor: colors.borderLight },
  navBack: { paddingVertical: spacing.sm },
  navBackText: { fontFamily: FONT, fontSize: 14, fontWeight: '600' },
  cancelBtn: { paddingVertical: spacing.sm },
  cancelText: { fontFamily: FONT, fontSize: 14, fontWeight: '600' },
})
