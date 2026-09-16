import { useCallback, useEffect, useState, useRef } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { elevation, radii, spacing, FONT, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import { PrimaryButton } from '../components/PrimaryButton'
import type { AuthSession, AvailabilityRecord } from '../types'
import { getMyAvailability, addAvailability, deleteAvailability } from '../services/api'
import { hapticLight, hapticMedium, hapticWarning } from '../services/haptics'

const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function isValidTime(t: string) {
  return /^\d{2}:\d{2}$/.test(t) && Number(t.slice(0, 2)) <= 23 && Number(t.slice(3, 5)) <= 59
}

const TIME_PRESETS = ['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00']

function formatTimeRange(start: string, end: string) {
  const s = start.replace(':00', '').replace(/^0/, '')
  const e = end.replace(':00', '').replace(/^0/, '')
  return `${s} - ${e}`
}

export function AvailabilityScreen({ session, onBack }: { session: AuthSession; onBack?: () => void }) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const [records, setRecords] = useState<AvailabilityRecord[]>([])
  const [saving, setSaving] = useState(false)
  const [selectedDay, setSelectedDay] = useState(new Date().getDay())
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')
  const [availabilityDate, setAvailabilityDate] = useState('')
  const [specificUnavailable, setSpecificUnavailable] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const successTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await getMyAvailability(session.accessToken)
      setRecords(data)
    } catch { /* ignore */ }
    finally { setRefreshing(false) }
  }, [session.accessToken])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (success) {
      if (successTimeout.current) clearTimeout(successTimeout.current)
      successTimeout.current = setTimeout(() => setSuccess(''), 3000)
    }
    return () => { if (successTimeout.current) clearTimeout(successTimeout.current) }
  }, [success])

  const byDay: Record<number, AvailabilityRecord[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
  for (const rec of records) {
    byDay[rec.day_of_week] = byDay[rec.day_of_week] || []
    byDay[rec.day_of_week].push(rec)
  }

  const handleSave = async () => {
    const dated = availabilityDate.trim()
    if (dated && !/^\d{4}-\d{2}-\d{2}$/.test(dated)) { setError('Specific date must use YYYY-MM-DD format'); return }
    const saveStart = specificUnavailable ? '00:00' : start
    const saveEnd = specificUnavailable ? '23:59' : end
    if (!isValidTime(saveStart)) { setError('Start time must be HH:MM format'); return }
    if (!isValidTime(saveEnd)) { setError('End time must be HH:MM format'); return }
    if (saveStart >= saveEnd) { setError('Start time must be before end time'); return }

    setSaving(true); setError(''); setSuccess('')
    try {
      const day = dated ? new Date(`${dated}T00:00:00`).getDay() : selectedDay
      await addAvailability(session.accessToken, day, saveStart, saveEnd, !specificUnavailable, dated || undefined)
      setSuccess(editingId ? `${FULL_DAYS[selectedDay]} availability updated` : `${FULL_DAYS[selectedDay]} availability saved`)
      setEditingId(null)
      setStart('09:00')
      setEnd('17:00')
      setAvailabilityDate('')
      setSpecificUnavailable(false)
      await load()
    } catch (e: any) { setError(e.message || 'Could not save') }
    finally { setSaving(false) }
  }

  const handleSlotTap = (rec: AvailabilityRecord) => {
    hapticMedium()
    setSelectedDay(rec.day_of_week)
    setStart(rec.start_time.slice(0, 5))
    setEnd(rec.end_time.slice(0, 5))
    setEditingId(rec.id)
    setError('')
    setSuccess('')
  }

  const handleDelete = async (id: string, dayName: string) => {
    hapticWarning()
    Alert.alert(
      'Remove availability',
      `Remove ${dayName} availability?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            setDeletingId(id)
            try {
              await deleteAvailability(session.accessToken, id)
              if (editingId === id) { setEditingId(null); setStart('09:00'); setEnd('17:00') }
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

  const handleCancelEdit = () => {
    hapticLight()
    setEditingId(null)
    setStart('09:00')
    setEnd('17:00')
    setAvailabilityDate('')
    setSpecificUnavailable(false)
    setError('')
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
            <View style={[s.countBadge, { backgroundColor: c.primarySurface }]}>
              <Text style={[s.countText, { color: c.primary }]}>{totalSlots}</Text>
            </View>
          )}
        </View>

        {/* Messages */}
        {error ? (
          <View style={[s.banner, { backgroundColor: c.dangerSurface, borderColor: (c.danger || '#DC2626') + '20' }]}>
            <Ionicons name="alert-circle" size={16} color={c.danger || '#DC2626'} />
            <Text style={[s.bannerText, { color: c.danger || '#DC2626', flex: 1 }]}>{error}</Text>
            <Pressable onPress={() => setError('')} hitSlop={8}><Ionicons name="close" size={16} color={c.danger || '#DC2626'} /></Pressable>
          </View>
        ) : null}
        {success ? (
          <View style={[s.banner, { backgroundColor: c.successSurface, borderColor: c.success + '20' }]}>
            <Ionicons name="checkmark-circle" size={16} color={c.success} />
            <Text style={[s.bannerText, { color: c.success, flex: 1 }]}>{success}</Text>
          </View>
        ) : null}

        {/* Weekly overview */}
        <Text style={[s.sectionHead, { color: c.subtle }]}>WEEKLY SCHEDULE</Text>
        <View style={[s.weekCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
          {FULL_DAYS.map((dayName, dayIndex) => {
            const slots = byDay[dayIndex] || []
            const isToday = dayIndex === new Date().getDay()
            const isSelected = dayIndex === selectedDay
            return (
              <Pressable
                key={dayIndex}
                onPress={() => {
                  hapticLight()
                  setSelectedDay(dayIndex)
                  // If this day has a slot, pre-fill it for editing
                  if (slots.length > 0 && !editingId) {
                    handleSlotTap(slots[0])
                  }
                }}
                style={({ pressed }) => [
                  s.dayRow,
                  dayIndex < 6 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderLight },
                  isSelected && { backgroundColor: c.primarySurface + '40' },
                  pressed && { backgroundColor: c.surfaceAlt },
                ]}
              >
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
                        onPress={() => handleSlotTap(rec)}
                        onLongPress={() => handleDelete(rec.id, dayName)}
                        disabled={deletingId === rec.id}
                        style={({ pressed }) => [
                          s.slotChip,
                          {
                            backgroundColor: editingId === rec.id ? c.primarySurface : c.successSurface,
                            borderColor: editingId === rec.id ? c.primary : c.success + '30',
                            borderWidth: 1,
                          },
                          pressed && { opacity: 0.6 },
                        ]}
                      >
                        <Ionicons
                          name={editingId === rec.id ? 'pencil' : 'time-outline'}
                          size={12}
                          color={editingId === rec.id ? c.primary : c.success}
                        />
                        <Text style={[s.slotText, { color: editingId === rec.id ? c.primary : c.success }]}>
                          {formatTimeRange(rec.start_time, rec.end_time)}
                        </Text>
                      </Pressable>
                    ))
                  )}
                </View>
              </Pressable>
            )
          })}
        </View>
        {totalSlots > 0 && (
          <Text style={[s.hint, { color: c.subtle }]}>Tap a slot to edit. Long-press to remove.</Text>
        )}

        {/* Date-specific overrides */}
        {records.some(record => record.availability_date) && (
          <>
            <Text style={[s.sectionHead, { color: c.subtle, marginTop: spacing.lg }]}>DATE-SPECIFIC CHANGES</Text>
            <View style={[s.formCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
              {records.filter(record => record.availability_date).map(record => (
                <View key={record.id} style={s.dateOverrideRow}>
                  <View style={{ flex: 1 }}><Text style={[s.slotText, { color: c.ink }]}>{record.availability_date}</Text><Text style={[s.noSlots, { color: record.is_available ? c.success : c.danger }]}>{record.is_available ? formatTimeRange(record.start_time, record.end_time) : 'Unavailable all day'}</Text></View>
                  <Pressable onPress={() => handleDelete(record.id, record.availability_date || 'date')}><Ionicons name="trash-outline" size={18} color={c.danger} /></Pressable>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Add / Edit form */}
        <View style={s.formHeader}>
          <Text style={[s.sectionHead, { color: c.subtle, marginTop: spacing.xl, marginBottom: 0 }]}>
            {editingId ? 'EDIT' : 'ADD'} AVAILABILITY
          </Text>
          {editingId && (
            <Pressable onPress={handleCancelEdit} style={s.cancelEditBtn}>
              <Ionicons name="close-circle" size={16} color={c.muted} />
              <Text style={[s.cancelEditText, { color: c.muted }]}>Cancel edit</Text>
            </Pressable>
          )}
        </View>

        <View style={[s.formCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
          <Text style={[s.fieldLabel, { color: c.inkLight }]}>Specific date (optional)</Text>
          <TextInput value={availabilityDate} onChangeText={setAvailabilityDate} placeholder="YYYY-MM-DD · up to 4 months ahead" placeholderTextColor={c.subtle} style={[s.dateInput, { color: c.ink, backgroundColor: c.surfaceAlt, borderColor: c.border }]} />
          <Text style={[s.dateHint, { color: c.subtle }]}>Leave this blank for a recurring weekly availability pattern.</Text>
          <View style={s.unavailableRow}><View style={{ flex: 1 }}><Text style={[s.fieldLabel, { color: c.ink }]}>Unavailable all day</Text><Text style={[s.dateHint, { color: c.muted }]}>Use this for a whole day or a one-off date you cannot work.</Text></View><Switch value={specificUnavailable} onValueChange={setSpecificUnavailable} trackColor={{ false: c.border, true: c.primarySurface }} thumbColor={specificUnavailable ? c.primary : c.subtle} /></View>
          {/* Day picker */}
          <Text style={[s.fieldLabel, { color: c.inkLight }]}>Day</Text>
          <View style={s.dayPicker}>
            {FULL_DAYS.map((d, i) => {
              const hasSlots = (byDay[i] || []).length > 0
              return (
                <Pressable
                  key={i}
                  onPress={() => { hapticLight(); setSelectedDay(i) }}
                  style={[
                    s.dayBtn,
                    { backgroundColor: c.surfaceAlt, borderColor: c.border },
                    selectedDay === i && { backgroundColor: c.primary, borderColor: c.primary },
                    hasSlots && selectedDay !== i && { borderColor: c.success + '40' },
                  ]}
                >
                  <Text style={[
                    s.dayBtnText,
                    { color: c.muted },
                    selectedDay === i && { color: '#FFFFFF' },
                    hasSlots && selectedDay !== i && { color: c.success },
                  ]}>
                    {SHORT_DAYS[i]}
                  </Text>
                  {hasSlots && <View style={[s.dayDot, { backgroundColor: selectedDay === i ? '#FFFFFF' : c.success }]} />}
                </Pressable>
              )
            })}
          </View>

          {/* Time - From */}
          <Text style={[s.fieldLabel, { color: c.inkLight }]}>Start time</Text>
          <View style={s.timeGrid}>
            {TIME_PRESETS.map(t => (
              <Pressable
                key={t}
                onPress={() => { hapticLight(); setStart(t) }}
                style={[
                  s.timePresetBtn,
                  { backgroundColor: c.surfaceAlt, borderColor: c.border, borderWidth: 1 },
                  start === t && { backgroundColor: c.primary, borderColor: c.primary },
                ]}
              >
                <Text style={[s.timePresetText, { color: c.muted }, start === t && { color: '#FFFFFF' }]}>{t}</Text>
              </Pressable>
            ))}
          </View>

          {/* Time - To */}
          <Text style={[s.fieldLabel, { color: c.inkLight }]}>End time</Text>
          <View style={s.timeGrid}>
            {TIME_PRESETS.map(t => (
              <Pressable
                key={t}
                onPress={() => { hapticLight(); setEnd(t) }}
                style={[
                  s.timePresetBtn,
                  { backgroundColor: c.surfaceAlt, borderColor: c.border, borderWidth: 1 },
                  end === t && { backgroundColor: c.primary, borderColor: c.primary },
                ]}
              >
                <Text style={[s.timePresetText, { color: c.muted }, end === t && { color: '#FFFFFF' }]}>{t}</Text>
              </Pressable>
            ))}
          </View>

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
                  return `${h}h ${m > 0 ? m + 'm ' : ''}available on ${FULL_DAYS[selectedDay]}`
                })()}
              </Text>
            </View>
          )}
          {isValidTime(start) && isValidTime(end) && start >= end && (
            <View style={[s.durationHint, { backgroundColor: (c.dangerSurface || '#FEE2E2') }]}>
              <Ionicons name="alert-circle" size={14} color={c.danger || '#DC2626'} />
              <Text style={[s.durationText, { color: c.danger || '#DC2626' }]}>Start time must be before end time</Text>
            </View>
          )}

          <PrimaryButton
            label={saving ? 'Saving...' : editingId ? `Update ${FULL_DAYS[selectedDay]}` : `Save ${FULL_DAYS[selectedDay]}`}
            onPress={handleSave}
            loading={saving}
            disabled={saving}
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

  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.base, borderWidth: 1 },
  bannerText: { fontFamily: FONT, fontSize: 13, fontWeight: '500' },

  sectionHead: { fontFamily: FONT, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: spacing.sm },

  weekCard: { borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden', marginBottom: spacing.xs, ...elevation.sm },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  dayLabelWrap: { width: 48, alignItems: 'center', gap: 2 },
  dayLabel: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  todayDot: { width: 4, height: 4, borderRadius: 2 },
  daySlots: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  noSlots: { fontFamily: FONT, fontSize: 13 },
  slotChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  slotText: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  hint: { fontFamily: FONT, fontSize: 11, marginBottom: spacing.base, fontStyle: 'italic' },

  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancelEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xl },
  cancelEditText: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },

  formCard: { borderRadius: radii.lg, borderWidth: 1, padding: spacing.base, gap: spacing.md, ...elevation.sm },
  fieldLabel: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },

  dayPicker: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  dayBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.sm, borderWidth: 1 },
  dayBtnText: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
  dayDot: { width: 5, height: 5, borderRadius: 2.5 },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  timePresetBtn: { paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.sm, borderRadius: radii.sm },
  timePresetText: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },

  durationHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radii.sm },
  durationText: { fontFamily: FONT, fontSize: 12, fontWeight: '500', flex: 1 },
  dateInput: { borderWidth: 1, borderRadius: radii.sm, padding: spacing.md, fontFamily: FONT, fontSize: 13 },
  dateHint: { fontFamily: FONT, fontSize: 11, lineHeight: 16 },
  unavailableRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  dateOverrideRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D1D5DB' },
})
