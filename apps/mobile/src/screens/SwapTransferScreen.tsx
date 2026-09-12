import { useEffect, useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, elevation, radii, spacing, type, FONT, useAppColors } from '../theme'
import type { AuthSession, HomecareVisit, MobileUser } from '../types'
import { PrimaryButton } from '../components/PrimaryButton'

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
  const [newRequestOpen, setNewRequestOpen] = useState(false)
  const [selectedVisit, setSelectedVisit] = useState<HomecareVisit | null>(null)
  const [targetStaff, setTargetStaff] = useState<string | null>(null)
  const [requestType, setRequestType] = useState<'swap' | 'transfer'>('swap')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all')

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

  const handleSubmit = async () => {
    if (!selectedVisit) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/homecare/swap-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessToken}` },
        body: JSON.stringify({
          visit_id: selectedVisit.id,
          target_staff_id: targetStaff || undefined,
          request_type: requestType,
          message: message.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Could not submit')
      }
      setNewRequestOpen(false)
      setSelectedVisit(null)
      setTargetStaff(null)
      setMessage('')
      await load()
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not submit request')
    } finally {
      setSaving(false)
    }
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
      Alert.alert('Error', e.message || 'Could not respond')
    }
  }

  const filtered = requests.filter(r => {
    if (filter === 'sent') return r.requested_by_name === (user.first_name || user.email)
    if (filter === 'received') return r.target_name === (user.first_name || user.email)
    return true
  })

  const pendingRequests = requests.filter(r => r.status === 'pending')

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Swap & Transfer</Text>
        <Text style={styles.subtitle}>{pendingRequests.length} pending request{pendingRequests.length !== 1 ? 's' : ''}</Text>

        {/* New request button */}
        <Pressable onPress={() => setNewRequestOpen(true)} style={({ pressed }) => [styles.newReqCard, pressed && { opacity: 0.8 }]}>
          <Text style={styles.newReqIcon}>🔄</Text>
          <View style={styles.newReqInfo}>
            <Text style={styles.newReqTitle}>New request</Text>
            <Text style={styles.newReqDesc}>Swap or transfer one of your upcoming calls</Text>
          </View>
          <Text style={styles.newReqArrow}>→</Text>
        </Pressable>

        {/* Filter */}
        <View style={styles.filterRow}>
          {(['all', 'sent', 'received'] as const).map(f => (
            <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterBtn, filter === f && styles.filterActive]}>
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
            </Pressable>
          ))}
        </View>

        {/* Request list */}
        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No requests</Text>
            <Text style={styles.emptyCopy}>Swap and transfer requests will appear here.</Text>
          </View>
        ) : (
          filtered.map(req => (
            <View key={req.id} style={styles.reqCard}>
              <View style={styles.reqHeader}>
                <View style={[styles.reqTypeBadge, { backgroundColor: req.request_type === 'swap' ? colors.primarySurface : colors.accentSurface }]}>
                  <Text style={[styles.reqTypeText, { color: req.request_type === 'swap' ? colors.primary : colors.accent }]}>
                    {req.request_type === 'swap' ? '🔄 Swap' : '➡️ Transfer'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: req.status === 'pending' ? colors.warningSurface : req.status === 'accepted' ? colors.successSurface : colors.dangerSurface }]}>
                  <Text style={[styles.statusText, { color: req.status === 'pending' ? colors.warning : req.status === 'accepted' ? colors.success : colors.danger }]}>
                    {req.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.reqVisit}>{req.visit_label}</Text>
              <Text style={styles.reqClient}>{req.client_name} · {dateLabel(req.scheduled_start)} {time(req.scheduled_start)}–{time(req.scheduled_end)}</Text>
              <Text style={styles.reqMeta}>By {req.requested_by_name}{req.target_name ? ` → ${req.target_name}` : ''}</Text>
              {req.message && <Text style={styles.reqMsg}>{req.message}</Text>}

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

      {/* New request modal */}
      <Modal visible={newRequestOpen} transparent animationType="fade" onRequestClose={() => setNewRequestOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>New request</Text>

              <Text style={styles.fieldLabel}>Request type</Text>
              <View style={styles.chipRow}>
                <Pressable onPress={() => setRequestType('swap')} style={[styles.chip, requestType === 'swap' && styles.chipActive]}>
                  <Text style={[styles.chipText, requestType === 'swap' && styles.chipTextActive]}>🔄 Swap</Text>
                </Pressable>
                <Pressable onPress={() => setRequestType('transfer')} style={[styles.chip, requestType === 'transfer' && styles.chipActive]}>
                  <Text style={[styles.chipText, requestType === 'transfer' && styles.chipTextActive]}>➡️ Transfer</Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Select a call</Text>
              <View style={styles.visitList}>
                {visits.filter(v => v.status === 'scheduled').map(v => (
                  <Pressable key={v.id} onPress={() => setSelectedVisit(v)} style={[styles.visitOption, selectedVisit?.id === v.id && styles.visitOptionActive]}>
                    <Text style={styles.visitOptionLabel}>{v.label}</Text>
                    <Text style={styles.visitOptionMeta}>{v.person_name} · {dateLabel(v.scheduled_start)} {time(v.scheduled_start)}</Text>
                  </Pressable>
                ))}
                {visits.filter(v => v.status === 'scheduled').length === 0 && (
                  <Text style={styles.noVisits}>No scheduled calls available</Text>
                )}
              </View>

              {requestType === 'swap' && (
                <>
                  <Text style={styles.fieldLabel}>Swap with (optional)</Text>
                  <View style={styles.teamList}>
                    {team.map(m => (
                      <Pressable key={m.id} onPress={() => setTargetStaff(targetStaff === m.id ? null : m.id)} style={[styles.teamOption, targetStaff === m.id && styles.teamOptionActive]}>
                        <Text style={[styles.teamName, targetStaff === m.id && { color: colors.inverse }]}>{m.first_name} {m.last_name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {requestType === 'transfer' && (
                <>
                  <Text style={styles.fieldLabel}>Transfer to *</Text>
                  <View style={styles.teamList}>
                    {team.map(m => (
                      <Pressable key={m.id} onPress={() => setTargetStaff(m.id)} style={[styles.teamOption, targetStaff === m.id && styles.teamOptionActive]}>
                        <Text style={[styles.teamName, targetStaff === m.id && { color: colors.inverse }]}>{m.first_name} {m.last_name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.fieldLabel}>Message (optional)</Text>
              <TextInput value={message} onChangeText={setMessage} placeholder="Why are you requesting this?" placeholderTextColor={colors.subtle} multiline style={[styles.input, styles.textArea]} />

              <PrimaryButton label="Submit request" onPress={handleSubmit} loading={saving} disabled={saving || !selectedVisit || (requestType === 'transfer' && !targetStaff)} />
              <Pressable onPress={() => setNewRequestOpen(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xxxl },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.base },
  backArrow: { fontFamily: 'System', fontSize: 18, color: colors.primary, fontWeight: '600' },
  backText: { fontFamily: 'System', fontSize: 15, fontWeight: '500', color: colors.primary },
  title: { ...type.title, marginBottom: spacing.xs },
  subtitle: { ...type.body, color: colors.muted, marginBottom: spacing.base },

  /* New request */
  newReqCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primarySurface,
    borderRadius: radii.lg, borderWidth: 1, borderColor: colors.primary + '20',
    padding: spacing.base, marginBottom: spacing.base, gap: spacing.md, ...elevation.sm,
  },
  newReqIcon: { fontSize: 24 },
  newReqInfo: { flex: 1 },
  newReqTitle: { fontFamily: 'System', fontSize: 15, fontWeight: '700', color: colors.primary },
  newReqDesc: { ...type.small, marginTop: 2 },
  newReqArrow: { fontFamily: 'System', fontSize: 18, color: colors.primary, fontWeight: '600' },

  /* Filter */
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base },
  filterBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { fontFamily: 'System', fontSize: 12, fontWeight: '600', color: colors.muted },
  filterTextActive: { color: colors.inverse },

  /* Empty */
  emptyCard: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.xxl, alignItems: 'center', borderWidth: 1, borderColor: colors.borderLight },
  emptyIcon: { fontSize: 32, marginBottom: spacing.md },
  emptyTitle: { ...type.bodyBold, marginBottom: spacing.xs },
  emptyCopy: { ...type.small, textAlign: 'center', paddingHorizontal: spacing.lg },

  /* Request cards */
  reqCard: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.base, marginBottom: spacing.sm, ...elevation.sm },
  reqHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  reqTypeBadge: { paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: radii.full },
  reqTypeText: { fontFamily: 'System', fontSize: 11, fontWeight: '600' },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: 3, borderRadius: radii.full },
  statusText: { fontFamily: 'System', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  reqVisit: { ...type.bodyBold, fontSize: 15 },
  reqClient: { ...type.small, marginTop: 2 },
  reqMeta: { ...type.small, marginTop: spacing.xs },
  reqMsg: { ...type.small, marginTop: spacing.sm, fontStyle: 'italic', color: colors.inkLight },
  reqActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(28,25,23,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.xl, maxHeight: '85%', ...elevation.lg },
  modalTitle: { ...type.title, marginBottom: spacing.base },

  fieldLabel: { fontFamily: 'System', fontSize: 12, fontWeight: '600', color: colors.inkLight, marginTop: spacing.base, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.sm, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: 'System', fontSize: 13, fontWeight: '600', color: colors.muted },
  chipTextActive: { color: colors.inverse },

  visitList: { gap: spacing.sm },
  visitOption: { backgroundColor: colors.surface, borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderLight, padding: spacing.md },
  visitOptionActive: { backgroundColor: colors.primarySurface, borderColor: colors.primary + '30' },
  visitOptionLabel: { ...type.bodyBold, fontSize: 14 },
  visitOptionMeta: { ...type.small, marginTop: 2 },
  noVisits: { ...type.small, textAlign: 'center', paddingVertical: spacing.base },

  teamList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  teamOption: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.sm, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  teamOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  teamName: { fontFamily: 'System', fontSize: 13, fontWeight: '600', color: colors.muted },

  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface, paddingHorizontal: spacing.base, paddingVertical: spacing.md, color: colors.ink, fontFamily: 'System', fontSize: 15 },
  textArea: { minHeight: 70, textAlignVertical: 'top', paddingTop: spacing.md },

  cancelBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { fontFamily: 'System', fontSize: 15, fontWeight: '600', color: colors.primary },
})
