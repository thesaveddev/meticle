import { useState } from 'react'
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, elevation, radii, spacing, type } from '../theme'
import type { HomecareVisit, OfflineVisitAction, VisitAction } from '../types'
import { PrimaryButton } from '../components/PrimaryButton'
import { getVisitLocation } from '../services/location'

function time(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function statusColor(status: string) {
  switch (status) {
    case 'completed': return colors.success
    case 'checked_in': return colors.primary
    case 'en_route': return colors.accent
    case 'missed': return colors.danger
    default: return colors.subtle
  }
}

export function VisitScreen({ visit, onBack, onAction, onDisruption, queue, onClientDetail, onReportIncident }: {
  visit: HomecareVisit
  onBack: () => void
  onAction: (action: VisitAction, payload: OfflineVisitAction['payload']) => Promise<{ synced: boolean }>
  onDisruption: (body: Record<string, unknown>) => Promise<void>
  queue: OfflineVisitAction[]
  onClientDetail?: (personId: string) => void
  onReportIncident?: () => void
}) {
  const [note, setNote] = useState('')
  const [travelMinutes, setTravelMinutes] = useState('')
  const [mileage, setMileage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [disruptionOpen, setDisruptionOpen] = useState(false)
  const [disruption, setDisruption] = useState('')

  const isOpen = !['completed', 'cancelled', 'missed'].includes(visit.status)
  const checkedIn = visit.status === 'checked_in'
  const sColor = statusColor(visit.status)

  async function execute(action: VisitAction) {
    setBusy(true); setError(''); setSuccess('')
    try {
      const location = await getVisitLocation()
      const result = await onAction(action, {
        ...location,
        actual_travel_minutes: travelMinutes ? Number(travelMinutes) : undefined,
        actual_mileage_miles: mileage ? Number(mileage) : undefined,
        note: note.trim() || undefined,
      })
      setSuccess(
        result.synced
          ? action === 'check-in'
            ? 'Checked in. Location recorded.'
            : 'Call completed and saved.'
          : 'Saved offline. Will sync when you reconnect.',
      )
    } catch (e: any) {
      setError(e.message || 'Could not record this action.')
    } finally {
      setBusy(false)
    }
  }

  async function reportDisruption() {
    if (!disruption.trim()) return
    setBusy(true); setError('')
    try {
      await onDisruption({
        disruption_type: 'other',
        severity: 'medium',
        description: disruption.trim(),
        delay_minutes: Number(travelMinutes) || 0,
      })
      setDisruption(''); setDisruptionOpen(false)
      setSuccess('Issue reported to the office.')
    } catch (e: any) {
      setError(e.message || 'Could not report.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Back */}
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Today</Text>
        </Pressable>

        {/* Client card */}
        <View style={styles.clientCard}>
          <View style={styles.clientHeader}>
            <View style={styles.clientInfo}>
              <Text style={styles.clientName}>{visit.label}</Text>
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{time(visit.scheduled_start)} – {time(visit.scheduled_end)}</Text>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: sColor + '18' }]}>
              <Text style={[styles.statusText, { color: sColor }]}>
                {visit.status.replace('_', ' ')}
              </Text>
            </View>
          </View>

          {visit.person_name && (
            <View style={styles.personSection}>
              <Text style={styles.personName}>{visit.person_name}</Text>
              {visit.person_address && (
                <Text style={styles.personAddr}>📍 {visit.person_address}</Text>
              )}
              {onClientDetail && visit.person_id && (
                <Pressable onPress={() => onClientDetail(visit.person_id!)}>
                  <Text style={styles.viewClient}>View client details →</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Messages */}
        {success ? (
          <View style={styles.successBanner}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorIcon}>!</Text>
            <Text accessibilityRole="alert" style={styles.errorMsg}>{error}</Text>
          </View>
        ) : null}

        {/* Visit record form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Visit record</Text>
          <Text style={styles.formHelper}>
            Location is captured at check-in and check-out only. MeticleCare does not track you continuously.
          </Text>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Travel (min)</Text>
              <TextInput
                keyboardType="number-pad"
                value={travelMinutes}
                onChangeText={setTravelMinutes}
                placeholder="—"
                placeholderTextColor={colors.subtle}
                style={styles.input}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.fieldLabel}>Mileage (mi)</Text>
              <TextInput
                keyboardType="decimal-pad"
                value={mileage}
                onChangeText={setMileage}
                placeholder="—"
                placeholderTextColor={colors.subtle}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Visit note</Text>
            <TextInput
              multiline
              value={note}
              onChangeText={setNote}
              placeholder="Record what happened factually"
              placeholderTextColor={colors.subtle}
              style={[styles.input, styles.textArea]}
            />
          </View>
        </View>

        {/* Actions */}
        {isOpen && (
          <View style={styles.actions}>
            {!checkedIn && visit.status !== 'completed' && (
              <PrimaryButton
                label="Check in"
                onPress={() => execute('check-in')}
                loading={busy}
                disabled={busy}
                tone="primary"
              />
            )}
            {checkedIn && (
              <PrimaryButton
                label="Check out and save"
                onPress={() => execute('check-out')}
                loading={busy}
                disabled={busy}
                tone="success"
              />
            )}
          </View>
        )}

        {isOpen && (
          <Pressable onPress={() => setDisruptionOpen(true)} style={styles.disruptionBtn}>
            <Text style={styles.disruptionText}>⚠ Report a delay or safety issue</Text>
          </Pressable>
        )}

        {onReportIncident && (
          <Pressable onPress={onReportIncident} style={styles.disruptionBtn}>
            <Text style={[styles.disruptionText, { color: colors.danger }]}>🚨 Report an incident</Text>
          </Pressable>
        )}

        {queue.length > 0 && (
          <Text style={styles.queueNote}>{queue.length} action{queue.length === 1 ? '' : 's'} waiting to sync.</Text>
        )}
      </ScrollView>

      {/* Disruption modal */}
      <Modal visible={disruptionOpen} transparent animationType="fade" onRequestClose={() => setDisruptionOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Report a disruption</Text>
            <Text style={styles.modalHelper}>
              Tell the office what is affecting this call. They will follow the escalation procedure.
            </Text>
            <TextInput
              multiline
              autoFocus
              value={disruption}
              onChangeText={setDisruption}
              placeholder="What is happening?"
              placeholderTextColor={colors.subtle}
              style={[styles.input, styles.textArea]}
            />
            <PrimaryButton
              label="Send to office"
              onPress={reportDisruption}
              loading={busy}
              disabled={busy || !disruption.trim()}
              tone="danger"
            />
            <Pressable onPress={() => setDisruptionOpen(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xxxl },

  /* Back */
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.base },
  backArrow: { fontFamily: 'System', fontSize: 18, color: colors.primary, fontWeight: '600' },
  backText: { fontFamily: 'System', fontSize: 15, fontWeight: '500', color: colors.primary },

  /* Client card */
  clientCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.base,
    ...elevation.sm,
  },
  clientHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  clientInfo: { flex: 1 },
  clientName: { fontFamily: 'System', fontSize: 20, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  timeText: { fontFamily: 'System', fontSize: 14, fontWeight: '500', color: colors.primary },
  statusBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full },
  statusText: { fontFamily: 'System', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  personSection: { borderTopWidth: 1, borderTopColor: colors.borderLight, marginTop: spacing.md, paddingTop: spacing.md },
  personName: { ...type.bodyBold, fontSize: 16 },
  personAddr: { ...type.small, marginTop: spacing.xs },
  viewClient: { fontFamily: 'System', fontSize: 13, fontWeight: '600', color: colors.primary, marginTop: spacing.sm },

  /* Messages */
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.successSurface, padding: spacing.md, borderRadius: radii.md, marginTop: spacing.base,
  },
  successIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.success, color: colors.inverse, textAlign: 'center', lineHeight: 22, fontSize: 13, fontWeight: '700' },
  successText: { ...type.small, color: colors.successDeep, flex: 1 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.dangerSurface, padding: spacing.md, borderRadius: radii.md, marginTop: spacing.base,
  },
  errorIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, color: colors.inverse, textAlign: 'center', lineHeight: 22, fontSize: 13, fontWeight: '700' },
  errorMsg: { ...type.small, color: colors.dangerDeep, flex: 1 },

  /* Form */
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.base,
    marginTop: spacing.base,
    gap: spacing.md,
    ...elevation.sm,
  },
  formTitle: { ...type.bodyBold, fontSize: 16 },
  formHelper: { ...type.small, marginTop: -spacing.xs },
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  fieldHalf: { flex: 1 },
  fieldGroup: { gap: spacing.xs },
  fieldLabel: { fontFamily: 'System', fontSize: 12, fontWeight: '600', color: colors.inkLight, marginBottom: spacing.xs },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.ink,
    fontFamily: 'System',
    fontSize: 15,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top', paddingTop: spacing.md },

  /* Actions */
  actions: { marginTop: spacing.base, gap: spacing.sm },

  /* Disruption */
  disruptionBtn: { alignItems: 'center', paddingVertical: spacing.base, marginTop: spacing.xs },
  disruptionText: { fontFamily: 'System', fontSize: 14, fontWeight: '500', color: colors.danger },
  queueNote: { ...type.caption, textAlign: 'center', marginTop: spacing.base },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(28, 25, 23, 0.5)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.base,
    ...elevation.lg,
  },
  modalTitle: { ...type.title },
  modalHelper: { ...type.small, marginTop: -spacing.sm },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { fontFamily: 'System', fontSize: 15, fontWeight: '600', color: colors.primary },
})
