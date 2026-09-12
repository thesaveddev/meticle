import { useEffect, useRef, useState } from 'react'
import { Alert, Animated, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'

import { colors, elevation, radii, spacing, type, FONT, useAppColors } from '../theme'
import { dyn } from '../utils/dynamicStyles'
import type { HomecareVisit, OfflineVisitAction, VisitAction, AuthSession } from '../types'
import { PrimaryButton } from '../components/PrimaryButton'
import { getVisitLocation, haversineDistance } from '../services/location'
import { getLocationThreshold, getRequirePhoto } from '../services/api'
import { IconBack, IconCheck, IconClock, IconCamera, IconGallery, IconWarning, IconIncident, IconNavigate, IconTwoPerson } from '../components/Icons'
import { MapPickerModal } from '../components/MapPickerModal'
import { hapticLight, hapticMedium, hapticWarning } from '../services/haptics'
import { isOverdue, overdueLabel } from '../utils/visitStatus'

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

/* ─── Read-only label/value pair for completed visits ───────── */
function ReadOnlyField({ label, value, c }: { label: string; value: string; c: any }) {
  if (!value) return null
  return (
    <View style={styles.roField}>
      <Text style={[styles.roLabel, { color: c.subtle }]}>{label}</Text>
      <Text style={[styles.roValue, { color: c.ink }]}>{value}</Text>
    </View>
  )
}

export function VisitScreen({ visit, session, onBack, onAction, onDisruption, queue, onClientDetail, onReportIncident, onSwap, previousVisit, nextVisit, onVisitNext }: {
  visit: HomecareVisit
  session?: AuthSession
  onBack: () => void
  onAction: (action: VisitAction, payload: OfflineVisitAction['payload']) => Promise<{ synced: boolean }>
  onDisruption: (body: Record<string, unknown>) => Promise<void>
  queue: OfflineVisitAction[]
  onClientDetail?: (personId: string) => void
  onReportIncident?: () => void
  onSwap?: () => void
  previousVisit?: HomecareVisit | null
  nextVisit?: HomecareVisit | null
  onVisitNext?: (visit: HomecareVisit) => void
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
  const [previsitSaved, setPrevisitSaved] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [nextCallModal, setNextCallModal] = useState(false)
  const [mapPickerOpen, setMapPickerOpen] = useState(false)
  const [locationThreshold, setLocationThreshold] = useState(500)
  const [requirePhoto, setRequirePhoto] = useState(false)
  const [navDestination, setNavDestination] = useState<{ destination?: string; latitude?: number; longitude?: number; label?: string }>({})

  // Task list for this call
  const [tasks, setTasks] = useState([
    { id: '1', label: 'Personal care completed', done: false },
    { id: '2', label: 'Medication administered', done: false },
    { id: '3', label: 'Meal prepared / assistance with eating', done: false },
    { id: '4', label: 'Environment safe and tidy', done: false },
    { id: '5', label: 'Client wellbeing checked', done: false },
  ])
  const toggleTask = (id: string) => {
    hapticLight()
    setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }
  const allTasksDone = tasks.every(t => t.done)

  // Fetch location threshold from org settings
  useEffect(() => {
    if (session?.accessToken) {
      getLocationThreshold(session.accessToken).then(setLocationThreshold).catch(() => {})
      getRequirePhoto(session.accessToken).then(setRequirePhoto).catch(() => {})
    }
  }, [session?.accessToken])

  const openNavPicker = (dest: { destination?: string; latitude?: number; longitude?: number; label?: string }) => {
    hapticLight()
    setNavDestination(dest)
    setMapPickerOpen(true)
  }

  const isCompleted = visit.status === 'completed'
  const isMissed = visit.status === 'missed'
  const isCancelled = visit.status === 'cancelled'
  const isReadonly = isCompleted || isMissed || isCancelled
  const isOpen = !isReadonly
  const canSwap = isOpen && !!onSwap
  const checkedIn = visit.status === 'checked_in'
  const requiresTwo = !!visit.requires_two_staff
  const [secondCarerCheckedIn, setSecondCarerCheckedIn] = useState(false)
  const canCheckIn = !requiresTwo || secondCarerCheckedIn

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

  /* ─── Submit pre-visit details (save locally, no API call) ── */
  function submitPrevisit() {
    hapticLight()
    if (!travelMinutes.trim() && !mileage.trim()) {
      setError('Enter at least travel time or mileage before submitting.')
      return
    }
    setPrevisitSaved(true)
    setError('')
    setSuccess('Pre-visit details saved. Tap "Check in" when you arrive.')
  }

  /* ─── Submit care notes (save locally, no API call) ────────── */
  function submitNotes() {
    hapticLight()
    if (!note.trim()) {
      setError('Write your care notes before submitting.')
      return
    }
    setNotesSaved(true)
    setError('')
    setSuccess('Care notes saved. Tap "Check out and complete" when you leave.')
  }

  /* ─── Auto-calculate travel time from previous visit ──────── */
  useEffect(() => {
    if (previousVisit?.person_latitude && previousVisit?.person_longitude && visit.person_latitude && visit.person_longitude) {
      const dist = haversineDistance(
        previousVisit.person_latitude, previousVisit.person_longitude,
        visit.person_latitude, visit.person_longitude
      )
      // Assume ~30mph average speed in town, convert meters to minutes
      const estimatedMinutes = Math.round((dist / 1000) / 30 * 60)
      if (estimatedMinutes > 0 && !travelMinutes) {
        setTravelMinutes(String(estimatedMinutes))
      }
      // Estimate mileage (meters to miles)
      const estimatedMiles = Math.round((dist / 1609.34) * 10) / 10
      if (estimatedMiles > 0 && !mileage) {
        setMileage(String(estimatedMiles))
      }
    }
  }, [previousVisit])

  /* ─── Execute check-in / check-out ─────────────────────────── */
  async function execute(action: VisitAction) {
    hapticLight(); setError(''); setSuccess('')

    // Block check-out without care notes
    if (action === 'check-out' && !note.trim()) {
      hapticWarning()
      setError('Please record and submit your care notes before checking out.')
      return
    }

    // Block check-out without completing all tasks
    if (action === 'check-out' && !allTasksDone) {
      hapticWarning()
      const incomplete = tasks.filter(t => !t.done).map(t => t.label).join(', ')
      setError(`Complete all tasks before checking out. Incomplete: ${incomplete}`)
      return
    }

    // Block check-out without photo if required by org
    if (action === 'check-out' && requirePhoto && photos.length === 0) {
      hapticWarning()
      setError('Your organisation requires at least one photo before checking out. Please take or upload a photo.')
      return
    }

    setBusy(true)
    try {
      const location = await getVisitLocation()

      // Verify location on check-in AND check-out
      if (visit.person_latitude && visit.person_longitude && location.latitude && location.longitude) {
        const distance = haversineDistance(
          location.latitude, location.longitude,
          visit.person_latitude, visit.person_longitude
        )
        if (distance > locationThreshold) {
          setBusy(false)
          hapticWarning()
          const actionLabel = action === 'check-in' ? 'checking in' : 'checking out'
          setError(
            `You are ${Math.round(distance)}m away from ${visit.person_name || 'the client'}. ` +
            `Please confirm you are within ${locationThreshold}m of the correct location before ${actionLabel}.`
          )
          return
        }
      }

      const result = await onAction(action, {
        ...location,
        actual_travel_minutes: travelMinutes ? Number(travelMinutes) : undefined,
        actual_mileage_miles: mileage ? Number(mileage) : undefined,
        note: note.trim() || undefined,
        photos: photos.length > 0 ? photos : undefined,
        completed_tasks: tasks.filter(t => t.done).map(t => t.label),
      } as any)
      if (action === 'check-in') {
        setCheckedInAt(dateStamp())
        setCheckedInLocation(location.latitude ? { latitude: location.latitude, longitude: location.longitude } : null)
        setSuccess(result.synced ? `Checked in at ${dateStamp()}. Location recorded.` : 'Checked in offline. Will sync when you reconnect.')
      } else {
        setSuccess(result.synced ? `Call completed at ${dateStamp()}. Saved.` : 'Saved offline. Will sync when you reconnect.')
        if (nextVisit) {
          setTimeout(() => { hapticMedium(); setNextCallModal(true) }, 800)
        }
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
              <IconBack size={18} color={c.primary} />
              <Text style={[styles.backText, { color: c.primary }]}>Today</Text>
            </Pressable>
            <StatusPill status={visit.status} />
          </View>

          {/* Status timeline — only for open visits */}
          {isOpen && <VisitStatusTimeline status={visit.status} />}

          {/* Overdue alert */}
          {isOpen && isOverdue(visit) && (
            <View style={[styles.banner, { backgroundColor: c.dangerSurface, borderColor: c.danger + '20' }]}>
              <View style={[styles.bannerDot, { backgroundColor: c.danger }]}>
                <IconWarning size={10} color={c.inverse} />
              </View>
              <Text style={[styles.bannerText, { color: c.dangerDeep }]}>
                This call is {overdueLabel(visit)}. The manager has been notified.
              </Text>
            </View>
          )}

          {/* Client info card */}
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={[styles.clientName, { color: c.ink, flex: 1 }]}>{visit.label}</Text>
              {requiresTwo && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.warningSurface, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: c.warning + '30' }}>
                  <IconTwoPerson size={14} color={c.warning} />
                  <Text style={{ fontFamily: FONT, fontSize: 11, fontWeight: '700', color: c.warning }}>2-person</Text>
                </View>
              )}
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <IconClock size={14} color={c.primary} />
                <Text style={[styles.metaText, { color: c.primary }]}>{time(visit.scheduled_start)} – {time(visit.scheduled_end)}</Text>
              </View>
            </View>

            {visit.person_name && (
              <>
                <View style={[styles.divider, { backgroundColor: c.borderLight }]} />
                <Text style={[styles.personName, { color: c.ink }]}>{visit.person_name}</Text>
                {visit.person_address && <Text style={[styles.personAddr, { color: c.muted }]}>{visit.person_address}</Text>}
                <View style={styles.clientActions}>
                  {onClientDetail && visit.person_id && (
                    <Pressable onPress={() => { hapticLight(); onClientDetail(visit.person_id!) }} style={({ pressed }) => [[styles.actionBtn, { backgroundColor: c.primarySurface }], pressed && { opacity: 0.7 }]}>
                      <Text style={[styles.actionBtnText, { color: c.primary }]}>View file</Text>
                      <Text style={[styles.actionBtnArrow, { color: c.primary }]}>→</Text>
                    </Pressable>
                  )}
                  {visit.person_address && (
                    <Pressable onPress={() => openNavPicker({ destination: visit.person_address!, label: visit.person_name || visit.label })} style={({ pressed }) => [[styles.actionBtn, styles.navigateBtn, { backgroundColor: c.primarySurface, borderColor: c.primary + '25' }], pressed && { opacity: 0.7 }]}>
                      <IconNavigate size={14} color={c.primary} />
                      <Text style={[styles.navigateBtnText, { color: c.primary }]}>Navigate</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </View>

          {/* ═══════════════ COMPLETED / MISSED — READ-ONLY VIEW ═══════════════ */}
          {isReadonly && (
            <>
              {/* Completion banner */}
              <View style={[styles.banner, { backgroundColor: isCompleted ? c.successSurface : c.dangerSurface }]}>
                <View style={[styles.bannerDot, { backgroundColor: isCompleted ? c.success : c.danger }]}>
                  <IconCheck size={10} color={c.inverse} />
                </View>
                <Text style={[styles.bannerText, { color: isCompleted ? c.successDeep : c.dangerDeep }]}>
                  {isCompleted ? `Completed${visit.check_out_at ? ` at ${time(visit.check_out_at)}` : ''}` : isMissed ? 'This call was missed' : 'This call was cancelled'}
                </Text>
              </View>

              {/* Read-only care notes */}
              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
                <Text style={[styles.cardTitle, { color: c.ink }]}>Care notes</Text>
                {visit.visit_notes ? (
                  <Text style={[styles.roNotesText, { color: c.ink }]}>{visit.visit_notes}</Text>
                ) : (
                  <Text style={[styles.roNotesText, { color: c.subtle }]}>No care notes recorded.</Text>
                )}
              </View>

              {/* Read-only visit details */}
              <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
                <Text style={[styles.cardTitle, { color: c.ink }]}>Visit details</Text>
                <ReadOnlyField label="Check-in time" value={visit.check_in_at ? dateStamp.call(null) : '—'} c={c} />
                <ReadOnlyField label="Check-out time" value={visit.check_out_at ? dateStamp.call(null) : '—'} c={c} />
                <ReadOnlyField label="Travel time" value={visit.actual_travel_minutes ? `${visit.actual_travel_minutes} min` : '—'} c={c} />
                <ReadOnlyField label="Mileage" value={visit.actual_mileage_miles ? `${visit.actual_mileage_miles} mi` : '—'} c={c} />
                <ReadOnlyField label="Assigned carer" value={visit.assigned_staff_name || '—'} c={c} />
                <ReadOnlyField label="Package" value={visit.package_name || '—'} c={c} />
              </View>

              {/* Read-only photos */}
              {visit.photos && visit.photos.length > 0 && (
                <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
                  <Text style={[styles.cardTitle, { color: c.ink }]}>Photos</Text>
                  <View style={styles.photoGrid}>
                    {visit.photos.map((url: string, i: number) => (
                      <View key={i} style={styles.photoThumb}>
                        <Image source={{ uri: `https://meticlecare.com${url}` }} style={styles.photoImage} />
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}

          {/* ═══════════════ OPEN VISITS — EDITABLE ═══════════════ */}

          {/* Check-in status */}
          {checkedIn && (
            <View style={[styles.checkInCard, { backgroundColor: c.primarySurface, borderColor: c.primary + '20' }]}>
              <View style={styles.checkInRow}>
                <PulseDot color={c.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.checkInTitle, { color: c.primary }]}>Checked in</Text>
                  {checkedInAt && <Text style={[styles.checkInTime, { color: c.primaryLight }]}>{checkedInAt}</Text>}
                </View>
                {checkedInLocation && (
                  <View style={[styles.locBadge, { backgroundColor: c.primary + '20' }]}>
                    <Text style={[styles.locBadgeText, { color: c.primary }]}>GPS ✓</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.checkInHint, { color: c.muted }]}>Record what happened, then check out when you leave.</Text>
            </View>
          )}

          {/* Second carer check-in for two-person calls */}
          {requiresTwo && !checkedIn && (
            <View style={[styles.card, { backgroundColor: c.warningSurface, borderColor: c.warning + '20' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                <IconTwoPerson size={18} color={c.warning} />
                <Text style={{ fontFamily: FONT, fontSize: 14, fontWeight: '700', color: c.warning }}>Two-person call</Text>
              </View>
              <Text style={{ fontFamily: FONT, fontSize: 13, color: c.muted, marginBottom: spacing.md }}>This call requires two carers. Both must be present before you can check in.</Text>
              <Pressable onPress={() => { hapticLight(); setSecondCarerCheckedIn(!secondCarerCheckedIn) }}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.md, backgroundColor: secondCarerCheckedIn ? c.successSurface : c.surface, borderWidth: 1.5, borderColor: secondCarerCheckedIn ? c.success : c.border }, pressed && { opacity: 0.8 }]}>  
                <View style={[styles.checkbox, { borderColor: secondCarerCheckedIn ? c.success : c.border, backgroundColor: secondCarerCheckedIn ? c.success : 'transparent' }]}>
                  {secondCarerCheckedIn && <IconCheck size={12} color={c.inverse} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONT, fontSize: 14, fontWeight: '600', color: secondCarerCheckedIn ? c.success : c.ink }}>Second carer present</Text>
                  <Text style={{ fontFamily: FONT, fontSize: 12, color: c.muted }}>{secondCarerCheckedIn ? 'Confirmed — you can check in' : 'Tap to confirm the second carer has arrived'}</Text>
                </View>
              </Pressable>
            </View>
          )}

          {/* Banners */}
          {success ? (
            <View style={[styles.banner, { backgroundColor: c.successSurface }]}>
              <View style={[styles.bannerDot, { backgroundColor: c.success }]}><IconCheck size={10} color={c.inverse} /></View>
              <Text style={[styles.bannerText, { color: c.successDeep }]}>{success}</Text>
            </View>
          ) : null}
          {error ? (
            <View style={[styles.banner, { backgroundColor: c.dangerSurface }]}>
              <View style={[styles.bannerDot, { backgroundColor: c.danger }]}><Text style={styles.bannerDotText}>!</Text></View>
              <Text accessibilityRole="alert" style={[styles.bannerText, { color: c.dangerDeep }]}>{error}</Text>
            </View>
          ) : null}

          {/* ── Pre-visit form (only before check-in, not on completed) ── */}
          {!checkedIn && isOpen && (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
              <Text style={[styles.cardTitle, { color: c.ink }]}>Pre-visit details</Text>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Text style={[styles.fieldLabel, { color: c.inkLight }]}>Travel (min)</Text>
                  <TextInput keyboardType="number-pad" value={travelMinutes} onChangeText={setTravelMinutes}
                    placeholder="0" placeholderTextColor={c.subtle}
                    style={[styles.input, { borderColor: c.border, backgroundColor: c.surfaceAlt, color: c.ink }]}
                    editable={!previsitSaved} />
                </View>
                <View style={styles.fieldHalf}>
                  <Text style={[styles.fieldLabel, { color: c.inkLight }]}>Mileage (mi)</Text>
                  <TextInput keyboardType="decimal-pad" value={mileage} onChangeText={setMileage}
                    placeholder="0.0" placeholderTextColor={c.subtle}
                    style={[styles.input, { borderColor: c.border, backgroundColor: c.surfaceAlt, color: c.ink }]}
                    editable={!previsitSaved} />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: c.inkLight }]}>Notes (optional)</Text>
                <TextInput multiline value={note} onChangeText={setNote}
                  placeholder="Any notes before you arrive" placeholderTextColor={c.subtle}
                  style={[styles.input, styles.textArea, { borderColor: c.border, backgroundColor: c.surfaceAlt, color: c.ink }]}
                  editable={!previsitSaved} />
              </View>

              {!previsitSaved ? (
                <PrimaryButton label="Submit pre-visit details" onPress={submitPrevisit} tone="primary" />
              ) : (
                <View style={[styles.savedBadge, { backgroundColor: c.successSurface }]}>
                  <IconCheck size={14} color={c.success} />
                  <Text style={[styles.savedBadgeText, { color: c.success }]}>Saved</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Care notes form (only after check-in) ── */}
          {checkedIn && (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
              <Text style={[styles.cardTitle, { color: c.ink }]}>Care notes</Text>

              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: c.inkLight }]}>What happened during this call?</Text>
                <TextInput multiline value={note} onChangeText={setNote}
                  placeholder="Care provided, observations, client mood, medication given..." placeholderTextColor={c.subtle}
                  style={[styles.input, styles.textArea, { borderColor: c.border, backgroundColor: c.surfaceAlt, color: c.ink }]}
                  editable={!notesSaved} />
              </View>

              {/* Photos */}
              <Text style={[styles.fieldLabel, { color: c.inkLight, marginTop: spacing.sm }]}>Photos</Text>
              <View style={styles.photoRow}>
                <Pressable onPress={pickVisitPhoto} style={({ pressed }) => [[styles.photoAction, { backgroundColor: c.primarySurface, borderColor: c.primary + '20' }], pressed && { opacity: 0.7 }]}>
                  <IconGallery size={16} color={c.primary} />
                  <Text style={[styles.photoActionText, { color: c.primary }]}>Gallery</Text>
                </Pressable>
                <Pressable onPress={takeVisitPhoto} style={({ pressed }) => [[styles.photoAction, { backgroundColor: c.primarySurface, borderColor: c.primary + '20' }], pressed && { opacity: 0.7 }]}>
                  <IconCamera size={16} color={c.primary} />
                  <Text style={[styles.photoActionText, { color: c.primary }]}>Camera</Text>
                </Pressable>
                {uploadingPhoto && <Text style={[styles.uploadingText, { color: c.muted }]}>Uploading...</Text>}
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

              {!notesSaved ? (
                <PrimaryButton label="Submit care notes" onPress={submitNotes} tone="primary" />
              ) : (
                <View style={[styles.savedBadge, { backgroundColor: c.successSurface }]}>
                  <IconCheck size={14} color={c.success} />
                  <Text style={[styles.savedBadgeText, { color: c.success }]}>Notes saved</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Task list ── */}
          {checkedIn && (
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
              <Text style={[styles.cardTitle, { color: c.ink }]}>Call tasks</Text>
              <Text style={{ fontFamily: FONT, fontSize: 12, color: c.muted, marginBottom: spacing.sm }}>Complete all tasks before checking out</Text>
              {tasks.map(task => (
                <Pressable key={task.id} onPress={() => toggleTask(task.id)}
                  style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: c.borderLight }, pressed && { opacity: 0.7 }]}>
                  <View style={[styles.checkbox, { borderColor: task.done ? c.success : c.border, backgroundColor: task.done ? c.success : 'transparent' }]}>
                    {task.done && <IconCheck size={12} color={c.inverse} />}
                  </View>
                  <Text style={{ flex: 1, fontFamily: FONT, fontSize: 14, fontWeight: '500', color: task.done ? c.muted : c.ink, textDecorationLine: task.done ? 'line-through' : 'none' }}>{task.label}</Text>
                </Pressable>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm }}>
                <Text style={{ fontFamily: FONT, fontSize: 12, fontWeight: '600', color: allTasksDone ? c.success : c.muted }}>
                  {tasks.filter(t => t.done).length}/{tasks.length} completed
                </Text>
                {allTasksDone && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <IconCheck size={14} color={c.success} />
                    <Text style={{ fontFamily: FONT, fontSize: 12, fontWeight: '600', color: c.success }}>All done</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── Care notes hint ── */}
          {checkedIn && !note.trim() && (
            <View style={[styles.card, { backgroundColor: c.warningSurface, borderColor: c.warning + '20' }]}>
              <Text style={[styles.cardTitle, { color: c.warning }]}>Care notes required</Text>
              <Text style={{ fontFamily: FONT, fontSize: 13, color: c.muted }}>Record what happened during this call before you can check out.</Text>
            </View>
          )}

          {/* ── Photo requirement hint ── */}
          {checkedIn && requirePhoto && photos.length === 0 && (
            <View style={[styles.card, { backgroundColor: c.warningSurface, borderColor: c.warning + '20' }]}>
              <Text style={[styles.cardTitle, { color: c.warning }]}>Photo evidence required</Text>
              <Text style={{ fontFamily: FONT, fontSize: 13, color: c.muted }}>Your organisation requires at least one photo before you can check out.</Text>
            </View>
          )}

          {/* ── Primary action buttons ── */}
          {isOpen && (
            <View style={{ marginTop: spacing.base }}>
              {!checkedIn && (
                <PrimaryButton label={requiresTwo && !secondCarerCheckedIn ? 'Second carer required' : 'Check in'} onPress={() => execute('check-in')} loading={busy} disabled={busy || (requiresTwo && !secondCarerCheckedIn)} tone="primary" />
              )}
              {checkedIn && (
                <PrimaryButton
                  label={!allTasksDone ? 'Complete all tasks to check out' : !note.trim() ? 'Add care notes to check out' : requirePhoto && photos.length === 0 ? 'Add a photo to check out' : 'Check out and complete'}
                  onPress={() => execute('check-out')}
                  loading={busy}
                  disabled={busy || !note.trim() || !allTasksDone || (requirePhoto && photos.length === 0)}
                  tone="success"
                />
              )}
            </View>
          )}

          {/* ── Secondary actions ── */}
          {isOpen && (
            <View style={styles.secondaryRow}>
              <Pressable onPress={() => { hapticLight(); setDisruptionOpen(true) }} style={({ pressed }) => [[styles.secondaryBtn, { backgroundColor: c.surface, borderColor: c.borderLight }], pressed && { opacity: 0.7 }]}>
                <IconWarning size={14} color={c.warning} />
                <Text style={[styles.secondaryText, { color: c.warning }]}>Delay</Text>
              </Pressable>
              {onReportIncident && (
                <Pressable onPress={() => { hapticLight(); onReportIncident() }} style={({ pressed }) => [[styles.secondaryBtn, { backgroundColor: c.surface, borderColor: c.borderLight }], pressed && { opacity: 0.7 }]}>
                  <IconIncident size={14} color={c.danger} />
                  <Text style={[styles.secondaryText, { color: c.danger }]}>Incident</Text>
                </Pressable>
              )}
              {canSwap && (
                <Pressable onPress={() => { hapticLight(); onSwap!() }} style={({ pressed }) => [[styles.secondaryBtn, { backgroundColor: c.surface, borderColor: c.borderLight }], pressed && { opacity: 0.7 }]}>
                  <Text style={{ fontSize: 14 }}>🔄</Text>
                  <Text style={[styles.secondaryText, { color: c.primary }]}>Swap</Text>
                </Pressable>
              )}
            </View>
          )}

          {queue.length > 0 && (
            <Text style={[styles.queueText, { color: c.subtle }]}>{queue.length} action{queue.length === 1 ? '' : 's'} queued for sync</Text>
          )}

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ═══════════════ DISRUPTION MODAL ═══════════════ */}
      <Modal visible={disruptionOpen} transparent animationType="slide" onRequestClose={() => setDisruptionOpen(false)}>
        <KeyboardAvoidingView style={[styles.modalBackdrop, { backgroundColor: 'rgba(15, 23, 42, 0.4)' }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable onPress={() => setDisruptionOpen(false)} style={styles.modalBackdropTouch}>
            <Pressable>
              <View style={[styles.modal, { backgroundColor: c.surface }]}>
                <View style={[styles.modalHandle, { backgroundColor: c.border }]} />
                <Text style={[styles.modalTitle, { color: c.ink }]}>Report a disruption</Text>
                <Text style={[styles.modalHelper, { color: c.muted }]}>Tell the office what is affecting this call.</Text>
                <TextInput multiline autoFocus value={disruption} onChangeText={setDisruption}
                  placeholder="What is happening?" placeholderTextColor={c.subtle}
                  style={[styles.input, styles.textArea, { borderColor: c.border, backgroundColor: c.surfaceAlt, color: c.ink }]} />
                <PrimaryButton label="Send to office" onPress={reportDisruption} loading={busy} disabled={busy || !disruption.trim()} tone="danger" />
                <Pressable onPress={() => setDisruptionOpen(false)} style={styles.cancelBtn}>
                  <Text style={[styles.cancelText, { color: c.muted }]}>Cancel</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════════════ NEXT CALL MODAL (after check-out) ═══════════════ */}
      <Modal visible={nextCallModal} transparent animationType="slide" onRequestClose={() => setNextCallModal(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: 'rgba(15, 23, 42, 0.4)' }]}>
          <View style={[styles.modalBackdropTouch]}>
            <View style={[styles.modal, { backgroundColor: c.surface }]}>
              <View style={[styles.modalHandle, { backgroundColor: c.border }]} />

              <View style={styles.nextCallHeader}>
                <View style={[styles.nextCallIcon, { backgroundColor: c.successSurface }]}>
                  <IconCheck size={20} color={c.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nextCallTitle, { color: c.ink }]}>Call completed</Text>
                  <Text style={[styles.nextCallSub, { color: c.muted }]}>Great work! Here's your next call.</Text>
                </View>
              </View>

              {nextVisit && (
                <View style={[styles.nextCallCard, { backgroundColor: c.primarySurface, borderColor: c.primary + '20' }]}>
                  <View style={styles.nextCallInfo}>
                    <Text style={[styles.nextCallName, { color: c.ink }]}>{nextVisit.label}</Text>
                    {nextVisit.person_name && <Text style={[styles.nextCallPerson, { color: c.muted }]}>{nextVisit.person_name}</Text>}
                    <View style={styles.nextCallTime}>
                      <IconClock size={12} color={c.primary} />
                      <Text style={[styles.nextCallTimeText, { color: c.primary }]}>{time(nextVisit.scheduled_start)} – {time(nextVisit.scheduled_end)}</Text>
                    </View>
                    {nextVisit.person_address && (
                      <Text style={[styles.nextCallAddr, { color: c.subtle }]} numberOfLines={2}>{nextVisit.person_address}</Text>
                    )}
                  </View>

                  {/* Action buttons */}
                  <View style={styles.nextCallActions}>
                    {nextVisit.person_address && (
                      <Pressable
                        onPress={() => { hapticLight(); setNextCallModal(false); setTimeout(() => openNavPicker({ destination: nextVisit.person_address!, label: nextVisit.person_name || nextVisit.label }), 300) }}
                        style={({ pressed }) => [[styles.nextCallBtn, { backgroundColor: c.primary, borderColor: c.primary }], pressed && { opacity: 0.8 }]}
                      >
                        <IconNavigate size={16} color={c.inverse} />
                        <Text style={[styles.nextCallBtnText, { color: c.inverse }]}>Navigate</Text>
                      </Pressable>
                    )}
                    {onVisitNext && (
                      <Pressable
                        onPress={() => { hapticLight(); setNextCallModal(false); onVisitNext(nextVisit) }}
                        style={({ pressed }) => [[styles.nextCallBtn, { backgroundColor: c.surface, borderColor: c.border }], pressed && { opacity: 0.8 }]}
                      >
                        <Text style={[styles.nextCallBtnText, { color: c.primary }]}>Open call</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              )}

              {!nextVisit && (
                <View style={[styles.nextCallCard, { backgroundColor: c.surfaceAlt, borderColor: c.borderLight }]}>
                  <Text style={[styles.nextCallName, { color: c.muted, textAlign: 'center' }]}>No more calls today</Text>
                  <Text style={[styles.nextCallSub, { color: c.subtle, textAlign: 'center' }]}>You're done for the day. Well done!</Text>
                </View>
              )}

              <Pressable onPress={() => setNextCallModal(false)} style={styles.cancelBtn}>
                <Text style={[styles.cancelText, { color: c.muted }]}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Map app picker */}
      <MapPickerModal
        visible={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        destination={navDestination.destination}
        latitude={navDestination.latitude}
        longitude={navDestination.longitude}
        label={navDestination.label}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
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

  /* Saved badge */
  savedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radii.md, alignSelf: 'flex-start',
  },
  savedBadgeText: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },

  /* Checkbox */
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },

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

  /* Read-only fields */
  roField: { paddingVertical: spacing.xs },
  roLabel: { fontFamily: FONT, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  roValue: { fontFamily: FONT, fontSize: 14, fontWeight: '500' },
  roNotesText: { fontFamily: FONT, fontSize: 14, fontWeight: '400', lineHeight: 20 },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  modalBackdropTouch: { flex: 1, justifyContent: 'flex-end' },
  modal: {
    backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    padding: spacing.xl, gap: spacing.base, ...elevation.lg,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.sm },
  modalTitle: { fontFamily: FONT, fontSize: 18, fontWeight: '700', color: colors.ink },
  modalHelper: { fontFamily: FONT, fontSize: 13, fontWeight: '400', color: colors.muted, marginTop: -spacing.sm },
  cancelBtn: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: colors.muted },

  /* Next call modal */
  nextCallHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nextCallIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  nextCallTitle: { fontFamily: FONT, fontSize: 17, fontWeight: '700', color: colors.ink },
  nextCallSub: { fontFamily: FONT, fontSize: 13, fontWeight: '400', color: colors.muted, marginTop: 1 },
  nextCallCard: {
    borderRadius: radii.lg, borderWidth: 1, padding: spacing.base, gap: spacing.sm,
  },
  nextCallInfo: { gap: spacing.xs },
  nextCallName: { fontFamily: FONT, fontSize: 16, fontWeight: '700', color: colors.ink },
  nextCallPerson: { fontFamily: FONT, fontSize: 13, fontWeight: '400', color: colors.muted },
  nextCallTime: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  nextCallTimeText: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: colors.primary },
  nextCallAddr: { fontFamily: FONT, fontSize: 12, fontWeight: '400', color: colors.subtle, marginTop: spacing.xs },
  nextCallActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  nextCallBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.xs, paddingVertical: spacing.md, borderRadius: radii.md,
    borderWidth: 1.5,
  },
  nextCallBtnText: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
})
