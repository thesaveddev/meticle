import { useState } from 'react'
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { colors, elevation, radii, spacing, type, FONT } from '../theme'
import type { HomecareVisit, OfflineVisitAction, VisitAction, AuthSession } from '../types'
import { PrimaryButton } from '../components/PrimaryButton'
import { getVisitLocation } from '../services/location'
import { IconBack, IconCheck, IconClock, IconCamera, IconGallery, IconWarning, IconIncident } from '../components/Icons'
import { hapticLight } from '../services/haptics'

function time(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function dateStamp() {
  return new Date().toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function statusColor(status: string) {
  switch (status) {
    case 'completed': return colors.success
    case 'checked_in': return colors.primary
    case 'en_route': return colors.warning
    case 'missed': return colors.danger
    default: return colors.subtle
  }
}

function StatusPill({ status }: { status: string }) {
  const color = statusColor(status)
  const label = status.replace('_', ' ')
  return (
    <View style={[styles.statusPill, { backgroundColor: color + '15' }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusPillText, { color }]}>{label}</Text>
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
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
    })
    if (!result.canceled) {
      for (const asset of result.assets) {
        await uploadVisitPhoto(asset.uri)
      }
    }
  }

  const takeVisitPhoto = async () => {
    hapticLight()
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera access.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 })
    if (!result.canceled && result.assets[0]) {
      await uploadVisitPhoto(result.assets[0].uri)
    }
  }

  const uploadVisitPhoto = async (uri: string) => {
    setUploadingPhoto(true)
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
      const filename = uri.split('/').pop() || 'photo.jpg'
      const ext = filename.split('.').pop()?.toLowerCase() || 'jpg'
      const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`
      const byteCharacters = atob(base64)
      const byteArray = new Uint8Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i)
      const blob = new Blob([byteArray], { type: mimeType })
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
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not upload photo')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const removePhoto = (index: number) => {
    hapticLight()
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  async function execute(action: VisitAction) {
    hapticLight()
    setBusy(true); setError(''); setSuccess('')
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
        setSuccess(
          result.synced
            ? `Checked in at ${dateStamp()}. Location recorded.`
            : 'Checked in offline. Will sync when you reconnect.'
        )
      } else {
        setSuccess(
          result.synced
            ? `Call completed at ${dateStamp()}. Saved.`
            : 'Saved offline. Will sync when you reconnect.'
        )
      }
    } catch (e: any) {
      setError(e.message || 'Could not record this action.')
    } finally {
      setBusy(false)
    }
  }

  async function reportDisruption() {
    if (!disruption.trim()) return
    hapticLight()
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Back */}
          <Pressable onPress={() => { hapticLight(); onBack() }} style={styles.backBtn}>
            <IconBack size={18} color={colors.primary} />
            <Text style={styles.backText}>Today</Text>
          </Pressable>

          {/* Client card */}
          <View style={styles.clientCard}>
            <View style={styles.clientTop}>
              <Text style={styles.clientName}>{visit.label}</Text>
              <StatusPill status={visit.status} />
            </View>

            <View style={styles.timeRow}>
              <IconClock size={14} color={colors.primary} />
              <Text style={styles.timeText}>{time(visit.scheduled_start)} – {time(visit.scheduled_end)}</Text>
            </View>

            {visit.person_name && (
              <View style={styles.personSection}>
                <Text style={styles.personName}>{visit.person_name}</Text>
                {visit.person_address && (
                  <Text style={styles.personAddr}>{visit.person_address}</Text>
                )}
                {onClientDetail && visit.person_id && (
                  <Pressable onPress={() => { hapticLight(); onClientDetail(visit.person_id!) }} style={styles.viewClientBtn}>
                    <Text style={styles.viewClientText}>View client file</Text>
                    <Text style={styles.viewClientArrow}>→</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>

          {/* Check-in status */}
          {checkedIn && (
            <View style={styles.checkInCard}>
              <View style={styles.checkInRow}>
                <View style={styles.checkInPulse} />
                <View>
                  <Text style={styles.checkInTitle}>Checked in</Text>
                  {checkedInAt && <Text style={styles.checkInTime}>{checkedInAt}</Text>}
                </View>
              </View>
              {checkedInLocation && (
                <View style={styles.checkInMeta}>
                  <Text style={styles.checkInMetaText}>Location captured</Text>
                </View>
              )}
              <Text style={styles.checkInHint}>
                Record what happened during the call, then check out when you leave.
              </Text>
            </View>
          )}

          {/* Messages */}
          {success ? (
            <View style={styles.banner}>
              <View style={[styles.bannerIcon, { backgroundColor: colors.success }]}>
                <IconCheck size={12} color={colors.inverse} />
              </View>
              <Text style={[styles.bannerText, { color: colors.successDeep }]}>{success}</Text>
            </View>
          ) : null}
          {error ? (
            <View style={[styles.banner, { backgroundColor: colors.dangerSurface }]}>
              <View style={[styles.bannerIcon, { backgroundColor: colors.danger }]}>
                <Text style={styles.bannerIconText}>!</Text>
              </View>
              <Text accessibilityRole="alert" style={[styles.bannerText, { color: colors.dangerDeep }]}>{error}</Text>
            </View>
          ) : null}

          {/* Form card */}
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{checkedIn ? 'Visit notes' : 'Pre-visit details'}</Text>

            {!checkedIn && (
              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={styles.fieldLabel}>Travel time (min)</Text>
                  <TextInput
                    keyboardType="number-pad"
                    value={travelMinutes}
                    onChangeText={setTravelMinutes}
                    placeholder="0"
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
                    placeholder="0.0"
                    placeholderTextColor={colors.subtle}
                    style={styles.input}
                  />
                </View>
              </View>
            )}

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{checkedIn ? 'What happened during this call?' : 'Notes (optional)'}</Text>
              <TextInput
                multiline
                value={note}
                onChangeText={setNote}
                placeholder={checkedIn ? 'Record care provided, observations, client mood...' : 'Any notes before you arrive'}
                placeholderTextColor={colors.subtle}
                style={[styles.input, styles.textArea]}
              />
            </View>
          </View>

          {/* Photo attachments */}
          {checkedIn && (
            <View style={styles.photoCard}>
              <Text style={styles.formTitle}>Photos</Text>
              <View style={styles.photoRow}>
                <Pressable onPress={pickVisitPhoto} style={({ pressed }) => [styles.photoBtn, pressed && { opacity: 0.7 }]}>
                  <IconGallery size={18} color={colors.primary} />
                  <Text style={styles.photoBtnText}>Gallery</Text>
                </Pressable>
                <Pressable onPress={takeVisitPhoto} style={({ pressed }) => [styles.photoBtn, pressed && { opacity: 0.7 }]}>
                  <IconCamera size={18} color={colors.primary} />
                  <Text style={styles.photoBtnText}>Camera</Text>
                </Pressable>
                {uploadingPhoto && <Text style={styles.uploadingText}>Uploading...</Text>}
              </View>
              {photos.length > 0 && (
                <View style={styles.photoGrid}>
                  {photos.map((url, i) => (
                    <View key={i} style={styles.photoThumb}>
                      <Image source={{ uri: `https://meticlecare.com${url}` }} style={styles.photoImage} />
                      <Pressable onPress={() => removePhoto(i)} style={styles.photoRemoveBtn}>
                        <Text style={styles.photoRemoveText}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

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
                  label="Check out and complete"
                  onPress={() => execute('check-out')}
                  loading={busy}
                  disabled={busy}
                  tone="success"
                />
              )}
            </View>
          )}

          {/* Secondary actions */}
          {isOpen && (
            <View style={styles.secondaryActions}>
              <Pressable onPress={() => { hapticLight(); setDisruptionOpen(true) }} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}>
                <IconWarning size={16} color={colors.warning} />
                <Text style={styles.secondaryBtnText}>Report a delay</Text>
              </Pressable>

              {onReportIncident && (
                <Pressable onPress={() => { hapticLight(); onReportIncident() }} style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.7 }]}>
                  <IconIncident size={16} color={colors.danger} />
                  <Text style={[styles.secondaryBtnText, { color: colors.danger }]}>Report incident</Text>
                </Pressable>
              )}
            </View>
          )}

          {queue.length > 0 && (
            <View style={styles.queueBadge}>
              <Text style={styles.queueText}>{queue.length} action{queue.length === 1 ? '' : 's'} waiting to sync</Text>
            </View>
          )}

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Disruption modal */}
      <Modal visible={disruptionOpen} transparent animationType="fade" onRequestClose={() => setDisruptionOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Report a disruption</Text>
            <Text style={styles.modalHelper}>
              Tell the office what is affecting this call.
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
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.md, paddingBottom: spacing.xxxl },

  /* Back */
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.base },
  backText: { fontFamily: FONT, fontSize: 15, fontWeight: '600', color: colors.primary },

  /* Client card */
  clientCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.base,
    gap: spacing.md,
    ...elevation.sm,
  },
  clientTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  clientName: { fontFamily: FONT, fontSize: 20, fontWeight: '700', color: colors.ink, letterSpacing: -0.4, flex: 1, marginRight: spacing.sm },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  timeText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: colors.primary },
  personSection: { borderTopWidth: 1, borderTopColor: colors.borderLight, paddingTop: spacing.md },
  personName: { fontFamily: FONT, fontSize: 16, fontWeight: '600', color: colors.ink },
  personAddr: { fontFamily: FONT, fontSize: 13, fontWeight: '400', color: colors.muted, marginTop: 4 },
  viewClientBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: spacing.sm, backgroundColor: colors.primarySurface,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.md,
  },
  viewClientText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: colors.primary },
  viewClientArrow: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: colors.primary },

  /* Status pill */
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radii.full,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontFamily: FONT, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },

  /* Check-in card */
  checkInCard: {
    backgroundColor: colors.primarySurface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.primary + '25',
    padding: spacing.base,
    marginTop: spacing.base,
    gap: spacing.sm,
  },
  checkInRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkInPulse: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary,
  },
  checkInTitle: { fontFamily: FONT, fontSize: 15, fontWeight: '700', color: colors.primary },
  checkInTime: { fontFamily: FONT, fontSize: 12, fontWeight: '500', color: colors.primaryLight, marginTop: 1 },
  checkInMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primarySurface, paddingHorizontal: spacing.sm,
    paddingVertical: 3, borderRadius: radii.sm, alignSelf: 'flex-start',
  },
  checkInMetaText: { fontFamily: FONT, fontSize: 11, fontWeight: '600', color: colors.primary },
  checkInHint: { fontFamily: FONT, fontSize: 12, fontWeight: '400', color: colors.muted, lineHeight: 16 },

  /* Banners */
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.successSurface, padding: spacing.md,
    borderRadius: radii.md, marginTop: spacing.base,
  },
  bannerIcon: {
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  bannerIconText: { fontFamily: FONT, fontSize: 12, fontWeight: '800', color: colors.inverse },
  bannerText: { fontFamily: FONT, fontSize: 13, fontWeight: '500', flex: 1 },

  /* Form card */
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
  formTitle: { fontFamily: FONT, fontSize: 16, fontWeight: '700', color: colors.ink },
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  fieldHalf: { flex: 1 },
  fieldGroup: { gap: spacing.xs },
  fieldLabel: { fontFamily: FONT, fontSize: 12, fontWeight: '600', color: colors.inkLight, marginBottom: spacing.xs },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.ink,
    fontFamily: FONT,
    fontSize: 15,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top', paddingTop: spacing.md },

  /* Photo card */
  photoCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.base,
    marginTop: spacing.base,
    gap: spacing.md,
    ...elevation.sm,
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  photoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.md, backgroundColor: colors.primarySurface,
    borderWidth: 1, borderColor: colors.primary + '25',
  },
  photoBtnText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: colors.primary },
  uploadingText: { fontFamily: FONT, fontSize: 12, fontWeight: '500', color: colors.muted },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoThumb: { position: 'relative', width: 72, height: 72, borderRadius: radii.md, overflow: 'hidden' },
  photoImage: { width: 72, height: 72 },
  photoRemoveBtn: {
    position: 'absolute', top: 4, right: 4,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center',
  },
  photoRemoveText: { fontFamily: FONT, fontSize: 14, fontWeight: '700', color: colors.inverse, marginTop: -1 },

  /* Actions */
  actions: { marginTop: spacing.base },

  /* Secondary actions */
  secondaryActions: {
    flexDirection: 'row', gap: spacing.sm, marginTop: spacing.base,
  },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.md,
    borderRadius: radii.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  secondaryBtnText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: colors.warning },

  /* Queue */
  queueBadge: {
    alignItems: 'center', paddingVertical: spacing.sm,
    marginTop: spacing.base,
  },
  queueText: { fontFamily: FONT, fontSize: 12, fontWeight: '500', color: colors.subtle },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.base,
    ...elevation.lg,
  },
  modalTitle: { fontFamily: FONT, fontSize: 20, fontWeight: '700', color: colors.ink },
  modalHelper: { fontFamily: FONT, fontSize: 13, fontWeight: '400', color: colors.muted, marginTop: -spacing.sm },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { fontFamily: FONT, fontSize: 15, fontWeight: '600', color: colors.primary },
})
