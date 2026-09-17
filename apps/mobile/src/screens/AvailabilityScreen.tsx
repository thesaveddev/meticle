import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { elevation, radii, spacing, FONT, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import { PrimaryButton } from '../components/PrimaryButton'
import type { AuthSession, AvailabilityRecord } from '../types'
import { getMyAvailability, addAvailability, deleteAvailability, getMyLeaveRequests } from '../services/api'
import { hapticLight, hapticMedium, hapticWarning } from '../services/haptics'
import { formatDateOnly, formatTimeOnly, localDateInput } from '../utils/dateFormat'

const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function isValidTime(t: string) {
  return /^\d{2}:\d{2}$/.test(t) && Number(t.slice(0, 2)) <= 23 && Number(t.slice(3, 5)) <= 59
}

function formatDateInput(date: Date) {
  return localDateInput(date)
}

function parseDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return new Date()
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

function calendarDays(month: Date): Array<Date | null> {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  return [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: count }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)),
  ]
}

const TIME_PRESETS = ['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00']

function formatTimeRange(start: string, end: string) {
  return `${formatTimeOnly(start)} – ${formatTimeOnly(end)}`
}

type AvailabilityDraft = {
  id: string
  date: string
  start: string
  end: string
  unavailable: boolean
}

export function AvailabilityScreen({ session, onBack }: { session: AuthSession; onBack?: () => void }) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const [records, setRecords] = useState<AvailabilityRecord[]>([])
  const [leaveRequests, setLeaveRequests] = useState<any[]>([])
  const [activeView, setActiveView] = useState<'schedule' | 'submit'>('schedule')
  const [saving, setSaving] = useState(false)
  const [selectedDay, setSelectedDay] = useState(new Date().getDay())
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('17:00')
  const [availabilityDate, setAvailabilityDate] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [specificUnavailable, setSpecificUnavailable] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [draftEntries, setDraftEntries] = useState<AvailabilityDraft[]>([])

  const successTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try {
      const [data, leave] = await Promise.all([
        getMyAvailability(session.accessToken),
        getMyLeaveRequests(session.accessToken).catch(() => []),
      ])
      setRecords(data)
      setLeaveRequests(leave)
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
  for (const rec of records.filter(record => !record.availability_date)) {
    byDay[rec.day_of_week] = byDay[rec.day_of_week] || []
    byDay[rec.day_of_week].push(rec)
  }

  const minimumAvailabilityDate = new Date()
  minimumAvailabilityDate.setHours(0, 0, 0, 0)
  const maximumAvailabilityDate = new Date(minimumAvailabilityDate)
  maximumAvailabilityDate.setMonth(maximumAvailabilityDate.getMonth() + 4)

  const days = useMemo(() => calendarDays(calendarMonth), [calendarMonth])
  const currentMonth = new Date(minimumAvailabilityDate.getFullYear(), minimumAvailabilityDate.getMonth(), 1)
  const maximumMonth = new Date(maximumAvailabilityDate.getFullYear(), maximumAvailabilityDate.getMonth(), 1)
  const canGoPreviousMonth = calendarMonth.getTime() > currentMonth.getTime()
  const canGoNextMonth = calendarMonth.getTime() < maximumMonth.getTime()

  const selectCalendarDate = (date: Date) => {
    const selected = new Date(date)
    selected.setHours(0, 0, 0, 0)
    if (selected < minimumAvailabilityDate || selected > maximumAvailabilityDate) return
    const dateKey = formatDateInput(selected)
    const existing = records.find(record => record.availability_date === dateKey)
    setAvailabilityDate(dateKey)
    setSelectedDay(selected.getDay())
    setEditingId(existing?.id || null)
    if (existing) {
      setSpecificUnavailable(!existing.is_available)
      setStart(existing.start_time.slice(0, 5))
      setEnd(existing.end_time.slice(0, 5))
    } else {
      setSpecificUnavailable(false)
      setStart('09:00')
      setEnd('17:00')
    }
    setError('')
    setSuccess('')
  }

  const resetDraftForm = () => {
    setStart('09:00')
    setEnd('17:00')
    setSpecificUnavailable(false)
    setEditingId(null)
  }

  const addDraft = () => {
    const dated = availabilityDate.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dated)) { setError('Choose a date from the calendar first'); return }
    const saveStart = specificUnavailable ? '00:00' : start
    const saveEnd = specificUnavailable ? '23:59' : end
    if (!isValidTime(saveStart) || !isValidTime(saveEnd)) { setError('Choose valid start and end times'); return }
    if (saveStart >= saveEnd) { setError('Start time must be before end time'); return }
    if (specificUnavailable && draftEntries.some(entry => entry.date === dated && !entry.unavailable)) {
      setDraftEntries(prev => prev.filter(entry => entry.date !== dated))
    }
    setDraftEntries(prev => [
      ...prev.filter(entry => !(entry.date === dated && specificUnavailable) && !(entry.date === dated && !specificUnavailable && entry.unavailable)),
      { id: `${dated}-${Date.now()}`, date: dated, start: saveStart, end: saveEnd, unavailable: specificUnavailable },
    ])
    setError('')
    setSuccess(`${formatDateOnly(dated)} added to your submission`)
    resetDraftForm()
  }

  const submitBatch = async () => {
    if (draftEntries.length === 0) { setError('Add at least one date before submitting'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      for (const entry of draftEntries) {
        const day = new Date(`${entry.date}T00:00:00`).getDay()
        await addAvailability(session.accessToken, day, entry.start, entry.end, !entry.unavailable, entry.date)
      }
      setDraftEntries([])
      setAvailabilityDate('')
      resetDraftForm()
      setSuccess('Availability submitted for all selected dates')
      await load()
    } catch (e: any) { setError(e.message || 'Could not submit availability') }
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

        <View style={[s.tabs, { backgroundColor: c.surfaceAlt }]}>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeView === 'schedule' }} onPress={() => setActiveView('schedule')} style={[s.tab, activeView === 'schedule' && { backgroundColor: c.surface, ...elevation.sm }]}><Ionicons name="calendar-outline" size={16} color={activeView === 'schedule' ? c.primary : c.muted} /><Text style={[s.tabText, { color: activeView === 'schedule' ? c.primary : c.muted }]}>Schedule</Text></Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeView === 'submit' }} onPress={() => setActiveView('submit')} style={[s.tab, activeView === 'submit' && { backgroundColor: c.surface, ...elevation.sm }]}><Ionicons name="add-circle-outline" size={16} color={activeView === 'submit' ? c.primary : c.muted} /><Text style={[s.tabText, { color: activeView === 'submit' ? c.primary : c.muted }]}>Submit availability</Text></Pressable>
        </View>

        {activeView === 'schedule' && <>
        {leaveRequests.filter(request => ['pending', 'approved'].includes(String(request.status).toLowerCase())).length > 0 && <View style={[s.leaveNotice, { backgroundColor: c.warningSurface, borderColor: c.warning + '30' }]}><Ionicons name="airplane-outline" size={16} color={c.warning} /><View style={{ flex: 1 }}><Text style={[s.leaveNoticeTitle, { color: c.ink }]}>Booked time away</Text><Text style={[s.leaveNoticeText, { color: c.muted }]}>{leaveRequests.filter(request => ['pending', 'approved'].includes(String(request.status).toLowerCase())).slice(0, 3).map(request => `${formatDateOnly(request.start_date)} – ${formatDateOnly(request.end_date)}`).join(' · ')}</Text><Text style={[s.leaveNoticeHint, { color: c.warning }]}>These dates override your usual availability.</Text></View></View>}
        {/* Weekly overview */}
        <View style={s.sectionTitleRow}>
          <Text style={[s.sectionHead, { color: c.subtle, marginBottom: 0 }]}>THIS WEEK</Text>
          <Text style={[s.weekHint, { color: c.muted }]}>Your recurring pattern</Text>
        </View>
        <View style={[s.weekCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
          {FULL_DAYS.map((dayName, dayIndex) => {
            const slots = byDay[dayIndex] || []
            const availableSlots = slots.filter(slot => slot.is_available !== false)
            const unavailableAllDay = slots.length === 0 || (availableSlots.length === 0 && slots.some(slot => slot.is_available === false))
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
                    {dayName}
                  </Text>
                  {isToday && <View style={[s.todayDot, { backgroundColor: c.primary }]} />}
                </View>
                <View style={s.daySlots}>
                  {unavailableAllDay ? (
                    <View style={[s.availabilitySummary, { backgroundColor: c.surfaceAlt }]}>
                      <Ionicons name="close-circle-outline" size={14} color={c.subtle} />
                      <Text style={[s.availabilitySummaryText, { color: c.muted }]}>Unavailable all day</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={[s.availabilitySummaryText, { color: c.success }]}>Available</Text>
                      {availableSlots.map(rec => (
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
                      ))}
                    </>
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
                  <View style={{ flex: 1 }}><Text style={[s.slotText, { color: c.ink }]}>{formatDateOnly(record.availability_date)}</Text><Text style={[s.noSlots, { color: record.is_available ? c.success : c.danger }]}>{record.is_available ? formatTimeRange(record.start_time, record.end_time) : 'Unavailable all day'}</Text></View>
                  <Pressable onPress={() => handleDelete(record.id, record.availability_date || 'date')}><Ionicons name="trash-outline" size={18} color={c.danger} /></Pressable>
                </View>
              ))}
            </View>
          </>
        )}

        </>}

        {activeView === 'submit' && <>
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
          <View style={s.calendarHeading}>
            <View style={{ flex: 1 }}>
              <Text style={[s.fieldLabel, { color: c.inkLight }]}>Choose a date</Text>
              <Text style={[s.dateHint, { color: c.subtle }]}>Choose each date you want to submit, add its availability, then send everything together.</Text>
            </View>
            {availabilityDate && <Pressable accessibilityRole="button" accessibilityLabel="Clear selected date" onPress={() => { setAvailabilityDate(''); setEditingId(null); setSpecificUnavailable(false) }} hitSlop={8}><Ionicons name="close-circle" size={20} color={c.muted} /></Pressable>}
          </View>
          <View style={[s.calendarCard, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
            <View style={s.calendarToolbar}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous month" disabled={!canGoPreviousMonth} onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))} style={s.calendarArrow}>
                <Ionicons name="chevron-back" size={20} color={canGoPreviousMonth ? c.ink : c.border} />
              </Pressable>
              <Text style={[s.calendarMonth, { color: c.ink }]}>{monthLabel(calendarMonth)}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={!canGoNextMonth} onPress={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))} style={s.calendarArrow}>
                <Ionicons name="chevron-forward" size={20} color={canGoNextMonth ? c.ink : c.border} />
              </Pressable>
            </View>
            <View style={s.calendarWeekRow}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <Text key={`${day}-${index}`} style={[s.calendarWeekDay, { color: c.subtle }]}>{day}</Text>)}</View>
            <View style={s.calendarGrid}>
              {days.map((date, index) => {
                if (!date) return <View key={`empty-${index}`} style={s.calendarDay} />
                const key = formatDateInput(date)
                const disabled = date < minimumAvailabilityDate || date > maximumAvailabilityDate
                const selected = availabilityDate === key
                const existing = records.find(record => record.availability_date === key)
                return <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${key}${existing ? existing.is_available ? ', available' : ', unavailable' : ''}`} disabled={disabled} onPress={() => { hapticLight(); selectCalendarDate(date) }} style={[s.calendarDay, disabled && s.calendarDayDisabled, selected && { backgroundColor: c.primary }]}>
                  <Text style={[s.calendarDayText, { color: disabled ? c.border : selected ? c.inverse : c.ink }]}>{date.getDate()}</Text>
                  {existing && <View style={[s.calendarMarker, { backgroundColor: selected ? c.inverse : existing.is_available ? c.success : c.danger }]} />}
                </Pressable>
              })}
            </View>
          </View>
          {availabilityDate && <View style={[s.selectedDateBanner, { backgroundColor: c.primarySurface }]}><Ionicons name="calendar" size={16} color={c.primary} /><Text style={[s.selectedDateText, { color: c.primary }]}>Selected {parseDateInput(availabilityDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</Text></View>}
          <View style={s.unavailableRow}><View style={{ flex: 1 }}><Text style={[s.fieldLabel, { color: c.ink }]}>Unavailable all day</Text><Text style={[s.dateHint, { color: c.muted }]}>Use this for a whole day or a one-off date you cannot work.</Text></View><Switch value={specificUnavailable} onValueChange={setSpecificUnavailable} trackColor={{ false: c.border, true: c.primarySurface }} thumbColor={specificUnavailable ? c.primary : c.subtle} /></View>
          {!specificUnavailable && <>
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

          </>}
          <PrimaryButton
            label="Add to submission"
            onPress={addDraft}
            loading={false}
            disabled={saving}
          />
          {draftEntries.length > 0 && (
            <View style={[s.batchCard, { backgroundColor: c.primarySurface, borderColor: c.primary + '25' }]}>
              <View style={s.batchHeader}><Text style={[s.batchTitle, { color: c.ink }]}>Ready to submit</Text><Text style={[s.batchCount, { color: c.primary }]}>{draftEntries.length} {draftEntries.length === 1 ? 'entry' : 'entries'}</Text></View>
              {draftEntries.map(entry => (
                <View key={entry.id} style={s.batchRow}>
                  <View style={{ flex: 1 }}><Text style={[s.slotText, { color: c.ink }]}>{formatDateOnly(entry.date)}</Text><Text style={[s.noSlots, { color: entry.unavailable ? c.muted : c.primary }]}>{entry.unavailable ? 'Unavailable all day' : formatTimeRange(entry.start, entry.end)}</Text></View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${entry.date}`} onPress={() => setDraftEntries(prev => prev.filter(item => item.id !== entry.id))}><Ionicons name="close-circle-outline" size={19} color={c.danger} /></Pressable>
                </View>
              ))}
              <PrimaryButton label={saving ? 'Submitting…' : `Submit ${draftEntries.length} ${draftEntries.length === 1 ? 'entry' : 'entries'}`} onPress={submitBatch} loading={saving} disabled={saving} />
            </View>
          )}
        </View>
        </>}
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
  tabs: { flexDirection: 'row', borderRadius: radii.md, padding: 3, marginBottom: spacing.lg },
  tab: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radii.sm },
  tabText: { fontFamily: FONT, fontSize: 12, fontWeight: '700' },
  leaveNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderRadius: radii.md, marginBottom: spacing.md },
  leaveNoticeTitle: { fontFamily: FONT, fontSize: 13, fontWeight: '700' },
  leaveNoticeText: { fontFamily: FONT, fontSize: 12, marginTop: 3 },
  leaveNoticeHint: { fontFamily: FONT, fontSize: 11, marginTop: 4, fontWeight: '600' },

  sectionTitleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.sm, marginBottom: spacing.sm },
  sectionHead: { fontFamily: FONT, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: spacing.sm },
  weekHint: { fontFamily: FONT, fontSize: 11 },

  weekCard: { borderRadius: radii.lg, borderWidth: 1, overflow: 'hidden', marginBottom: spacing.xs, ...elevation.sm },
  dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  dayLabelWrap: { width: 48, alignItems: 'center', gap: 2 },
  dayLabel: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  todayDot: { width: 4, height: 4, borderRadius: 2 },
  daySlots: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  availabilitySummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.sm },
  availabilitySummaryText: { fontFamily: FONT, fontSize: 12, fontWeight: '600' },
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
  calendarHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  calendarCard: { borderWidth: 1, borderRadius: radii.md, padding: spacing.sm },
  calendarToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  calendarArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  calendarMonth: { fontFamily: FONT, fontSize: 15, fontWeight: '700' },
  calendarWeekRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.xs },
  calendarWeekDay: { width: 36, textAlign: 'center', fontFamily: FONT, fontSize: 11, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDay: { width: '14.285%', height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm },
  calendarDayDisabled: { opacity: 0.45 },
  calendarDayText: { fontFamily: FONT, fontSize: 13, fontWeight: '600' },
  calendarMarker: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  selectedDateBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, borderRadius: radii.sm },
  selectedDateText: { fontFamily: FONT, fontSize: 12, fontWeight: '600', flex: 1 },
  dateHint: { fontFamily: FONT, fontSize: 11, lineHeight: 16 },
  unavailableRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  dateOverrideRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D1D5DB' },
  batchCard: { borderWidth: 1, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm },
  batchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  batchTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '800' },
  batchCount: { fontFamily: FONT, fontSize: 12, fontWeight: '700' },
  batchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#CBD5E1' },
})
