import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, elevation, radii, spacing, FONT, useAppColors } from '../theme'
import { useDynamicStyles } from '../utils/patchStaticStyles'
import { dyn } from '../utils/dynamicStyles'
import { SkeletonCalendar } from '../components/Skeleton'
import type { AuthSession, HomecareVisit, MobileUser } from '../types'
import { getMyVisits } from '../services/api'
import { IconCheck, IconClock, IconAlert, IconForward, IconNavigate, IconTwoPerson } from '../components/Icons'
import { isOverdue, overdueLabel } from '../utils/visitStatus'
import { hapticLight, hapticMedium } from '../services/haptics'
import { MapPickerModal } from '../components/MapPickerModal'

interface Props {
  session: AuthSession
  user: MobileUser
  onVisit: (visit: HomecareVisit) => void
  onSwap: () => void
}

function time(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay() // 0=Sun, 1=Mon...
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function StatusDot({ status, overdue, c, s }: { status: string; overdue?: boolean; c: any; s: any }) {
  if (overdue) return <IconAlert size={12} color={c.danger} />
  const color = status === 'completed' ? c.success
    : status === 'checked_in' ? c.primary
    : status === 'missed' ? c.danger
    : c.subtle
  return <View style={[s.statusDot, { backgroundColor: color }]} />
}

export function WeekScreen({ session, user, onVisit, onSwap }: Props) {
  const c = useAppColors()
  const s = useDynamicStyles(styles)
  const [visits, setVisits] = useState<HomecareVisit[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())
  const [mapPickerOpen, setMapPickerOpen] = useState(false)
  const [navDest, setNavDest] = useState<{ destination?: string; latitude?: number; longitude?: number; label?: string }>({})

  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear, setViewYear] = useState(now.getFullYear())

  const loadMonth = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const from = new Date(viewYear, viewMonth, 1)
      const to = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59)
      const data = await getMyVisits(session.accessToken, from.toISOString(), to.toISOString())
      setVisits(data.sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()))
    } catch {}
    finally { setLoading(false); setRefreshing(false) }
  }, [session.accessToken, viewMonth, viewYear])

  useEffect(() => { loadMonth() }, [loadMonth])

  // Calendar grid
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth)
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
    const cells: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    return cells
  }, [viewYear, viewMonth])

  // Visits for selected day
  const dayVisits = useMemo(() => {
    return visits.filter(v => isSameDay(new Date(v.scheduled_start), selectedDay))
  }, [visits, selectedDay])

  const total = visits.length
  const completed = visits.filter(v => v.status === 'completed').length

  const prevMonth = () => {
    hapticLight()
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    hapticLight()
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  if (loading) {
    return (
      <SafeAreaView style={[s.screen, dyn(c).screen]}>
        <SkeletonCalendar c={c} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[s.screen, dyn(c).screen]}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { hapticMedium(); loadMonth(true) }} tintColor="transparent" colors={['transparent']} />}
      >
        {/* Month header */}
        <View style={s.monthHeader}>
          <Pressable onPress={prevMonth} style={[s.monthNav, { backgroundColor: c.surface }]}>  
            <Text style={[s.monthNavText, { color: c.primary }]}>←</Text>
          </Pressable>
          <Text style={[s.monthTitle, { color: c.ink }]}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
          <Pressable onPress={nextMonth} style={[s.monthNav, { backgroundColor: c.surface }]}>  
            <Text style={[s.monthNavText, { color: c.primary }]}>→</Text>
          </Pressable>
        </View>

        {/* Summary */}
        <Text style={[s.summary, { color: c.muted }]}>{total} calls · {completed} completed</Text>

        {/* Calendar grid */}
        <View style={s.calendar}>
          {/* Day labels */}
          {DAY_LABELS.map((d, i) => (
            <Text key={i} style={[s.dayLabel, { color: c.subtle }]}>{d}</Text>
          ))}
          {/* Day cells */}
          {calendarDays.map((day, i) => {
            if (day === null) return <View key={`empty-${i}`} style={s.dayCell} />
            const cellDate = new Date(viewYear, viewMonth, day)
            const isToday = isSameDay(cellDate, now)
            const isSelected = isSameDay(cellDate, selectedDay)
            const dayVisitCount = visits.filter(v => isSameDay(new Date(v.scheduled_start), cellDate)).length
            const dayCompleted = visits.filter(v => isSameDay(new Date(v.scheduled_start), cellDate) && v.status === 'completed').length

            return (
              <Pressable key={day} onPress={() => { hapticLight(); setSelectedDay(cellDate) }}
                style={({ pressed }) => [s.dayCell, pressed && { opacity: 0.7 }]}>
                <View style={[
                  s.dayNum,
                  isToday && { backgroundColor: c.primarySurface },
                  isSelected && { backgroundColor: c.primary },
                ]}>
                  <Text style={[
                    s.dayNumText,
                    { color: c.ink },
                    isToday && [s.dayNumTextToday, { color: c.primary }],
                    isSelected && [s.dayNumTextSelected, { color: c.inverse }],
                  ]}>{day}</Text>
                </View>
                {dayVisitCount > 0 && (
                  <View style={s.dayDots}>
                    {dayCompleted > 0 && <View style={[s.dayDot, { backgroundColor: c.success }]} />}
                    {dayCompleted < dayVisitCount && <View style={[s.dayDot, { backgroundColor: c.primary }]} />}
                  </View>
                )}
              </Pressable>
            )
          })}
        </View>

        {/* Swap button */}
        <Pressable onPress={() => { hapticLight(); onSwap() }} style={({ pressed }) => [[s.swapCard, { backgroundColor: c.primarySurface, borderColor: c.primary + '20' }], pressed && { opacity: 0.8 }]}>
          <View style={s.swapIconWrap}>
            <IconForward size={16} color={c.primary} />
          </View>
          <View style={s.swapInfo}>
            <Text style={[s.swapTitle, { color: c.primary }]}>Swap or transfer a call</Text>
            <Text style={[s.swapDesc, { color: c.muted }]}>Request to swap with a colleague</Text>
          </View>
          <Text style={[s.swapArrow, { color: c.primary }]}>→</Text>
        </Pressable>

        {/* Day visits */}
        <View style={s.daySection}>
          <Text style={[s.daySectionLabel, { color: c.subtle }]}>
            {selectedDay.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>

          {dayVisits.length === 0 ? (
            <View style={[s.emptyCard, { backgroundColor: c.surface, borderColor: c.borderLight }]}>
              <Text style={[s.emptyTitle, { color: c.ink }]}>No calls on this day</Text>
              <Text style={[s.emptyCopy, { color: c.muted }]}>Select another day or swap a call with a colleague.</Text>
            </View>
          ) : (
            dayVisits.map(visit => {
              const ov = isOverdue(visit)
              return (
                <Pressable key={visit.id} onPress={() => { hapticLight(); onVisit(visit) }}
                  style={({ pressed }) => [
                    s.visitCard,
                    ov
                      ? { backgroundColor: c.dangerSurface }
                      : { backgroundColor: c.surface },
                    pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                  ]}>
                  <View style={s.visitTimeCol}>                   <Text style={[s.visitTime, { color: ov ? c.danger : c.primary }]}>{time(visit.scheduled_start)}</Text>
                    <View style={[s.visitTimeDash, { backgroundColor: ov ? c.danger : c.border }]} />
                    <Text style={[s.visitTimeEnd, { color: ov ? c.danger : c.muted }]}>{time(visit.scheduled_end)}</Text>
                  </View>
                  <View style={s.visitInfo}>                   <Text style={[s.visitLabel, { color: ov ? c.danger : c.ink }]} numberOfLines={1}>{visit.label}</Text>
                    {visit.person_name && <Text style={[s.visitPerson, { color: ov ? c.danger : c.muted }]} numberOfLines={1}>{visit.person_name}</Text>}
                    {ov && <Text style={{ fontFamily: FONT, fontSize: 11, fontWeight: '700', color: c.danger, marginTop: 2 }}>{overdueLabel(visit)}</Text>}
                    {visit.person_address && (
                      <View style={s.addrRow}>                         <Text style={[s.visitAddr, { color: ov ? c.danger : c.subtle }]} numberOfLines={1}>{visit.person_address}</Text>
                        <Pressable onPress={() => { hapticLight(); setNavDest({ destination: visit.person_address!, label: visit.person_name || visit.label }); setMapPickerOpen(true) }}                           style={({ pressed }) => [[s.navPill, { backgroundColor: ov ? c.dangerSurface : c.primarySurface }], pressed && { opacity: 0.7 }]}>
                          <IconNavigate size={12} color={ov ? c.danger : c.primary} />
                        </Pressable>
                      </View>
                    )}
                  </View>
                  {visit.requires_two_staff && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
                      <IconTwoPerson size={12} color={c.warning} />
                      <Text style={{ fontFamily: FONT, fontSize: 10, fontWeight: '700', color: c.warning }}>2-person</Text>
                    </View>
                  )}
                  <StatusDot status={visit.status} overdue={ov} c={c} s={s} />
                </Pressable>
              )
            })
          )}
        </View>

        <View style={{ height: spacing.xxxl }} />
      </ScrollView>

      <MapPickerModal
        visible={mapPickerOpen}
        onClose={() => setMapPickerOpen(false)}
        destination={navDest.destination}
        latitude={navDest.latitude}
        longitude={navDest.longitude}
        label={navDest.label}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingTop: spacing.base },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { fontFamily: FONT, fontSize: 13, fontWeight: '500', color: colors.muted },

  /* Month header */
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.base, marginBottom: spacing.xs },
  monthNav: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', ...elevation.sm },
  monthNavText: { fontFamily: FONT, fontSize: 16, fontWeight: '600', color: colors.primary },
  monthTitle: { fontFamily: FONT, fontSize: 20, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  summary: { fontFamily: FONT, fontSize: 13, fontWeight: '400', color: colors.muted, paddingHorizontal: spacing.base, marginBottom: spacing.base },

  /* Calendar */
  calendar: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: spacing.base, marginBottom: spacing.base,
  },
  dayLabel: {
    width: `${100 / 7}%`, textAlign: 'center',
    fontFamily: FONT, fontSize: 11, fontWeight: '600', color: colors.subtle,
    textTransform: 'uppercase', paddingVertical: spacing.xs,
  },
  dayCell: {
    width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4,
    minHeight: 40,
  },
  dayNum: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  dayNumToday: { backgroundColor: colors.primarySurface },
  dayNumSelected: { backgroundColor: colors.primary },
  dayNumText: { fontFamily: FONT, fontSize: 14, fontWeight: '500', color: colors.ink },
  dayNumTextToday: { color: colors.primary, fontWeight: '700' },
  dayNumTextSelected: { color: colors.inverse, fontWeight: '700' },
  dayDots: { flexDirection: 'row', gap: 3, marginTop: 2 },
  dayDot: { width: 4, height: 4, borderRadius: 2 },

  /* Swap */
  swapCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primarySurface, borderRadius: radii.lg,
    padding: spacing.base, marginHorizontal: spacing.base, marginBottom: spacing.base,
    gap: spacing.md, ...elevation.sm,
  },
  swapIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  swapInfo: { flex: 1 },
  swapTitle: { fontFamily: FONT, fontSize: 13, fontWeight: '700', color: colors.primary },
  swapDesc: { fontFamily: FONT, fontSize: 11, fontWeight: '400', color: colors.muted, marginTop: 1 },
  swapArrow: { fontFamily: FONT, fontSize: 16, fontWeight: '600', color: colors.primary },

  /* Day section */
  daySection: { paddingHorizontal: spacing.base },
  daySectionLabel: {
    fontFamily: FONT, fontSize: 12, fontWeight: '700', color: colors.subtle,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm,
  },

  /* Empty */
  emptyCard: {
    backgroundColor: colors.surface, borderRadius: radii.lg,
    padding: spacing.xl, alignItems: 'center',
    ...elevation.sm,
  },
  emptyTitle: { fontFamily: FONT, fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: spacing.xs },
  emptyCopy: { fontFamily: FONT, fontSize: 12, fontWeight: '400', color: colors.muted, textAlign: 'center' },

  /* Visit card */
  visitCard: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md, marginBottom: spacing.sm, gap: spacing.md,
    ...elevation.sm,
  },
  visitTimeCol: { width: 44, alignItems: 'center' },
  visitTime: { fontFamily: FONT, fontSize: 12, fontWeight: '700', color: colors.primary },
  visitTimeDash: { width: 1, height: 6, backgroundColor: colors.border, marginVertical: 2 },
  visitTimeEnd: { fontFamily: FONT, fontSize: 10, fontWeight: '400', color: colors.muted },
  visitInfo: { flex: 1 },
  visitLabel: { fontFamily: FONT, fontSize: 13, fontWeight: '600', color: colors.ink },
  visitPerson: { fontFamily: FONT, fontSize: 11, fontWeight: '400', color: colors.muted, marginTop: 2 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  visitAddr: { fontFamily: FONT, fontSize: 11, fontWeight: '400', color: colors.subtle, flex: 1 },
  navPill: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center',
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 4 },
})
