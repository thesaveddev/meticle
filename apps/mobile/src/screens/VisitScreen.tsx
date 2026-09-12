import { useState } from 'react'
import { Alert, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, commonStyles, radii, spacing, type } from '../theme'
import type { HomecareVisit, OfflineVisitAction, VisitAction } from '../types'
import { PrimaryButton } from '../components/PrimaryButton'
import { getVisitLocation } from '../services/location'

function time(value: string) { return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }

export function VisitScreen({ visit, onBack, onAction, onDisruption, queue, onClientDetail }: { visit: HomecareVisit; onBack: () => void; onAction: (action: VisitAction, payload: OfflineVisitAction['payload']) => Promise<{ synced: boolean }>; onDisruption: (body: Record<string, unknown>) => Promise<void>; queue: OfflineVisitAction[]; onClientDetail?: (personId: string) => void }) {
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

  async function execute(action: VisitAction) {
    setBusy(true); setError(''); setSuccess('')
    try {
      const location = await getVisitLocation()
      const result = await onAction(action, { ...location, actual_travel_minutes: travelMinutes ? Number(travelMinutes) : undefined, actual_mileage_miles: mileage ? Number(mileage) : undefined, note: note.trim() || undefined })
      setSuccess(result.synced ? action === 'check-in' ? 'Checked in. Your location was recorded.' : 'Visit completed and note saved.' : 'Saved on this device. It will sync when you are back online.')
    } catch (e: any) { setError(e.message || 'Could not record this visit.') } finally { setBusy(false) }
  }

  async function reportDisruption() {
    if (!disruption.trim()) return
    setBusy(true); setError('')
    try { await onDisruption({ disruption_type: 'other', severity: 'medium', description: disruption.trim(), delay_minutes: Number(travelMinutes) || 0 }); setDisruption(''); setDisruptionOpen(false); setSuccess('Disruption reported to the office.') } catch (e: any) { setError(e.message || 'Could not report the disruption.') } finally { setBusy(false) }
  }

  return <SafeAreaView style={commonStyles.screen}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.back} onPress={onBack}>Back to today</Text>
      <View style={styles.heading}><Text style={type.display}>{visit.label}</Text><Text style={styles.status}>{visit.status.replace('_', ' ')}</Text></View>
      <Text style={styles.time}>{time(visit.scheduled_start)} to {time(visit.scheduled_end)}</Text>
      {visit.person_name && <View style={styles.personBlock}><Text style={styles.person}>{visit.person_name}</Text>{visit.person_address && <Text style={styles.address}>{visit.person_address}</Text>}{onClientDetail && visit.person_id && <Text style={styles.viewClient} onPress={() => onClientDetail(visit.person_id!)}>View client details →</Text>}</View>}

      {success && <View style={styles.success}><Text style={styles.successText}>{success}</Text></View>}
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

      <View style={styles.section}><Text style={styles.sectionTitle}>Visit record</Text><Text style={styles.helper}>Location is captured once when you check in and once when you check out. MeticleCare does not continuously track you.</Text>
        <View style={styles.fieldGroup}><Text style={styles.label}>Travel time in minutes</Text><TextInput keyboardType="number-pad" value={travelMinutes} onChangeText={setTravelMinutes} placeholder="Optional" placeholderTextColor={colors.mist} style={commonStyles.field} /></View>
        <View style={styles.fieldGroup}><Text style={styles.label}>Mileage in miles</Text><TextInput keyboardType="decimal-pad" value={mileage} onChangeText={setMileage} placeholder="Optional" placeholderTextColor={colors.mist} style={commonStyles.field} /></View>
        <View style={styles.fieldGroup}><Text style={styles.label}>Visit note</Text><TextInput multiline value={note} onChangeText={setNote} placeholder="Record what happened factually" placeholderTextColor={colors.mist} style={[commonStyles.field, styles.note]} /></View>
      </View>

      {isOpen && <View style={styles.actions}>{!checkedIn && visit.status !== 'completed' && <PrimaryButton label="Check in" onPress={() => execute('check-in')} loading={busy} disabled={busy} tone="emerald" />}{checkedIn && <PrimaryButton label="Check out and save" onPress={() => execute('check-out')} loading={busy} disabled={busy} />}</View>}
      {isOpen && <Text style={styles.disruptionLink} onPress={() => setDisruptionOpen(true)}>Report a delay or safety issue</Text>}
      {queue.length > 0 && <Text style={styles.queueNote}>{queue.length} action{queue.length === 1 ? '' : 's'} waiting to sync.</Text>}
    </ScrollView>

    <Modal visible={disruptionOpen} transparent animationType="fade" onRequestClose={() => setDisruptionOpen(false)}>
      <View style={styles.modalBackdrop}><View style={styles.modal}><Text style={type.title}>Report a disruption</Text><Text style={styles.helper}>Tell the office what is affecting this visit. They will follow the organisation's escalation procedure.</Text><TextInput multiline autoFocus value={disruption} onChangeText={setDisruption} placeholder="What is happening?" placeholderTextColor={colors.mist} style={[commonStyles.field, styles.note]} /><PrimaryButton label="Send to office" onPress={reportDisruption} loading={busy} disabled={busy || !disruption.trim()} /><Text style={styles.cancel} onPress={() => setDisruptionOpen(false)}>Cancel</Text></View></View>
    </Modal>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  content: { ...commonStyles.content, paddingTop: spacing.lg },
  back: { ...type.label, color: colors.navy, marginBottom: spacing.xl },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  status: { ...type.caption, color: colors.mist, textTransform: 'capitalize', paddingTop: 8 },
  time: { ...type.bodyStrong, color: colors.navy, marginTop: spacing.sm },
  personBlock: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.hairline, paddingVertical: spacing.md, marginTop: spacing.lg },
  person: { ...type.title, color: colors.ink },
  address: { ...type.body, color: colors.mist, marginTop: 2 },
  viewClient: { ...type.label, color: colors.navy, marginTop: spacing.sm },
  section: { marginTop: spacing.xxl, gap: spacing.md },
  sectionTitle: { ...type.title, color: colors.ink },
  helper: { ...type.caption, color: colors.mist },
  fieldGroup: { gap: spacing.xs },
  label: { ...type.label, color: colors.ink },
  note: { minHeight: 100, textAlignVertical: 'top', paddingTop: spacing.sm },
  actions: { marginTop: spacing.xl },
  success: { backgroundColor: colors.successSoft, padding: spacing.md, borderRadius: radii.sm, marginTop: spacing.lg },
  successText: { ...type.body, color: colors.emeraldDeep },
  error: { ...type.body, color: colors.error, marginTop: spacing.lg },
  disruptionLink: { ...type.bodyStrong, color: colors.error, textAlign: 'center', paddingVertical: spacing.lg },
  queueNote: { ...type.caption, color: colors.mist, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(27, 36, 48, 0.42)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bone, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.lg, gap: spacing.md },
  cancel: { ...type.bodyStrong, color: colors.navy, textAlign: 'center', paddingVertical: spacing.sm },
})
