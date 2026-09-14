import { useCallback, useEffect, useState, useRef } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, Animated } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, elevation, radii, spacing, FONT, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import { dyn } from '../utils/dynamicStyles'
import { PrimaryButton } from '../components/PrimaryButton'
import type { AuthSession, AvailabilityRecord } from '../types'
import { getMyAvailability, addAvailability, deleteAvailability } from '../services/api'
import { hapticLight, hapticWarning } from '../services/haptics'

const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function isValidTime(t: string) {
  return /^\d{2}:\d{2}$/.test(t) && Number(t.slice(0, 2)) <= 23 && Number(t.slice(3, 5)) <= 59
}

// Common time presets for quick selection
const TIME_PRESETS = ['07:00', '08:00', '09:00', '10:00', '12:00', '14:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00']

export function AvailabilityScreen({ session, onBack }: { session: AuthSession; onBack?: () => void }) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const [records, setRecords] = useState<AvailabilityRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [selectedDay, setSelectedDay] = useState(new Date().getDay()) // Default to today
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [showStartTimePicker, setShowStartTimePicker] = useState(false)
  const [showEndTimePicker, setShowEndTimePicker] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const successTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await getMyAvailability(session.accessToken)
      setRecords(data)
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false) }
  }, [session.accessToken])

  useEffect(() => { load() }, [load])

  // Auto-dismiss success after 3 seconds
  useEffect(() => {
    if (success) {
      if (successTimeout.current) clearTimeout(successTimeout.current)
      successTimeout.current = setTimeout(() => setSuccess(''), 3000)
    }
    return () => { if (successTimeout.current) clearTimeout(successTimeout.current) }
  }, [success])

  const handleAdd = async () => {
    // Validate
    if (!isValidTime(start)) { setError('Start time must be HH:MM format'); return }
    if (!isValidTime(end)) { setError('End time must be HH:MM format'); return }
    if (start >= end) { setError('Start time must be before end time'); return }

    setAdding(true); setError(''); setSuccess('')
    try {
      await addAvailability(session.accessToken, selectedDay, start, end)
      setSuccess(`${FULL_DAYS[selectedDay]} availability saved`)
      setStart('09:00')
      setEnd('17:00')
      await load()
    } catch (e: any) { setError(e.message || 'Could not save') }
    finally { setAdding(false) }
  }

  const handleDelete = async (id: string, dayName: string, timeRange: string) => {
    hapticWarning()
    Alert.alert(
      'Remove availability',
      `Remove ${dayName} ${timeRange}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            setDeletingId(id)
            try {
              await deleteAvailability(session.accessToken, id)
              setSuccess('Availability removed')
              await load()
            } catch (e: any) {
              setError(e.message || 'Could not remove')
            } finally { setDeletingId(null) }
          }
        },
      ]
    )
  }

  const byDay: Record<number, AvailabilityRecord[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  for (const rec of records) {
    byDay[rec.day_of_week] = byDay[rec.day_of_week] || []
    byDay[rec.day_of_week].push(rec)
  }

  const totalSlots = records.length

  return (
    <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: c.surface, borderBottomColor: c.borderLight }]}>
        <Pressable onPress={() => { hapticLight(); onBack?.() }} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={c.ink} />
        </Pressable>
        <Text style={[s.headerTitle, { color: c.ink }]}>Availability</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor="transparent" />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <View style={s.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.pageTitle, { color: c.ink }]}>My Availability</Text>
            <Text style={[s.subtitle, { color: c.muted }]}>Set the days and times you're available for calls.</Text>
          </View>
          {totalSlots > 0 && (
            <View style={[s.countBadge, { backgroundColor: c.successSurface }]}>
              <Text style={[s.countText, { color: c.successDeep }]}>{totalSlots}</Text>
            </View>
          )}
        </View>

        {/* Messages */}
        {error ? (
          <View style={[s.banner, { backgroundColor: c.dangerSurface, borderColor: c.danger + '20' }]}>
            <Ionicons name="alert-circle" size={16} color={c.danger} />
            <Text style={[s.bannerText, { color: c.dangerDeep }]}>{error}</Text>
            <Pressable onPress={() => setError('')}><Ionicons name="close" size={16} color={c.danger} /></Pressable>
          </View>
        ) : null}
        {success ? (
          <View style={[s.banner, { backgroundColor: c.successSurface, borderColor: c.success + '20' }]}>
            <Ionicons name="checkmark-circle" size={16} color={c.success} />
            <Text style={[s.bannerText, { color: c.successDeep }]}>{success}</Text>
          </View>
        ) : null}

        {/* Weekly overview */}
        <Text style={[s.sectionHead, { color: c.subtle }]}>WEEKLY SCHEDULE</Text>
        <View style={[s.weekCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
          {FULL_DAYS.map((dayName, dayIndex) => {
            const slots = byDay[dayIndex] || []
            const isToday = dayIndex === new Date().getDay()
            return (
              <View key={dayIndex} style={[s.dayRow, dayIndex < 6 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderLight }]}>
                <View style={[s.dayLabelWrap, isToday && { backgroundColor: c.primarySurface }]}>
                  <Text style={[s.dayLabel, { color: isToday ? c.primary : c.muted }, isToday && { fontWeight: '700' }]}>
                    {SHORT_DAYS[dayIndex]}
                  </Text>
                  {isToday && <View style={[s.todayDot, { backgroundColor: c.primary }]} />}
                </View>
                <View style={s.daySlots}>
                  {slots.length === 0 ? (
                    <Text style={[s.noSlots, { color: c.subtle }]}>—</Text>
                  ) : (
                    slots.map(rec => (
                      <Pressable
                        key={rec.id}
                        onLongPress={() => handleDelete(rec.id, dayName, `${rec.start_time}–${rec.end_time}`)}
                        disabled={deletingId === rec.id}
                        style={({ pressed }) => [[s.slotChip, { backgroundColor: c.successSurface, borderColor: c.success + '20' }], pressed && { opacity: 0.6 }]}
                      >
                        <Ionicons name="time-outline" size={12} color={c.successDeep} />
                        <Text style={[s.slotText, { color: c.successDeep }]}>{rec.start_time}–{rec.end_time}</Text>
                      </Pressable>
                    ))
                  )}
                </View>
              </View>
            )
          })}
        </View>
        {totalSlots > 0 && (
          <Text style={[s.hint, { color: c.subtle }]}>Tap and hold a slot to remove it</Text>
        )}

        {/* Add form */}
        <Text style={[s.sectionHead, { color: c.subtle, marginTop: spacing.xl }]}>ADD AVAILABILITY</Text>
        <View style={[s.formCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
          {/* Day picker */}
          <Text style={[s.fieldLabel, { color: c.inkLight }]}>Day</Text>
          <View style={s.dayPicker}>
            {FULL_DAYS.map((d, i) => {
              const hasSlots = (byDay[i] || []).length > 0
              return (
                <Pressable
                  key={i}
                  onPress={() => { hapticLight(); setSelectedDay(i) }}
                  style={[s.dayBtn, { backgroundColor: c.surfaceAlt, borderColor: c.border }, selectedDay === i && { backgroundColor: c.primary, borderColor: c.primary }, hasSlots && selectedDay !== i && { borderColor: c.success + '40' }]}
                >
                  <Text style={[s.dayBtnText, { color: c.muted }, selectedDay === i && { color: c.inverse }, hasSlots && selectedDay !== i && { color: c.successDeep }]}>
                    {SHORT_DAYS[i]}
                  </Text>
                  {hasSlots && <View style={[s.dayDot, { backgroundColor: selectedDay === i ? c.inverse : c.success }]} />}
                </Pressable>
              )
            })}
          </View>

          {/* Time picker - Start */}
          <Text style={[s.fieldLabel, { color: c.inkLight }]}>From</Text>
          <Pressable
            onPress={() => { hapticLight(); setShowStartTimePicker(!showStartTimePicker); setShowEndTimePicker(false) }}
            style={[s.timeInput, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}
          >
            <Ionicons name="time-outline" size={16} color={c.muted} />
            <Text style={[s.timeInputText, { color: c.ink }]}>{start}</Text>
            <Ionicons name={showStartTimePicker ? "chevron-up" : "chevron-down"} size={16} color={c.subtle} />
          </Pressable>
          {showStartTimePicker && (
            <View style={[s.timePicker, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.timePickerScroll}>
                {TIME_PRESETS.map(t => (
                  <Pressable
                    key={t}
                    onPress={() => { hapticLight(); setStart(t); setShowStartTimePicker(false) }}
                    style={[s.timePresetBtn, { backgroundColor: c.surfaceAlt }, start === t && { backgroundColor: c.primary }]}
                  >
                    <Text style={[s.timePresetText, { color: c.muted }, start === t && { color: c.inverse }]}>{t}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Time picker - End */}
          <Text style={[s.fieldLabel, { color: c.inkLight }]}>To</Text>
          <Pressable
            onPress={() => { hapticLight(); setShowEndTimePicker(!showEndTimePicker); setShowStartTimePicker(false) }}
            style={[s.timeInput, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}
          >
            <Ionicons name="time-outline" size={16} color={c.muted} />
            <Text style={[s.timeInputText, { color: c.ink }]}>{end}</Text>
            <Ionicons name={showEndTimePicker ? "chevron-up" : "chevron-down"} size={16} color={c.subtle} />
          </Pressable>
          {showEndTimePicker && (
            <View style={[s.timePicker, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.timePickerScroll}>
                {TIME_PRESETS.map(t => (
                  <Pressable
                    key={t}
                    onPress={() => { hapticLight(); setEnd(t); setShowEndTimePicker(false) }}
                    style={[s.timePresetBtn, { backgroundColor: c.surfaceAlt }, end === t && { backgroundColor: c.primary }]}
                  >
                    <Text style={[s.timePresetText, { color: c.muted }, end === t && { color: c.inverse }]}>{t}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Duration hint */}
          {isValidTime(start) && isValidTime(end) && start < end && (
            <View style={[s.durationHint, { backgroundColor: c.primarySurface }]}>
              <Ionicons name="information-circle" size={14} color={c.primary} />
              <Text style={[s.durationText, { color: c.primary }]}>
                {(() => {
                  const [sh, sm] = start.split(':').map(Number)
                  const [eh, em] = end.split(':').map(Number)
                  const mins = (eh * 60 + em) - (sh * 60 + sm)
                  const h = Math.floor(mins / 60)
                  const m = mins % 60
                  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''} available` : `${m}m available`
                })()}
              </Text>
            </View>
          )}

          <PrimaryButton
            label={adding ? 'Saving...' : 'Save availability'}
            onPress={handleAdd}
            loading={adding}
            disabled={adding}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: FONT, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  content: { paddingHorizontal: spacing.base, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.base },
  pageTitle: { fontFamily: FONT, fontSize: 22, fontWeight: '700', letterSpacing: -0.3, marginBottom: spacing.xs },
  subtitle: { fontFamily: FONT, fontSize: 14 },
  countBadge: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full, marginTop: spacing.xs },
  countText: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },

  /* Banners */
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.base, borderWidth: 1 },
  bannerText: { fontFamily: FONT, fontSize: 13, fontWeight: '500', flex: 1 },

  sectionHead: { fontFamily: FONT, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: spacing.sm },

  /* Week card */
  weekCard: { borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden', marginBottom: spacing.xs, ...elevation.sm },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  dayLabelWrap: { width: 48, alignItems: 'center', gap: 2 },
  dayLabel: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  todayDot: { width: 4, height: 4, borderRadius: 2 },
  daySlots: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  noSlots: { fontFamily: FONT, fontSize: 13 },
  slotChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1 },
  slotText: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  hint: { fontFamily: FONT, fontSize: 11, marginBottom: spacing.base, fontStyle: 'italic' },

  /* Form */
  formCard: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.base, gap: spacing.md, ...elevation.sm },
  fieldLabel: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },

  dayPicker: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  dayBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.sm, borderWidth: 1 },
  dayBtnText: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  dayDot: { width: 5, height: 5, borderRadius: 2.5 },

  timeInput: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radii.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  timeInputText: { flex: 1, fontFamily: FONT, fontSize: 16, fontWeight: '600' },

  timePicker: { borderRadius: radii.md, borderWidth: 1, overflow: 'hidden' },
  timePickerScroll: { padding: spacing.sm, gap: spacing.xs },
  timePresetBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.sm },
  timePresetText: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },

  durationHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radii.sm },
  durationText: { fontFamily: FONT, fontSize: 12, fontWeight: '500' },
})
