import { useEffect, useRef, useState } from 'react'
import { Alert, Animated, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'

import { colors, elevation, radii, spacing, type, FONT, useAppColors } from '../theme'
import type { HomecareVisit, OfflineVisitAction, VisitAction, AuthSession } from '../types'
import { PrimaryButton } from '../components/PrimaryButton'
import { getVisitLocation } from '../services/location'
import { IconBack, IconCheck, IconClock, IconCamera, IconGallery, IconWarning, IconIncident, IconNavigate } from '../components/Icons'
import { openNavigation } from '../services/navigation'
import { hapticLight, hapticWarning } from '../services/haptics'

function time(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function dateStamp() {
  return new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* ─── Animated pulse dot ────────────────────────────────────── */
function PulseDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, { toValue: 1.8, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])

  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: color, transform: [{ scale }], opacity }} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  )
}

/* ─── Status bar (top timeline indicator) ───────────────────── */
function VisitStatusTimeline({ status }: { status: string }) {
  const steps = ['scheduled', 'checked_in', 'completed']
  const currentIndex = steps.indexOf(status === 'en_route' ? 'scheduled' : status)

  return (
    <View style={styles.timeline}>
      {steps.map((step, i) => {
        const isActive = i <= currentIndex
        const isCurrent = i === currentIndex
        return (
          <View key={step} style={styles.timelineStep}>
            <View style={[styles.timelineDot, isActive && styles.timelineDotActive, isCurrent && { backgroundColor: colors.primary }]}>
              {isCurrent && status === 'checked_in' && <PulseDot color={colors.primary} />}
              {step === 'completed' && isActive && <IconCheck size={10} color={colors.inverse} />}
            </View>
            {i < steps.length - 1 && (
              <View style={[styles.timelineLine, i < currentIndex && styles.timelineLineActive]} />
            )}
          </View>
        )
      })}
    </View>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    completed: { color: colors.success, bg: colors.successSurface },
    checked_in: { color: colors.primary, bg: colors.primarySurface },
    en_route: { color: colors.warning, bg: colors.warningSurface },
    missed: { color: colors.danger, bg: colors.dangerSurface },
  }
  const { color, bg } = map[status] || { color: colors.subtle, bg: colors.surfaceAlt }
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]}>{status.replace('_', ' ')}</Text>
    </View>
  )
}

export function VisitScreen({ visit, session, onBack, onAction, onDisruption, queue, onClientDetail, onReportIncident }: {
  visit: HomecareVisit
  session?: AuthSession
  onBack: () => void
  onAction: (action: VisitAction, payload: OfflineVisitAction['payload']) => Promise<{ synced: boolean }>
  onDisruption: (body: Record<string, unknown>) => Promise<void>
  queue: OfflineVisitAction[]
  onClientDetail?: (personId: string) => void
  onReportIncident?: () => void
}) {
  const c = useAppColors()
  const [note, setNote] = useState('')
  const [travelMinutes, setTravelMinutes] = useState('')
  const [mileage, setMileage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [disruptionOpen, setDisruptionOpen] = useState(false)
  const [disruption, setDisruption] = useState('')
  const [checkedInAt, setCheckedInAt] = useState<string | null>(null)
  const [checkedInLocation, setCheckedInLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [photos, setPhotos] = useState<string[]>([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const isOpen = !['completed', 'cancelled', 'missed'].includes(visit.status)
  const checkedIn = visit.status === 'checked_in'

  const pickVisitPhoto = async () => {
    hapticLight()
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please grant photo library access.'); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true })
    if (!result.canceled) for (const asset of result.assets) await uploadVisitPhoto(asset.uri)
  }

  const takeVisitPhoto = async () => {
    hapticLight()
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please grant camera access.'); return }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 })
    if (!result.canceled && result.assets[0]) await uploadVisitPhoto(result.assets[0].uri)
  }

  const uploadVisitPhoto = async (uri: string) => {
    setUploadingPhoto(true)
    try {
      const filename = uri.split('/').pop() || 'photo.jpg'
      const ext = filename.split('.').pop()?.toLowerCase() || 'jpg'
      const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`

      // Use fetch to read file as blob — no deprecated expo-file-system API
      const response = await fetch(uri)
      const blob = await response.blob()

      const formData = new FormData()
      formData.append('file', blob, filename)
      const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://meticlecare.com/api'
      const res = await fetch(`${API_BASE}/settings/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.accessToken || ''}` },
        body: formData,
      })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setPhotos(prev => [...prev, data.url])
    } catch (e: any) { Alert.alert('Error', e.message || 'Could not upload photo') }
    finally { setUploadingPhoto(false) }
  }

  const removePhoto = (index: number) => { hapticLight(); setPhotos(prev => prev.filter((_, i) => i !== index)) }

  async function execute(action: VisitAction) {
    hapticLight(); setBusy(true); setError(''); setSuccess('')
    try {
      const location = await getVisitLocation()
      const result = await onAction(action, {
        ...location,
        actual_travel_minutes: travelMinutes ? Number(travelMinutes) : undefined,
        actual_mileage_miles: mileage ? Number(mileage) : undefined,
        note: note.trim() || undefined,
        photos: photos.length > 0 ? photos : undefined,
      })
      if (action === 'check-in') {
        setCheckedInAt(dateStamp())
        setCheckedInLocation(location.latitude ? { latitude: location.latitude, longitude: location.longitude } : null)
        setSuccess(result.synced ? `Checked in at ${dateStamp()}. Location recorded.` : 'Checked in offline. Will sync when you reconnect.')
      } else {
        setSuccess(result.synced ? `Call completed at ${dateStamp()}. Saved.` : 'Saved offline. Will sync when you reconnect.')
      }
    } catch (e: any) { setError(e.message || 'Could not record this action.') }
    finally { setBusy(false) }
  }

  async function reportDisruption() {
    if (!disruption.trim()) return
    hapticWarning(); setBusy(true); setError('')
    try {
      await onDisruption({ disruption_type: 'other', severity: 'medium', description: disruption.trim(), delay_minutes: Number(travelMinutes) || 0 })
      setDisruption(''); setDisruptionOpen(false); setSuccess('Issue reported to the office.')
    } catch (e: any) { setError(e.message || 'Could not report.') }
    finally { setBusy(false) }
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.bg }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => { hapticLight(); onBack() }} style={styles.backBtn}>
              <IconBack size={18} color={colors.primary} />
              <Text style={styles.backText}>Today</Text>
            </Pressable>
            <StatusPill status={visit.status} />
          </View>

          {/* Status timeline */}
          {isOpen && <VisitStatusTimeline status={visit.status} />}

          {/* Client info card */}
          <View style={styles.card}>
            <Text style={styles.clientName}>{visit.label}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <IconClock size={14} color={colors.primary} />
                <Text style={styles.metaText}>{time(visit.scheduled_start)} – {time(visit.scheduled_end)}</Text>
              </View>
            </View>

            {visit.person_name && (
              <>
                <View style={styles.divider} />
                <Text style={styles.personName}>{visit.person_name}</Text>
                {visit.person_address && <Text style={styles.personAddr}>{visit.person_address}</Text>}
                <View style={styles.clientActions}>
                  {onClientDetail && visit.person_id && (
                    <Pressable onPress={() => { hapticLight(); onClientDetail(visit.person_id!) }} style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}>
                      <Text style={styles.actionBtnText}>View file</Text>
                      <Text style={styles.actionBtnArrow}>→</Text>
                    </Pressable>
                  )}
                  {visit.person_address && (
                    <Pressable onPress={() => { hapticLight(); openNavigation({ destination: visit.person_address!, label: visit.person_name || visit.label }) }} style={({ pressed }) => [styles.actionBtn, styles.navigateBtn, pressed && { opacity: 0.7 }]}>
                      <IconNavigate size={14} color={colors.primary} />
                      <Text style={styles.navigateBtnText}>Navigate</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </View>

          {/* Check-in status */}
          {checkedIn && (
            <View style={styles.checkInCard}>
              <View style={styles.checkInRow}>
                <PulseDot color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkInTitle}>Checked in</Text>
                  {checkedInAt && <Text style={styles.checkInTime}>{checkedInAt}</Text>}
                </View>
                {checkedInLocation && (
                  <View style={styles.locBadge}>
                    <Text style={styles.locBadgeText}>GPS ✓</Text>
                  </View>
                )}
              </View>
              <Text style={styles.checkInHint}>Record what happened, then check out when you leave.</Text>
            </View>
          )}

          {/* Banners */}
          {success ? (
            <View style={styles.banner}>
              <View style={[styles.bannerDot, { backgroundColor: colors.success }]}><IconCheck size={10} color={colors.inverse} /></View>
              <Text style={[styles.bannerText, { color: colors.successDeep }]}>{success}</Text>
            </View>
          ) : null}
          {error ? (
            <View style={[styles.banner, { backgroundColor: colors.dangerSurface }]}>
              <View style={[styles.bannerDot, { backgroundColor: colors.danger }]}><Text style={styles.bannerDotText}>!</Text></View>
              <Text accessibilityRole="alert" style={[styles.bannerText, { color: colors.dangerDeep }]}>{error}</Text>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{checkedIn ? 'Visit notes' : 'Pre-visit details'}</Text>

            {!checkedIn && (
              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Travel (min)</Text>
                  <TextInput keyboardType="number-pad" value={travelMinutes} onChangeText={setTravelMinutes} placeholder="0" placeholderTextColor={colors.subtle} style={styles.input} />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Mileage (mi)</Text>
                  <TextInput keyboardType="decimal-pad" value={mileage} onChangeText={setMileage} placeholder="0.0" placeholderTextColor={colors.subtle} style={styles.input} />
                </View>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{checkedIn ? 'What happened during this call?' : 'Notes (optional)'}</Text>
              <TextInput multiline value={note} onChangeText={setNote}
                placeholder={checkedIn ? 'Care provided, observations, client mood...' : 'Any notes before you arrive'}
                placeholderTextColor={colors.subtle} style={[styles.input, styles.textArea]} />
            </View>
          </View>

          {/* Photos */}
          {checkedIn && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Photos</Text>
              <View style={styles.photoRow}>
                <Pressable onPress={pickVisitPhoto} style={({ pressed }) => [styles.photoAction, pressed && { opacity: 0.7 }]}>
                  <IconGallery size={16} color={colors.primary} />
                  <Text style={styles.photoActionText}>Gallery</Text>
                </Pressable>
                <Pressable onPress={takeVisitPhoto} style={({ pressed }) => [styles.photoAction, pressed && { opacity: 0.7 }]}>
                  <IconCamera size={16} color={colors.primary} />
                  <Text style={styles.photoActionText}>Camera</Text>
                </Pressable>
                {uploadingPhoto && <Text style={styles.uploadingText}>Uploading...</Text>}
              </View>
              {photos.length > 0 && (
                <View style={styles.photoGrid}>
                  {photos.map((url, i) => (
                    <View key={i} style={styles.photoThumb}>
                      <Image source={{ uri: `https://meticlecare.com${url}` }} style={styles.photoImage} />
                      <Pressable onPress={() => removePhoto(i)} style={styles.photoX}><Text style={styles.photoXText}>×</Text></Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Primary action */}
          {isOpen && (
            <View style={{ marginTop: spacing.base }}>
              {!checkedIn && visit.status !== 'completed' && (
                <PrimaryButton label="Check in" onPress={() => execute('check-in')} loading={busy} disabled={busy} tone="primary" />
              )}
              {checkedIn && (
                <PrimaryButton label="Check out and complete" onPress={() => execute('check-out')} loading={busy} disabled={busy} tone="success" />
              )}
            </View>
          )}

          {/* Secondary actions */}
          {isOpen && (
            <View style={styles.secondaryRow}>
              <Pressable onPress={() => { hapticLight(); setDisruptionOpen(true) }} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}>
                <IconWarning size={14} color={colors.warning} />
                <Text style={styles.secondaryText}>Delay</Text>
              </Pressable>
              {onReportIncident && (
                <Pressable onPress={() => { hapticLight(); onReportIncident() }} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}>
                  <IconIncident size={14} color={colors.danger} />
                  <Text style={[styles.secondaryText, { color: colors.danger }]}>Incident</Text>
                </Pressable>
              )}
            </View>
          )}

          {queue.length > 0 && (
            <Text style={styles.queueText}>{queue.length} action{queue.length === 1 ? '' : 's'} queued for sync</Text>
          )}

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Disruption modal */}
      <Modal visible={disruptionOpen} transparent animationType="slide" onRequestClose={() => setDisruptionOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Report a disruption</Text>
            <Text style={styles.modalHelper}>Tell the office what is affecting this call.</Text>
            <TextInput multiline autoFocus value={disruption} onChangeText={setDisruption}
              placeholder="What is happening?" placeholderTextColor={colors.subtle}
              style={[styles.input, styles.textArea]} />
            <PrimaryButton label="Send to office" onPress={reportDisruption} loading={busy} disabled={busy || !disruption.trim()} tone="danger" />
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
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.sm, paddingBottom: spacing.xxxl },

  /* Header */
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backText: { fontFamily: FONT, fontSize: 15, fontWeight: '600', color: colors.primary },

  /* Status pill */
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.full },
  pillDot: { width: 5, height: 5, borderRadius: 2.5 },
  pillText: { fontFamily: FONT, fontSize: 11, fontWeight: '700', textTransform: 'capitalize', letterSpacing: 0.3 },

  /* Timeline */
  timeline: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.base, paddingHorizontal: spacing.xs },
  timelineStep: { flexDirection: 'row', alignItems: 'center' },
  timelineDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  timelineDotActive: { backgroundColor: colors.success },
  timelineLine: { width: 40, height: 2, backgroundColor: colors.border, marginHorizontal: 4 },
  timelineLineActive: { backgroundColor: colors.success },

  /* Card */
  card: {
    backgroundColor: colors.surface, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.borderLight,
    padding: spacing.base, marginBottom: spacing.base, gap: spacing.sm,
    ...elevation.sm,
  },
  cardTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '700', color: colors.ink },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: spacing.xs },

  /* Client */
  clientName: { fontFamily: FONT, fontSize: 18, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  metaRow: { flexDirection: 'row', gap: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metaText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: colors.primary },
  personName: { fontFamily: FONT, fontSize: 15, fontWeight: '600', color: colors.ink },
  personAddr: { fontFamily: FONT, fontSize: 12, fontWeight: '400', color: colors.muted, marginTop: 1 },
  clientActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primarySurface, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, borderRadius: radii.md,
  },
  actionBtnText: { fontFamily: FONT, fontSize: 12, fontWeight: '600', color: colors.primary },
  actionBtnArrow: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: colors.primary },
  navigateBtn: { backgroundColor: colors.primarySurface, borderWidth: 1, borderColor: colors.primary + '25' },
  navigateBtnText: { fontFamily: FONT, fontSize: 12, fontWeight: '600', color: colors.primary },

  /* Check-in */
  checkInCard: {
    backgroundColor: colors.primarySurface, borderRadius: radii.lg,
    borderWidth: 1, borderColor: colors.primary + '20',
    padding: spacing.base, marginBottom: spacing.base,
  },
  checkInRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkInTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '700', color: colors.primary },
  checkInTime: { fontFamily: FONT, fontSize: 11, fontWeight: '500', color: colors.primaryLight, marginTop: 1 },
  locBadge: { backgroundColor: colors.primary + '20', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.sm },
  locBadgeText: { fontFamily: FONT, fontSize: 10, fontWeight: '700', color: colors.primary },
  checkInHint: { fontFamily: FONT, fontSize: 12, fontWeight: '400', color: colors.muted, marginTop: spacing.sm, lineHeight: 16 },

  /* Banners */
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.successSurface, padding: spacing.md,
    borderRadius: radii.md, marginBottom: spacing.base,
  },
  bannerDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  bannerDotText: { fontFamily: FONT, fontSize: 11, fontWeight: '800', color: colors.inverse },
  bannerText: { fontFamily: FONT, fontSize: 12, fontWeight: '500', flex: 1 },

  /* Form */
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  fieldHalf: { flex: 1 },
  fieldGroup: { gap: spacing.xs },
  fieldLabel: { fontFamily: FONT, fontSize: 11, fontWeight: '600', color: colors.inkLight, letterSpacing: 0.2 },
  input: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md,
    paddingVertical: spacing.md, color: colors.ink, fontFamily: FONT, fontSize: 14,
  },
  textArea: { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.md },

  /* Photos */
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  photoAction: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.md, backgroundColor: colors.primarySurface,
    borderWidth: 1, borderColor: colors.primary + '20',
  },
  photoActionText: { fontFamily: FONT, fontSize: 12, fontWeight: '600', color: colors.primary },
  uploadingText: { fontFamily: FONT, fontSize: 11, fontWeight: '500', color: colors.muted },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoThumb: { position: 'relative', width: 68, height: 68, borderRadius: radii.md, overflow: 'hidden' },
  photoImage: { width: 68, height: 68 },
  photoX: {
    position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center',
  },
  photoXText: { fontFamily: FONT, fontSize: 13, fontWeight: '700', color: colors.inverse, marginTop: -1 },

  /* Secondary */
  secondaryRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radii.md,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderLight,
  },
  secondaryText: { fontFamily: FONT, fontSize: 12, fontWeight: '600', color: colors.warning },

  /* Queue */
  queueText: { fontFamily: FONT, fontSize: 11, fontWeight: '500', color: colors.subtle, textAlign: 'center', marginTop: spacing.base },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    padding: spacing.xl, gap: spacing.base, ...elevation.lg,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.sm },
  modalTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '700', color: colors.ink },
  modalHelper: { fontFamily: FONT, fontSize: 13, fontWeight: '400', color: colors.muted, marginTop: -spacing.sm },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: colors.muted },
})
