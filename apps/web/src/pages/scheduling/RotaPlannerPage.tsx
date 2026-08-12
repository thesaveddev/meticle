import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Box, Typography, Paper, Button, Stack, Chip, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Select, FormControl, InputLabel,
  FormControlLabel, Checkbox, LinearProgress, Skeleton,
  Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip,
  Card, CardContent, CircularProgress, ToggleButton, ToggleButtonGroup,
  Autocomplete,
} from '@mui/material'
import {
  ChevronLeft, ChevronRight, Add as AddIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  Warning as WarningIcon, CheckCircle as CheckIcon,
  ArrowBack as ArrowBackIcon,
  AutoAwesome as AutoAwesomeIcon,
  Today as TodayIcon,
  ViewWeek as ViewWeekIcon, ViewTimeline as ViewTimelineIcon, Group as GroupIcon,
} from '@mui/icons-material'
import { UserRole } from '@meticle/shared'
import api from '../../services/api'
import { fetchUserPermissions } from '../../utils/permissions'
import DayBoardView from './rota/DayBoardView'
import TimelineView from './rota/TimelineView'
import RosterView from './rota/RosterView'
import ShiftDetailDialog from './rota/ShiftDetailDialog'
import { rotaHelpers } from './rota/helpers'
import type { RotaViewMode } from './rota/types'

const { toLocalDateStr } = rotaHelpers

const toLocalISO = (dateStr: string, timeStr: string) => {
  const d = new Date(`${dateStr}T${timeStr}:00`)
  const offset = -d.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0')
  return `${dateStr}T${timeStr}:00${sign}${pad(Math.floor(offset / 60))}:${pad(offset % 60)}`
}

const localDateToISOStart = (date: Date) => {
  return toLocalISO(toLocalDateStr(date), '00:00')
}

const localDateToISOStartEncoded = (date: Date) => encodeURIComponent(localDateToISOStart(date))

function RotaSkeleton() {
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {[0, 1, 2].map(i => <Skeleton key={i} variant="rounded" width={220} height={34} />)}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto' }}>
        {Array.from({ length: 7 }).map((_, d) => (
          <Paper key={d} variant="outlined" sx={{ flex: '1 1 0', minWidth: 165, p: 1 }}>
            <Skeleton variant="text" width="45%" sx={{ mb: 1 }} />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={42} sx={{ mb: 1, bgcolor: '#F1F5F9' }} />
            ))}
          </Paper>
        ))}
      </Stack>
    </Box>
  )
}

export default function RotaPlannerPage() {
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const d = new Date(now.setDate(diff))
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [shifts, setShifts] = useState<any[]>([])
  const [staffList, setStaffList] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [minStaffCounts, setMinStaffCounts] = useState<any[]>([])
  const [people, setPeople] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const hasLoadedRef = useRef(false)
  const fetchDataRef = useRef<() => Promise<void>>(async () => {})

  const rawUser = useMemo(() => {
    const s = localStorage.getItem('user'); try { return s ? JSON.parse(s) : {} } catch { return {} }
  }, [])
  const canClaim = rawUser.role === UserRole.CARE_WORKER || rawUser.role === UserRole.MANAGER || rawUser.role === UserRole.ORG_ADMIN

  const [shiftDialog, setShiftDialog] = useState(false)
  const [shiftDialogError, setShiftDialogError] = useState('')
  const [shiftSaving, setShiftSaving] = useState(false)
  const [shiftForm, setShiftForm] = useState({ location_id: '', department_id: '', start_date: '', start_time: '09:00', end_time: '17:00', assigned_staff_ids: [] as string[], person_id: '', shift_type: 'day' })

  const [assignDialog, setAssignDialog] = useState(false)
  const [assignShiftId, setAssignShiftId] = useState('')
  const [assignStaffId, setAssignStaffId] = useState('')
  const [viewMode, setViewMode] = useState<RotaViewMode>('board')
  const [detailShift, setDetailShift] = useState<any>(null)
  const [pendingClaims, setPendingClaims] = useState<any[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [managedLocationIds, setManagedLocationIds] = useState<string[]>([])
  const [canEdit, setCanEdit] = useState(rawUser.role === UserRole.ORG_ADMIN || rawUser.role === UserRole.MANAGER)
  const isAdminOrManager = rawUser.role === UserRole.ORG_ADMIN || rawUser.role === UserRole.MANAGER

  const canEditLocation = useCallback((locationId: string) => {
    if (rawUser.role === 'ORG_ADMIN' || rawUser.role === 'SUPER_ADMIN') return true
    if (rawUser.role === 'MANAGER') return managedLocationIds.includes(locationId)
    return false
  }, [rawUser.role, managedLocationIds])

  const isReadOnly = useMemo(() => {
    if (!selectedLocationId) return false
    return !canEditLocation(selectedLocationId)
  }, [selectedLocationId, managedLocationIds])

  const [swapDialog, setSwapDialog] = useState(false)
  const [swapDialogStep, setSwapDialogStep] = useState(1)
  const [swapShiftId, setSwapShiftId] = useState('')
  const [swapToStaffId, setSwapToStaffId] = useState('')
  const [swapToShiftId, setSwapToShiftId] = useState('')
  const [swapReason, setSwapReason] = useState('')
  const [eligibleSwapStaff, setEligibleSwapStaff] = useState<any[]>([])
  const [targetStaffShifts, setTargetStaffShifts] = useState<any[]>([])
  const [targetStaffName, setTargetStaffName] = useState('')
  const [swapLoading, setSwapLoading] = useState(false)
  const [swapRequests, setSwapRequests] = useState<any[]>([])
  const [swapRangeEnd, setSwapRangeEnd] = useState<Date | null>(null)
  const [swapShiftDate, setSwapShiftDate] = useState<Date | null>(null)

  // AI Analysis
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const runAiAnalysis = async () => {
    setAiLoading(true)
    setAiError('')
    setAiAnalysis(null)
    setAiDialogOpen(true)
    try {
      const activeLoc = locations.find(l => l.id === selectedLocationId)
      const weekRange = `${weekDates[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${weekDates[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

      const staffRoster = staffList.map((s: any) =>
        `${s.first_name} ${s.last_name} (${s.role}) - Home: ${s.location_name || 'No location'} - Contracted:${s.contracted_hours_weekly || 0}h/wk${s.max_hours_weekly ? ` VisaMax:${s.max_hours_weekly}h/wk` : ''} - Compliance:${s.compliance_pct ?? 100}%`
      ).join('\n')

      const shiftsSummary = shifts.filter((s: any) => !selectedLocationId || s.location_id === selectedLocationId).map((s: any) => {
        const start = new Date(s.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
        const time = `${new Date(s.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}-${new Date(s.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
        const assignments = (s.assignments || []).map((a: any) => `${a.first_name} ${a.last_name?.[0] || ''}`).join(', ') || 'UNASSIGNED'
        return `${start} ${s.shift_type || 'day'} ${time} @ ${s.location_name || ''} — Staff: ${assignments}${s.agency_id ? ' [AGENCY]' : ''}`
      }).join('\n')

      const openShiftsList = shifts.filter((s: any) => (s.assignments || []).length === 0).map((s: any) => {
        const start = new Date(s.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
        const time = `${new Date(s.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}-${new Date(s.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
        return `${start} ${s.shift_type || 'day'} ${time} @ ${s.location_name || ''}`
      }).join('\n')

      const staffCompliance = staffList.map((s: any) =>
        `${s.first_name} ${s.last_name}: ${s.compliance_pct ?? 100}%`
      ).join('\n')

      const overtimeHours = shifts.flatMap((s: any) =>
        (s.assignments || []).filter((a: any) => a.is_overtime).map((a: any) =>
          `${a.first_name} ${a.last_name?.[0] || ''} — ${new Date(s.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`
        )
      ).join('\n') || 'None'

      const locName = activeLoc?.name || selectedLocationId || 'All locations'
      const minStaff = getMinStaffForLocation(selectedLocationId || '')
      const minDay = getShiftTypeMin(selectedLocationId || '', 'day')
      const minNight = getShiftTypeMin(selectedLocationId || '', 'wake_night')
      const minSleep = getShiftTypeMin(selectedLocationId || '', 'sleep')

      const res = await api.post('/ai/analyze/rota', {
        weekRange,
        locationName: locName,
        locationId: selectedLocationId,
        minStaffPerDay: minStaff,
        minDayStaff: minDay,
        minNightStaff: minNight,
        minSleepStaff: minSleep,
        staffRoster,
        shifts: shiftsSummary,
        openShifts: openShiftsList || 'No open shifts',
        staffCompliance,
        overtimeHours: overtimeHours || 'None',
      })
      setAiAnalysis(res.data.analysis)
      setAiError('')
    } catch (err: any) {
      setAiError(err.response?.data?.error?.message || err.message || 'Failed to analyze rota')
    } finally {
      setAiLoading(false)
    }
  }

  // AI Rota Generation
  const [genDialogOpen, setGenDialogOpen] = useState(false)
  const [genPeriod, setGenPeriod] = useState('week')
  const [genResult, setGenResult] = useState<any>(null)
  const [editableGenShifts, setEditableGenShifts] = useState<any[]>([])
  const [genEditMode, setGenEditMode] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [genError, setGenError] = useState('')
  const [genApplying, setGenApplying] = useState(false)
  const [genMandatoryStartTimes, setGenMandatoryStartTimes] = useState<string[]>(['07:00', '10:00', '14:00', '21:00'])
  const [genAllSameStart, setGenAllSameStart] = useState(false)
  const [genAllSameEnd, setGenAllSameEnd] = useState(false)
  const [genMinEndTime, setGenMinEndTime] = useState('22:00')

  const runGenerateRota = async () => {
    setGenLoading(true)
    setGenError('')
    setGenResult(null)
    try {
      const activeLoc = locations.find(l => l.id === selectedLocationId)
      const locName = activeLoc?.name || 'All locations'

      // Calculate period
      const now = new Date()
      let periodEnd = new Date(now)
      if (genPeriod === 'week') periodEnd.setDate(periodEnd.getDate() + 7)
      else if (genPeriod === '2weeks') periodEnd.setDate(periodEnd.getDate() + 14)
      else if (genPeriod === 'month') periodEnd.setMonth(periodEnd.getMonth() + 1)
      const periodStr = `${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} to ${periodEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

      const staffRoster = staffList.map((s: any) =>
        `ID:${s.staff_id} ${s.first_name} ${s.last_name} (${s.role}) - Home: ${s.location_name || 'No location'} - Contracted:${s.contracted_hours_weekly || 0}h/wk${s.max_hours_weekly ? ` VisaMax:${s.max_hours_weekly}h/wk` : ''} - Compliance:${s.compliance_pct ?? 100}%`
      ).join('\n')

      const existingShifts = shifts.map((s: any) => {
        const start = new Date(s.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
        const time = `${new Date(s.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}-${new Date(s.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
        return `${start} ${s.shift_type || 'day'} ${time} @${s.location_name} - ${(s.assignments||[]).map((a:any)=>`${a.first_name} ${a.last_name?.[0]||''}`).join(',')||'open'}`
      }).join('\n') || 'No existing shifts'

      // Staff on leave — need to fetch from data
      // We don't have leave data directly in shifts, use staffList to generate availability hints
      const contractedHours = staffList.map((s: any) =>
        `${s.first_name} ${s.last_name}: ${s.contracted_hours_weekly || 0}h/week${s.max_hours_weekly ? ` (visa cap: ${s.max_hours_weekly}h/wk)` : ''}`
      ).join('\n')

      const suList = people.map((su: any) =>
        `${su.first_name} ${su.last_name}${su.location_id ? ` @ ${locations.find(l=>l.id===su.location_id)?.name||''}` : ''} - Support: ${su.support_level || 'not set'}${su.min_staff_required ? ` (min ${su.min_staff_required} staff)` : ''}`
      ).join('\n') || 'None'

      const staffingNeeds = locations.map(l =>
        `${l.name}: ${getCareStaffingNeeds(l.id)} staff required from person care needs (incl. ${people.filter((su: any) => su.location_id === l.id).length} people)`
      ).join('\n') || 'No care needs data'

      const minDay = getShiftTypeMin(selectedLocationId || '', 'day')
      const minNight = getShiftTypeMin(selectedLocationId || '', 'wake_night')
      const minSleep = getShiftTypeMin(selectedLocationId || '', 'sleep')

      const mandatoryStartTimesStr = genAllSameStart && genMandatoryStartTimes.length > 0
        ? `All ${genMandatoryStartTimes[0]}`
        : genMandatoryStartTimes.filter(Boolean).join(', ')
      const minEndTimeStr = genMinEndTime || '22:00'

      const res = await api.post('/ai/generate/rota', {
        generatePeriod: periodStr,
        locationName: locName,
        minStaffPerDay: String(getMinStaffForLocation(selectedLocationId || '') || 1),
        minDayStaff: String(minDay),
        minNightStaff: String(minNight),
        minSleepStaff: String(minSleep),
        staffRoster,
        existingShifts,
        staffOnLeave: 'Not available — assume all staff available unless already assigned',
        people: suList,
        staffingNeeds,
        contractedHours,
        mandatoryStartTimes: mandatoryStartTimesStr,
        minEndTime: minEndTimeStr,
        allSameEnd: genAllSameEnd ? 'true' : 'false',
      })
      const rota = res.data.rota
      setGenResult(rota)
      setEditableGenShifts((rota.shifts || []).map((s: any) => ({ ...s, date: s.date?.substring(0, 10) || '', start_time: s.start_time, end_time: s.end_time, location_id: s.location_id, location_name: s.location_name, assigned_staff: s.assigned_staff || [], assigned_staff_names: s.assigned_staff_names || [] })))
      setGenEditMode(false)
    } catch (err: any) {
      setGenError(err.response?.data?.error?.message || err.message || 'Failed to generate rota')
    } finally {
      setGenLoading(false)
    }
  }

  const applyGeneratedRota = async () => {
    if (!editableGenShifts?.length) return
    setGenApplying(true)
    setGenError('')
    let created = 0
    let failed = 0
    for (const shift of editableGenShifts) {
      try {
        // Map location name → ID
        const loc = locations.find((l: any) => l.name === shift.location_name)
        if (!loc) { failed++; continue }

        // Use staff IDs if available (from editable Autocomplete), else map names
        const assignedIds = (shift.assigned_staff || []).length
          ? shift.assigned_staff
          : (shift.assigned_staff_names || []).map((name: string) => {
              const parts = name.split(' ')
              const matched = staffList.find((s: any) =>
                s.first_name?.toLowerCase() === parts[0]?.toLowerCase() &&
                s.last_name?.toLowerCase() === parts.slice(1).join(' ')?.toLowerCase()
              )
              return matched?.staff_id
            }).filter(Boolean)

        const startISO = toLocalISO(shift.date, shift.start_time)
        const endDate = shift.end_time <= shift.start_time
          ? toLocalDateStr(new Date(new Date(shift.date).getTime() + 86400000))
          : shift.date
        const endISO = toLocalISO(endDate, shift.end_time)

        await api.post('/shifts', {
          location_id: loc.id,
          start_time: startISO,
          end_time: endISO,
          shift_type: shift.shift_type || 'day',
          assigned_staff_ids: assignedIds,
        })
        created++
      } catch {
        failed++
      }
    }
    setGenApplying(false)
    if (failed > 0) {
      setError(`Created ${created} shifts, ${failed} failed`)
    } else {
      setSuccess(`Successfully created ${created} shifts from AI rota`)
    }
    setGenDialogOpen(false)
    setGenResult(null)
    fetchData()
  }

  const openSwapDialog = useCallback(async (shiftId: string, shiftDate?: string) => {
    setSwapShiftId(shiftId)
    setSwapToStaffId('')
    setSwapToShiftId('')
    setSwapReason('')
    setSwapDialogStep(1)
    setTargetStaffShifts([])
    setTargetStaffName('')
    const shiftDt = shiftDate ? new Date(shiftDate) : new Date()
    setSwapShiftDate(shiftDt)
    try {
      const staffRes = await api.get(`/shifts/${shiftId}/eligible-swap-staff`)
      setEligibleSwapStaff(staffRes.data)
    } catch {
      setEligibleSwapStaff([])
    }
    try {
      const lastDateRes = await api.get(`/shifts/last-date`)
      if (lastDateRes.data?.lastDate) {
        const lastDt = new Date(lastDateRes.data.lastDate)
        const maxRange = new Date(shiftDt)
        maxRange.setDate(maxRange.getDate() + 30)
        setSwapRangeEnd(lastDt < maxRange ? lastDt : maxRange)
      } else {
        const defaultEnd = new Date(shiftDt)
        defaultEnd.setDate(defaultEnd.getDate() + 7)
        setSwapRangeEnd(defaultEnd)
      }
    } catch {
      const defaultEnd = new Date(shiftDt)
      defaultEnd.setDate(defaultEnd.getDate() + 7)
      setSwapRangeEnd(defaultEnd)
    }
    setSwapDialog(true)
  }, [])

  const handleSwapSelectStaff = async (staffId: string) => {
    setSwapToStaffId(staffId)
    setSwapToShiftId('')
    setSwapLoading(true)
    const selected = eligibleSwapStaff.find(s => s.staff_id === staffId)
    setTargetStaffName(selected ? `${selected.first_name} ${selected.last_name}` : '')
    try {
      const rangeEnd = swapRangeEnd || new Date()
      const endStr = `${rangeEnd.getFullYear()}-${String(rangeEnd.getMonth() + 1).padStart(2, '0')}-${String(rangeEnd.getDate()).padStart(2, '0')}T23:59:59`
      const res = await api.get(`/shifts/staff/${staffId}/shifts?startDate=${localDateToISOStartEncoded(weekStart)}&endDate=${encodeURIComponent(endStr)}`)
      setTargetStaffShifts(res.data || [])
    } catch { setTargetStaffShifts([]) }
    setSwapLoading(false)
    setSwapDialogStep(2)
  }

  const handleRequestSwap = async () => {
    setSwapLoading(true)
    try {
      await api.post(`/shifts/${swapShiftId}/swap-request`, {
        toStaffId: swapToStaffId,
        toShiftId: swapToShiftId?.startsWith('__transfer__') ? undefined : swapToShiftId || undefined,
        reason: swapReason || undefined,
      })
      setSuccess('Swap request sent')
      setSwapDialog(false)
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send swap request')
    } finally { setSwapLoading(false) }
  }

  const [staffingDialog, setStaffingDialog] = useState(false)
  const [staffingRules, setStaffingRules] = useState<any[]>([])

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    return d
  }, [weekStart])

  const weekDates = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    }), [weekStart])

  // ---- Precomputed indices (parsed once per fetch, O(1) grid lookups) ----
  const normalizedShifts = useMemo(() =>
    shifts.map((s: any) => {
      const st = new Date(s.start_time)
      const et = new Date(s.end_time)
      return {
        ...s,
        _startDate: toLocalDateStr(st),
        _endDate: toLocalDateStr(et),
        _startHour: st.getHours(),
        _endHour: et.getHours(),
        _startLabel: st.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        _endLabel: et.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      }
    }), [shifts])

  const careNeedsByLoc = useMemo(() => {
    const m = new Map<string, number>()
    for (const su of people) {
      if (su.status !== 'active' || !su.location_id) continue
      let add = 0
      if (su.support_level === 'one_to_one') add = 1
      else if (su.support_level === 'two_to_one') add = 2
      else if (su.support_level === 'three_to_one') add = 3
      else if (su.support_level === 'complex') add = Number(su.min_staff_required) || 1
      if (add > 0) m.set(su.location_id, (m.get(su.location_id) || 0) + add)
    }
    return m
  }, [people])

  const minStaffById = useMemo(() => {
    const m = new Map<string, number>()
    for (const x of minStaffCounts) m.set(x.location_id, x.minimum_staff_per_day ?? 1)
    return m
  }, [minStaffCounts])

  const shiftTypeMinById = useMemo(() => {
    const m = new Map<string, { day: number; night: number; sleep: number }>()
    for (const x of minStaffCounts) m.set(x.location_id, { day: x.min_day_staff ?? 1, night: x.min_night_staff ?? 1, sleep: x.min_sleep_staff ?? 0 })
    return m
  }, [minStaffCounts])

  const assignedStaffIdsByDate = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const s of normalizedShifts) {
      let set = m.get(s._startDate)
      if (!set) { set = new Set(); m.set(s._startDate, set) }
      for (const a of s.assignments || []) set.add(a.staff_id)
    }
    return m
  }, [normalizedShifts])

  const staffCountByDayLoc = useMemo(() => {
    const m = new Map<string, Map<string, Set<string>>>()
    const touch = (d: string, locId: string, staffId: string) => {
      let lm = m.get(d)
      if (!lm) { lm = new Map(); m.set(d, lm) }
      let set = lm.get(locId)
      if (!set) { set = new Set(); lm.set(locId, set) }
      set.add(staffId)
    }
    for (const s of normalizedShifts) {
      for (const a of s.assignments || []) {
        touch(s._startDate, s.location_id, a.staff_id)
        if (s._endDate !== s._startDate) touch(s._endDate, s.location_id, a.staff_id)
      }
    }
    const counts = new Map<string, Map<string, number>>()
    for (const [d, lm] of m) {
      const cm = new Map<string, number>()
      for (const [loc, set] of lm) cm.set(loc, set.size)
      counts.set(d, cm)
    }
    return counts
  }, [normalizedShifts])

  const viewShifts = useMemo(() =>
    selectedLocationId
      ? normalizedShifts.filter(s => s.location_id === selectedLocationId)
      : normalizedShifts,
  [normalizedShifts, selectedLocationId])

  const weekDayStats = useMemo(() =>
    weekDates.map(d => {
      const dateStr = toLocalDateStr(d)
      const locCounts = staffCountByDayLoc.get(dateStr)
      return locations.map(loc => {
        const cnt = locCounts?.get(loc.id) ?? 0
        const min = minStaffById.get(loc.id) ?? 1
        const care = careNeedsByLoc.get(loc.id) ?? 0
        const need = Math.max(min, care)
        return { loc, cnt, min, care, need, ok: cnt >= need }
      })
    }), [weekDates, locations, staffCountByDayLoc, minStaffById, careNeedsByLoc])

  const fetchData = async () => {
    if (!hasLoadedRef.current) setLoading(true)
    else setRefreshing(true)
    try {
      const safeGet = async (url: string, fallback: any = null) => {
        try { return (await api.get(url)).data } catch { return fallback }
      }
      // Cache static data — only fetch on initial load
      const staticDataNeeded = staffList.length === 0 || locations.length === 0

      if (staticDataNeeded) {
        const [staffData, locData, minStaffData, suData] = await Promise.all([
          safeGet('/shifts/staff', []),
          safeGet('/leave/locations', []),
          safeGet('/shifts/min-staff', []),
          safeGet('/people?status=active', []),
        ])
        if (staffData.length) setStaffList(staffData)
        if (locData.length) setLocations(locData)
        if (minStaffData) setMinStaffCounts(minStaffData)
        if (suData) setPeople(suData)
      }

      // Always refresh shifts + pending claims
      const [shiftsData, pendingData] = await Promise.all([
        safeGet(`/shifts?startDate=${localDateToISOStartEncoded(weekStart)}&endDate=${localDateToISOStartEncoded(weekEnd)}`, []),
        isAdminOrManager ? safeGet('/shifts/pending-claims', []) : Promise.resolve(null),
      ])
      if (shiftsData) setShifts(shiftsData)
      if (pendingData) setPendingClaims(pendingData)

      // Location logic — use state variables (populated on first load)
      const locData = locations
      const staffData = staffList
      const myStaffProfile = (staffData || []).find((s: any) => s.user_id === rawUser.id)
      const myLocationId = myStaffProfile?.location_id || rawUser.location_id || ''

      if (rawUser.role === 'MANAGER') {
        let managedLocIds: string[] = []
        if (myStaffProfile?.location_id) managedLocIds.push(myStaffProfile.location_id)
        const managedLocs = (locData || []).filter((l: any) => l.manager_id === rawUser.id)
        for (const l of managedLocs) { if (!managedLocIds.includes(l.id)) managedLocIds.push(l.id) }
        if (managedLocIds.length === 0 && rawUser.location_id) managedLocIds.push(rawUser.location_id)
        setManagedLocationIds(managedLocIds)
        if (!selectedLocationId && managedLocIds.length > 0) setSelectedLocationId(managedLocIds[0])
        else if (!selectedLocationId && rawUser.location_id) setSelectedLocationId(rawUser.location_id)
        else if (!selectedLocationId && locData?.length > 0) setSelectedLocationId(locData[0].id)
      } else if (rawUser.role === 'ORG_ADMIN' || rawUser.role === 'SUPER_ADMIN') {
        setManagedLocationIds((locData || []).map((l: any) => l.id))
        if (!selectedLocationId && myLocationId) setSelectedLocationId(myLocationId)
        else if (!selectedLocationId && locData?.length > 0) setSelectedLocationId(locData[0].id)
      } else {
        if (!selectedLocationId && myLocationId) setSelectedLocationId(myLocationId)
        else if (!selectedLocationId && locData?.length > 0) setSelectedLocationId(locData[0].id)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load data')
    } finally {
      hasLoadedRef.current = true
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchData() }, [weekStart])
  useEffect(() => { fetchDataRef.current = fetchData })

  useEffect(() => {
    if (rawUser.id) {
      fetchUserPermissions(rawUser.id).then(data => {
        const schedulingPerm = data.permissions.find((p: any) => p.module === 'scheduling')
        if (schedulingPerm) setCanEdit(schedulingPerm.permission_level === 'edit')
      }).catch(() => {})
    }
  }, [rawUser.id])

  const getAssignedStaffIdsForDate = (dateStr: string) => assignedStaffIdsByDate.get(dateStr) ?? new Set<string>()

  const getCareStaffingNeeds = (locationId: string) => careNeedsByLoc.get(locationId) ?? 0

  const currentStaffId = useMemo(() => {
    const entry = staffList.find((s: any) => s.user_id === rawUser.id)
    return entry?.staff_id || null
  }, [staffList, rawUser.id])

  useEffect(() => {
    if (!currentStaffId) return
    api.get('/shifts/swap-requests/my')
      .then(res => setSwapRequests((res.data || []).filter((r: any) => r.status === 'pending' && r.to_staff_id === currentStaffId)))
      .catch(() => setSwapRequests([]))
  }, [currentStaffId])

  const handleSwapResponse = async (swapId: string, accepted: boolean) => {
    try {
      await api.patch(`/shifts/swap-response/${swapId}`, { accepted })
      setSuccess(accepted ? 'Swap accepted' : 'Swap declined')
      setSwapRequests(prev => prev.filter(r => r.id !== swapId))
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to respond to swap request')
    }
  }

  const handleCreateShift = async () => {
    setShiftDialogError('')
    setShiftSaving(true)
    try {
      const startDateTime = toLocalISO(shiftForm.start_date, shiftForm.start_time)
      // If end_time <= start_time, shift crosses midnight — use next day for end date
      const endDate = shiftForm.end_time <= shiftForm.start_time
        ? toLocalDateStr(new Date(new Date(shiftForm.start_date).getTime() + 86400000))
        : shiftForm.start_date
      const endDateTime = toLocalISO(endDate, shiftForm.end_time)
      await api.post('/shifts', {
        location_id: shiftForm.location_id,
        department_id: shiftForm.department_id || undefined,
        start_time: startDateTime,
        end_time: endDateTime,
        assigned_staff_ids: shiftForm.assigned_staff_ids,
        person_id: shiftForm.person_id || undefined,
        shift_type: shiftForm.shift_type,
      })
      setShiftDialog(false)
      setShiftForm({ location_id: '', department_id: '', start_date: '', start_time: '09:00', end_time: '17:00', assigned_staff_ids: [], person_id: '', shift_type: 'day' })
      setSuccess(shiftForm.assigned_staff_ids.length > 0 ? 'Shift created and staff assigned' : 'Open shift created')
      fetchData()
    } catch (err: any) {
      setShiftDialogError(err.response?.data?.message || 'Failed to create shift')
    } finally {
      setShiftSaving(false)
    }
  }

  const handleDeleteShift = useCallback(async (id: string) => {
    try {
      await api.delete(`/shifts/${id}`)
      setShifts(prev => prev.filter(s => s.id !== id))
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete shift')
    }
  }, [])

  const handleAssign = async () => {
    try {
      await api.post(`/shifts/${assignShiftId}/assign`, { staffId: assignStaffId })
      setAssignDialog(false)
      setAssignStaffId('')
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to assign staff')
    }
  }

  const handleUnassign = useCallback(async (shiftId: string, staffId: string) => {
    try {
      await api.delete(`/shifts/${shiftId}/assign/${staffId}`)
      fetchDataRef.current()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to unassign staff')
    }
  }, [])

  const handleToggleCoverage = useCallback(async (shiftId: string, currentlyCovered: boolean) => {
    try {
      await api.patch(`/shifts/${shiftId}/agency-coverage`, { covered: !currentlyCovered })
      fetchDataRef.current()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update coverage')
    }
  }, [])

  const handleClaimShift = useCallback(async (shiftId: string) => {
    setError('')
    setSuccess('')
    try {
      const res = await api.post(`/shifts/${shiftId}/claim`)
      if (res.data.auto_approved) {
        setSuccess('Shift claimed as overtime (auto-approved — you manage this location)')
      } else if (res.data.requires_approval) {
        setSuccess('Shift claimed — pending manager approval')
      } else {
        setSuccess('Shift claimed as overtime')
      }
      fetchDataRef.current()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to claim shift')
    }
  }, [])

  const handleApproveClaim = async (shiftId: string, staffId: string) => {
    setError('')
    setSuccess('')
    try {
      await api.patch(`/shifts/${shiftId}/approve-claim/${staffId}`)
      setSuccess('Overtime claim approved')
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve claim')
    }
  }

  const handleRejectClaim = async (shiftId: string, staffId: string) => {
    setError('')
    setSuccess('')
    try {
      await api.patch(`/shifts/${shiftId}/reject-claim/${staffId}`)
      setSuccess('Overtime claim rejected')
      fetchData()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reject claim')
    }
  }

  const openShiftDialog = useCallback((date?: Date) => {
    const d = date || new Date()
    const defaultLocId = selectedLocationId && canEditLocation(selectedLocationId)
      ? selectedLocationId
      : (rawUser.role === 'MANAGER' && managedLocationIds.length > 0
        ? managedLocationIds[0]
        : locations[0]?.id || '')
    setShiftForm({
      location_id: defaultLocId,
      department_id: '',
      start_date: toLocalDateStr(d),
      start_time: '09:00',
      end_time: '17:00',
      assigned_staff_ids: [],
      person_id: '',
      shift_type: 'day',
    })
    setShiftDialogError('')
    setShiftDialog(true)
  }, [selectedLocationId, rawUser.role, managedLocationIds, locations, canEditLocation])

  const openShiftDialogAt = useCallback((date: Date, hour: number) => {
    setShiftForm(p => ({ ...p, location_id: locations[0]?.id || '', start_date: toLocalDateStr(date), start_time: `${hour.toString().padStart(2, '0')}:00` }))
    setShiftDialog(true)
  }, [locations])

  const openAssignDialog = useCallback((shiftId: string) => {
    setAssignShiftId(shiftId)
    setAssignStaffId('')
    setAssignDialog(true)
  }, [])

  const getMinStaffForLocation = (locationId: string) => minStaffById.get(locationId) ?? 1

  const getShiftTypeMin = (locationId: string, shiftType: string) => {
    const m = shiftTypeMinById.get(locationId)
    if (!m) return shiftType === 'sleep' ? 0 : 1
    if (shiftType === 'sleep') return m.sleep
    if (shiftType === 'wake_night') return m.night
    return m.day
  }

  const openStaffingDialog = () => {
    setStaffingRules(locations.map(l => ({
      id: l.id, name: l.name,
      minimum_staff_per_day: l.minimum_staff_per_day ?? 1,
      min_day_staff: l.min_day_staff ?? 1,
      min_night_staff: l.min_night_staff ?? 1,
      min_sleep_staff: l.min_sleep_staff ?? 0,
    })))
    setStaffingDialog(true)
  }

  const saveStaffingRules = async () => {
    try {
      for (const rule of staffingRules) {
        await api.put(`/settings/locations/${rule.id}`, {
          minimum_staff_per_day: rule.minimum_staff_per_day,
          min_day_staff: rule.min_day_staff,
          min_night_staff: rule.min_night_staff,
          min_sleep_staff: rule.min_sleep_staff,
        })
      }
      const res = await api.get('/settings/locations')
      setLocations(res.data)
      setStaffingDialog(false)
      setSuccess('Staffing rules updated')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save staffing rules')
    }
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ScheduleIcon sx={{ color: '#0F4C81', fontSize: 28 }} />
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Rota Planner</Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          {!isReadOnly && (rawUser.role === 'ORG_ADMIN' || rawUser.role === 'SUPER_ADMIN' || managedLocationIds.length > 0) && <Button variant="outlined" startIcon={<AddIcon />} onClick={() => openShiftDialog()}>Add Shift</Button>}
          {isAdminOrManager && <Button variant="outlined" color="info" onClick={() => window.location.href = '/scheduling/overtime-claims'}>Overtime Claims</Button>}
          {!isReadOnly && canEdit && <Button variant="outlined" color="secondary" onClick={openStaffingDialog}>Staffing Rules</Button>}
          <Button variant="outlined" startIcon={<AutoAwesomeIcon />} onClick={runAiAnalysis} sx={{ borderColor: '#A855F7', color: '#A855F7', '&:hover': { borderColor: '#9333EA', bgcolor: '#F5F3FF' } }}>
            {aiLoading ? <CircularProgress size={16} sx={{ color: '#A855F7', mr: 0.5 }} /> : null}
            AI Analyze
          </Button>
          {isAdminOrManager && (
            <Button variant="contained" startIcon={<AutoAwesomeIcon />} onClick={() => { setGenResult(null); setGenError(''); setGenPeriod('week'); setGenDialogOpen(true) }}
              sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}>
              Generate Rota
            </Button>
          )}
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Paper sx={{ mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 3, py: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d) }}>
              <ChevronLeft />
            </IconButton>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {weekDates[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - {weekDates[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Typography>
            <IconButton onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d) }}>
              <ChevronRight />
            </IconButton>
            <Tooltip title="Jump to this week">
              <IconButton size="small" onClick={() => {
                const now = new Date()
                const day = now.getDay()
                const diff = now.getDate() - day + (day === 0 ? -6 : 1)
                const d = new Date(now)
                d.setDate(diff)
                d.setHours(0, 0, 0, 0)
                setWeekStart(d)
              }}>
                <TodayIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Stack>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select value={selectedLocationId} onChange={e => setSelectedLocationId(e.target.value)}
              displayEmpty>
              <MenuItem value="">{rawUser.role === 'MANAGER' ? 'My Location(s)' : 'All Locations'}</MenuItem>
              {locations.filter((l: any) => rawUser.role !== 'MANAGER' || managedLocationIds.includes(l.id) || true).map((l: any) => (
                <MenuItem key={l.id} value={l.id}>
                  {l.name}{rawUser.role === 'MANAGER' && !managedLocationIds.includes(l.id) ? ' (read-only)' : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {isReadOnly && rawUser.role === 'MANAGER' && (
            <Chip label="Read-only" size="small" variant="outlined" sx={{ borderColor: '#D97706', color: '#D97706' }} />
          )}
        </Stack>
      </Paper>

      {loading ? (
        <RotaSkeleton />
      ) : (
        <>
          {refreshing && (
            <LinearProgress sx={{ mb: 2, height: 3, borderRadius: 2, bgcolor: '#DBEAFE', '& .MuiLinearProgress-bar': { bgcolor: '#0F4C81' } }} />
          )}

          {/* Staffing level summary row */}
          {locations.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                {locations.map(loc => {
                  const stats = weekDayStats.map(d => d.find(x => x.loc.id === loc.id)!)
                  const required = stats[0]?.need ?? 1
                  const allAbove = stats.every(x => x.ok)
                  const shortDays = stats.filter(x => !x.ok).length
                  return (
                    <Chip key={loc.id} size="small" icon={allAbove ? <CheckIcon /> : <WarningIcon />}
                      label={allAbove
                        ? `${loc.name}: Covered (need ${required}/day${stats[0]?.care > stats[0]?.min ? ` incl. ${stats[0]?.care} care-needs` : ''})`
                        : `${loc.name}: ${shortDays} day${shortDays > 1 ? 's' : ''} short (need ${required}/day${stats[0]?.care > stats[0]?.min ? ` incl. ${stats[0]?.care} care-needs` : ''})`}
                      color={allAbove ? 'success' : 'warning'} variant="outlined" />
                  )
                })}
              </Stack>
            </Box>
          )}

          {isAdminOrManager && pendingClaims.length > 0 && (
            <Paper sx={{ mb: 2, p: 2, border: '1px solid #FDE68A', bgcolor: '#FFFBEB' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#92400E' }}>
                Pending Overtime Claims ({pendingClaims.length})
              </Typography>
              <Stack spacing={1}>
                {pendingClaims.map((pc: any) => (
                  <Stack key={pc.assignment_id} direction="row" justifyContent="space-between" alignItems="center"
                    sx={{ bgcolor: 'white', p: 1, borderRadius: 1, border: '1px solid #FDE68A' }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{pc.first_name} {pc.last_name}</Typography>
                      <Typography variant="caption" color="#6B7280">— {pc.location_name}</Typography>
                      <Typography variant="caption" color="#6B7280">
                        {new Date(pc.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' '}{new Date(pc.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        {' — '}{new Date(pc.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                      <Chip label="Pending" size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#FEF3C7', color: '#92400E' }} />
                    </Stack>
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" variant="contained" color="success"
                        sx={{ minWidth: 0, py: 0, px: 1, fontSize: '0.7rem', fontWeight: 700, textTransform: 'none' }}
                        onClick={() => handleApproveClaim(pc.shift_id, pc.staff_id)}>
                        Approve
                      </Button>
                      <Button size="small" variant="outlined" color="error"
                        sx={{ minWidth: 0, py: 0, px: 1, fontSize: '0.7rem', fontWeight: 700, textTransform: 'none' }}
                        onClick={() => handleRejectClaim(pc.shift_id, pc.staff_id)}>
                        Reject
                      </Button>
                    </Stack>
                  </Stack>
                ))}
              </Stack>
              <Button size="small" variant="text" sx={{ mt: 1, fontSize: '0.75rem', color: '#0F4C81', textTransform: 'none' }}
                onClick={() => window.location.href = '/scheduling/overtime-claims'}>
                View All Claims →
              </Button>
            </Paper>
          )}

          {swapRequests.length > 0 && (
            <Paper sx={{ mb: 2, p: 2, border: '1px solid #E0E7FF', bgcolor: '#EEF2FF' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#3730A3' }}>
                Pending Swap Requests ({swapRequests.length})
              </Typography>
              <Stack spacing={1}>
                {swapRequests.map((sr: any) => (
                  <Stack key={sr.id} direction="row" justifyContent="space-between" alignItems="center"
                    sx={{ bgcolor: 'white', p: 1, borderRadius: 1, border: '1px solid #E0E7FF' }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{sr.from_first_name} {sr.from_last_name}</Typography>
                      <Typography variant="caption" color="#6B7280">
                        wants to swap {new Date(sr.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' '}{new Date(sr.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        {' — '}{new Date(sr.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                      <Chip label={sr.location_name} size="small" sx={{ height: 18, fontSize: '0.6rem' }} />
                      {sr.reason && <Typography variant="caption" color="#6B7280" sx={{ fontStyle: 'italic' }}>"{sr.reason}"</Typography>}
                    </Stack>
                    <Stack direction="row" spacing={0.5}>
                      <Button size="small" variant="contained" color="success"
                        sx={{ minWidth: 0, py: 0, px: 1.5, fontSize: '0.7rem', fontWeight: 700, textTransform: 'none' }}
                        onClick={() => handleSwapResponse(sr.id, true)}>
                        Accept
                      </Button>
                      <Button size="small" variant="outlined" color="error"
                        sx={{ minWidth: 0, py: 0, px: 1.5, fontSize: '0.7rem', fontWeight: 700, textTransform: 'none' }}
                        onClick={() => handleSwapResponse(sr.id, false)}>
                        Decline
                      </Button>
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          )}

          {/* View switcher */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <ToggleButtonGroup
              size="small"
              value={viewMode}
              exclusive
              onChange={(_, v) => { if (v) setViewMode(v) }}
              sx={{ '& .MuiToggleButton-root': { px: 1.25, py: 0.5, fontSize: '0.72rem', fontWeight: 700, textTransform: 'none' } }}
            >
              <ToggleButton value="board" sx={{ '&.Mui-selected': { bgcolor: '#0F4C81', color: '#fff' } }}>
                <ViewWeekIcon sx={{ fontSize: 15, mr: 0.5 }} />Board
              </ToggleButton>
              <ToggleButton value="timeline" sx={{ '&.Mui-selected': { bgcolor: '#0F4C81', color: '#fff' } }}>
                <ViewTimelineIcon sx={{ fontSize: 15, mr: 0.5 }} />Timeline
              </ToggleButton>
              <ToggleButton value="roster" sx={{ '&.Mui-selected': { bgcolor: '#0F4C81', color: '#fff' } }}>
                <GroupIcon sx={{ fontSize: 15, mr: 0.5 }} />Roster
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          {viewMode === 'board' && (
            <DayBoardView
              weekDates={weekDates}
              shifts={viewShifts}
              staffList={staffList}
              locations={locations}
              weekDayStats={weekDayStats}
              selectedLocationId={selectedLocationId}
              canEdit={canEdit}
              isReadOnly={isReadOnly}
              canClaim={canClaim}
              currentStaffId={currentStaffId}
              canEditLocation={canEditLocation}
              assignedStaffIdsByDate={assignedStaffIdsByDate}
              onOpenShiftDialog={openShiftDialog}
              onOpenShiftDialogAt={openShiftDialogAt}
              onAssign={openAssignDialog}
              onDeleteShift={handleDeleteShift}
              onToggleCoverage={handleToggleCoverage}
              onClaimShift={handleClaimShift}
              onUnassign={handleUnassign}
              onSwap={openSwapDialog}
              onOpenDetail={setDetailShift}
            />
          )}
          {viewMode === 'timeline' && (
            <TimelineView
              weekDates={weekDates}
              shifts={viewShifts}
              staffList={staffList}
              locations={locations}
              weekDayStats={weekDayStats}
              selectedLocationId={selectedLocationId}
              canEdit={canEdit}
              isReadOnly={isReadOnly}
              canClaim={canClaim}
              currentStaffId={currentStaffId}
              canEditLocation={canEditLocation}
              assignedStaffIdsByDate={assignedStaffIdsByDate}
              onOpenShiftDialog={openShiftDialog}
              onOpenShiftDialogAt={openShiftDialogAt}
              onAssign={openAssignDialog}
              onDeleteShift={handleDeleteShift}
              onToggleCoverage={handleToggleCoverage}
              onClaimShift={handleClaimShift}
              onUnassign={handleUnassign}
              onSwap={openSwapDialog}
              onOpenDetail={setDetailShift}
            />
          )}
          {viewMode === 'roster' && (
            <RosterView
              weekDates={weekDates}
              shifts={viewShifts}
              staffList={staffList}
              locations={locations}
              weekDayStats={weekDayStats}
              selectedLocationId={selectedLocationId}
              canEdit={canEdit}
              isReadOnly={isReadOnly}
              canClaim={canClaim}
              currentStaffId={currentStaffId}
              canEditLocation={canEditLocation}
              assignedStaffIdsByDate={assignedStaffIdsByDate}
              onOpenShiftDialog={openShiftDialog}
              onOpenShiftDialogAt={openShiftDialogAt}
              onAssign={openAssignDialog}
              onDeleteShift={handleDeleteShift}
              onToggleCoverage={handleToggleCoverage}
              onClaimShift={handleClaimShift}
              onUnassign={handleUnassign}
              onSwap={openSwapDialog}
              onOpenDetail={setDetailShift}
            />
          )}
        </>
      )}

      <ShiftDetailDialog shift={detailShift} open={Boolean(detailShift)} onClose={() => setDetailShift(null)} />

      <Dialog open={shiftDialog} onClose={() => { if (!shiftSaving) setShiftDialog(false) }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create Shift</DialogTitle>
        <DialogContent>
          {shiftDialogError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setShiftDialogError('')}>{shiftDialogError}</Alert>}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Location</InputLabel>
              <Select value={shiftForm.location_id} label="Location" onChange={e => setShiftForm(p => ({ ...p, location_id: e.target.value }))}>
                {locations.filter((l: any) => rawUser.role === 'ORG_ADMIN' || rawUser.role === 'SUPER_ADMIN' || managedLocationIds.includes(l.id)).map((l: any) => (
                  <MenuItem key={l.id} value={l.id}>{l.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField label="Date" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }}
              value={shiftForm.start_date} onChange={e => setShiftForm(p => ({ ...p, start_date: e.target.value }))} />
            <TextField label="Start Time" type="time" fullWidth size="small" InputLabelProps={{ shrink: true }}
              value={shiftForm.start_time} onChange={e => setShiftForm(p => ({ ...p, start_time: e.target.value }))} />
            <TextField label="End Time" type="time" fullWidth size="small" InputLabelProps={{ shrink: true }}
              value={shiftForm.end_time} onChange={e => setShiftForm(p => ({ ...p, end_time: e.target.value }))} />
            <FormControl fullWidth size="small">
              <InputLabel>Assign Staff (optional)</InputLabel>
              <Select
                multiple
                value={shiftForm.assigned_staff_ids}
                label="Assign Staff (optional)"
                onChange={e => setShiftForm(p => ({ ...p, assigned_staff_ids: e.target.value as string[] }))}
                renderValue={(selected) => {
                  const names = selected.map(id => staffList.find(s => s.staff_id === id))
                    .filter(Boolean).map(s => `${s!.first_name} ${s!.last_name}`)
                  return names.length > 0 ? names.join(', ') : 'Leave as open shift'
                }}
              >
                {(() => {
                  const alreadyAssigned = shiftForm.start_date ? getAssignedStaffIdsForDate(shiftForm.start_date) : new Set<string>()
                  return staffList.filter(s => !alreadyAssigned.has(s.staff_id)).map((s: any) => (
                    <MenuItem key={s.staff_id} value={s.staff_id}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">{s.first_name} {s.last_name}</Typography>
                        <Chip label={`${s.compliance_pct ?? 100}%`} size="small"
                          color={(s.compliance_pct ?? 100) >= 100 ? 'success' : 'warning'}
                          sx={{ height: 18, fontSize: '0.65rem' }} />
                      </Stack>
                    </MenuItem>
                  ))
                })()}
              </Select>
              <Typography variant="caption" color="#6B7280" sx={{ mt: 0.5 }}>
                Leave empty to create an open shift that staff can claim as overtime
              </Typography>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Person (optional)</InputLabel>
              <Select value={shiftForm.person_id} label="Person (optional)"
                onChange={e => setShiftForm(p => ({ ...p, person_id: e.target.value }))}>
                <MenuItem value=""><em>None</em></MenuItem>
                {people.map((su: any) => (
                  <MenuItem key={su.id} value={su.id}>{su.first_name} {su.last_name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Shift Type</InputLabel>
              <Select value={shiftForm.shift_type} label="Shift Type"
                onChange={e => setShiftForm(p => ({ ...p, shift_type: e.target.value }))}>
                <MenuItem value="day">Day</MenuItem>
                <MenuItem value="sleep">Sleep-in</MenuItem>
                <MenuItem value="wake_night">Wake Night</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setShiftDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateShift} disabled={shiftSaving} sx={{ bgcolor: '#0F4C81' }}>
            {shiftSaving ? <CircularProgress size={20} sx={{ color: '#fff', mr: 1 }} /> : null}
            {shiftForm.assigned_staff_ids.length > 0 ? 'Create & Assign' : 'Create Open Shift'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={assignDialog} onClose={() => setAssignDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Assign Staff</DialogTitle>
        <DialogContent>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Staff Member</InputLabel>
            <Select value={assignStaffId} label="Staff Member" onChange={e => setAssignStaffId(e.target.value)}>
              {(() => {
                const targetShift = shifts.find(s => s.id === assignShiftId)
                const shiftDate = targetShift?.start_time ? toLocalDateStr(new Date(targetShift.start_time)) : ''
                const alreadyAssigned = shiftDate ? getAssignedStaffIdsForDate(shiftDate) : new Set<string>()
                return staffList.filter(s => !alreadyAssigned.has(s.staff_id)).map((s: any) => {
                  const compliant = (s.compliance_pct ?? 100) >= 100
                  return (
                    <MenuItem key={s.staff_id} value={s.staff_id} disabled={!compliant}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">{s.first_name} {s.last_name}</Typography>
                        <Chip label={`${s.compliance_pct ?? 100}%`} size="small"
                          color={compliant ? 'success' : 'error'} sx={{ height: 18, fontSize: '0.65rem' }} />
                        {!compliant && <Typography variant="caption" color="error">(below min compliance)</Typography>}
                      </Stack>
                    </MenuItem>
                  )
                })
              })()}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setAssignDialog(false)}>Cancel</Button>
          <Button variant="contained" disabled={!assignStaffId} onClick={handleAssign} sx={{ bgcolor: '#0F4C81' }}>Assign</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={swapDialog} onClose={() => setSwapDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {swapDialogStep === 1 ? 'Request Shift Swap' : `Swap with ${targetStaffName}`}
        </DialogTitle>
        <DialogContent>
          {swapDialogStep === 1 ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Swap With</InputLabel>
                <Select value={swapToStaffId} label="Swap With"
                  onChange={e => handleSwapSelectStaff(e.target.value)}>
                  {eligibleSwapStaff.filter((s: any) => s.staff_id !== currentStaffId).map((s: any) => (
                    <MenuItem key={s.staff_id} value={s.staff_id}>{s.first_name} {s.last_name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant="caption" color="#6B7280">
                Select a staff member to see their available shifts for this week
              </Typography>
            </Stack>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <IconButton size="small" onClick={() => setSwapDialogStep(1)}>
                  <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Typography variant="body2" color="#6B7280">
                  Choose a day — swap an existing shift or transfer yours to a free day
                </Typography>
              </Stack>
              {swapLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                <>
                  <Stack spacing={1} sx={{ maxHeight: 350, overflow: 'auto' }}>
                    {(() => {
                      const start = new Date(swapShiftDate || weekStart)
                      const end = swapRangeEnd || new Date(start.getTime() + 7 * 86400000)
                      const days: Date[] = []
                      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                        days.push(new Date(d))
                      }
                      return days.filter(d => d >= new Date(new Date().toDateString())).map((day) => {
                      const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
                      const dateLabel = day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                      const dayShifts = targetStaffShifts.filter((ts: any) => {
                        const tsDate = new Date(ts.start_time)
                        return tsDate.getFullYear() === day.getFullYear() && tsDate.getMonth() === day.getMonth() && tsDate.getDate() === day.getDate()
                      })
                      const isTransfer = dayShifts.length === 0
                      const isSelected = isTransfer
                        ? swapToShiftId === `__transfer__${dateStr}`
                        : dayShifts.some((ts: any) => ts.id === swapToShiftId)
                      return (
                        <Paper key={dateStr} variant="outlined" sx={{
                          p: 1.5, cursor: 'pointer',
                          border: isSelected ? '2px solid #0F4C81' : '1px solid #E5E7EB',
                          bgcolor: isSelected ? '#F0F5FA' : 'white',
                          '&:hover': { borderColor: '#0F4C81' },
                        }} onClick={() => {
                          if (isTransfer) {
                            setSwapToShiftId(`__transfer__${dateStr}`)
                          } else {
                            setSwapToShiftId(dayShifts[0].id)
                          }
                        }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Stack spacing={0.3}>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>{dateLabel}</Typography>
                              {isTransfer ? (
                                <Typography variant="caption" color="#D97706">
                                  Transfer — {targetStaffName || 'target'} is free this day
                                </Typography>
                              ) : dayShifts.map((ts: any) => {
                                const timeLabel = `${new Date(ts.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} — ${new Date(ts.end_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                                return (
                                  <Box key={ts.id}>
                                    <Typography variant="caption" color="#16A34A">
                                      Swap — {timeLabel}
                                    </Typography>
                                    <Typography variant="caption" display="block" color="#6B7280">{ts.location_name}</Typography>
                                  </Box>
                                )
                              })}
                            </Stack>
                            {!isTransfer && dayShifts[0]?.shift_type && dayShifts[0].shift_type !== 'day' && (
                              <Chip label={dayShifts[0].shift_type === 'sleep' ? 'Sleep' : 'Wake Night'} size="small"
                                sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#E9D5FF', color: '#581C87' }} />
                            )}
                            {isTransfer && (
                              <Chip label="Transfer" size="small"
                                sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#FEF3C7', color: '#92400E' }} />
                            )}
                          </Stack>
                        </Paper>
                      )
                    })})()}
                    {(!swapShiftDate && weekDates.filter(d => d >= new Date(new Date().toDateString())).length === 0) && (
                      <Paper sx={{ p: 3, textAlign: 'center', bgcolor: '#F9FAFB' }}>
                        <Typography variant="body2" color="#6B7280">
                          No upcoming days this week
                        </Typography>
                      </Paper>
                    )}
                  </Stack>
                  <TextField label="Reason (optional)" fullWidth size="small" multiline rows={2}
                    value={swapReason} onChange={e => setSwapReason(e.target.value)} />
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setSwapDialog(false)}>Cancel</Button>
          {swapDialogStep === 2 && (
            <Button variant="contained"
              disabled={!swapToShiftId || swapLoading}
              sx={{ bgcolor: '#0F4C81' }}
              onClick={handleRequestSwap}>
              {swapLoading ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'Send Swap Request'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={aiDialogOpen} onClose={() => setAiDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AutoAwesomeIcon sx={{ color: '#A855F7' }} />
            <span>AI Rota Analysis</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {aiLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8, flexDirection: 'column', gap: 2 }}>
              <CircularProgress sx={{ color: '#A855F7' }} />
              <Typography color="text.secondary">Analyzing rota data...</Typography>
            </Box>
          ) : aiError ? (
            <Alert severity="error" sx={{ mt: 1 }}>{aiError}</Alert>
          ) : aiAnalysis ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Paper sx={{ p: 2, bgcolor: '#F5F3FF', border: '1px solid #E9D5FF', borderRadius: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Overall Assessment</Typography>
                <Typography variant="body2" color="text.secondary">{aiAnalysis.overall_assessment}</Typography>
              </Paper>

              {aiAnalysis.coverage_warnings?.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Coverage Warnings</Typography>
                  <Stack spacing={1}>
                    {aiAnalysis.coverage_warnings.map((w: any, i: number) => (
                      <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" fontWeight={600}>{w.day} — {w.location}</Typography>
                          <Chip label={w.severity} size="small" sx={{
                            height: 20, fontSize: '0.6rem', fontWeight: 700,
                            bgcolor: w.severity === 'high' ? '#FEE2E2' : w.severity === 'medium' ? '#FEF3C7' : '#DBEAFE',
                            color: w.severity === 'high' ? '#DC2626' : w.severity === 'medium' ? '#92400E' : '#1E40AF',
                          }} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>{w.message}</Typography>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              )}

              {aiAnalysis.overtime_risks?.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Overtime Risks</Typography>
                  <Stack spacing={1}>
                    {aiAnalysis.overtime_risks.map((r: any, i: number) => (
                      <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                        <Typography variant="body2" fontWeight={600}>{r.staff_name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.current_hours}h / {r.contracted_hours}h contracted — {r.message}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              )}

              {aiAnalysis.staffing_suggestions?.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Staffing Suggestions</Typography>
                  <Stack spacing={1}>
                    {aiAnalysis.staffing_suggestions.map((s: any, i: number) => (
                      <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                        <Typography variant="body2" fontWeight={600}>{s.shift_details}</Typography>
                        {s.recommended_staff?.length > 0 && (
                          <Box sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="#16A34A" fontWeight={600}>Recommended:</Typography>
                            {s.recommended_staff.map((rs: any) => (
                              <Typography key={rs.staff_id} variant="caption" display="block" sx={{ ml: 1 }}>
                                • {rs.name} — {rs.reason}
                              </Typography>
                            ))}
                          </Box>
                        )}
                        {s.alternative_staff?.length > 0 && (
                          <Box sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="#F59E0B" fontWeight={600}>Alternatives:</Typography>
                            {s.alternative_staff.map((as: any) => (
                              <Typography key={as.staff_id} variant="caption" display="block" sx={{ ml: 1 }}>
                                • {as.name} — {as.reason}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              )}

              {aiAnalysis.optimization_tips?.length > 0 && (
                <Paper sx={{ p: 2, bgcolor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 2 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: '#166534' }}>Optimization Tips</Typography>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {aiAnalysis.optimization_tips.map((t: string, i: number) => (
                      <li key={i}><Typography variant="caption" color="#166534">{t}</Typography></li>
                    ))}
                  </ul>
                </Paper>
              )}

              {aiAnalysis.estimated_savings && (
                <Paper sx={{ p: 2, bgcolor: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 2 }}>
                  <Typography variant="body2" fontWeight={700} sx={{ color: '#1E40AF' }}>
                    Estimated Savings: {aiAnalysis.estimated_savings}
                  </Typography>
                </Paper>
              )}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setAiDialogOpen(false)}>Close</Button>
          {aiAnalysis && (
            <Button variant="outlined" startIcon={<AutoAwesomeIcon />} onClick={runAiAnalysis}
              disabled={aiLoading} sx={{ borderColor: '#A855F7', color: '#A855F7' }}>
              Re-analyze
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={genDialogOpen} onClose={() => { if (!genLoading && !genApplying) setGenDialogOpen(false) }} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <AutoAwesomeIcon sx={{ color: '#7C3AED' }} />
            <span>{genResult ? 'Generated Rota Preview' : 'Generate AI Rota'}</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {genError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setGenError('')}>{genError}</Alert>}

          {!genResult ? (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                AI will generate a complete staff rota for the selected period based on staff availability, compliance, and location requirements. Review before applying.
              </Typography>
              <FormControl fullWidth size="small">
                <InputLabel>Period</InputLabel>
                <Select value={genPeriod} label="Period" onChange={e => setGenPeriod(e.target.value)}>
                  <MenuItem value="week">Next 7 Days</MenuItem>
                  <MenuItem value="2weeks">Next 2 Weeks</MenuItem>
                  <MenuItem value="month">Next Month</MenuItem>
                </Select>
              </FormControl>

              {selectedLocationId && (
                <>
                  <Box sx={{ p: 2, bgcolor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 2 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Shift Start & End Rules</Typography>

                    <FormControlLabel
                      control={<Checkbox checked={genAllSameStart} onChange={e => setGenAllSameStart(e.target.checked)} size="small" />}
                      label={<Typography variant="caption">All shifts start at same time</Typography>}
                      sx={{ mb: 1 }}
                    />

                    {(() => {
                      const totalSlots = (genAllSameStart ? 1 : Math.max(1, getMinStaffForLocation(selectedLocationId || '')))

                      // Ensure genMandatoryStartTimes has enough entries
                      if (genMandatoryStartTimes.length < totalSlots) {
                        const updated = [...genMandatoryStartTimes]
                        while (updated.length < totalSlots) {
                          const defaults = ['07:00', '10:00', '14:00', '21:00', '22:00', '08:00', '12:00', '16:00']
                          updated.push(defaults[updated.length % defaults.length])
                        }
                        if (updated.length !== genMandatoryStartTimes.length) {
                          setTimeout(() => setGenMandatoryStartTimes(updated), 0)
                        }
                      }

                      return (
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          {Array.from({ length: totalSlots }).map((_, idx) => (
                            <TextField
                              key={idx}
                              type="time"
                              size="small"
                              label={`Slot ${idx + 1} start`}
                              value={genMandatoryStartTimes[idx] || '07:00'}
                              onChange={e => {
                                const updated = [...genMandatoryStartTimes]
                                updated[idx] = e.target.value
                                if (genAllSameStart) {
                                  // When "all same" is on, fill all slots with this value
                                  for (let j = 0; j < updated.length; j++) updated[j] = e.target.value
                                }
                                setGenMandatoryStartTimes(updated)
                              }}
                              sx={{ '& .MuiInputBase-root': { fontSize: '0.75rem', minHeight: 32 }, '& .MuiInputLabel-root': { fontSize: '0.65rem' } }}
                            />
                          ))}
                        </Stack>
                      )
                    })()}

                    <Box sx={{ mt: 2 }}>
                      <FormControlLabel
                        control={<Checkbox checked={genAllSameEnd} onChange={e => setGenAllSameEnd(e.target.checked)} size="small" />}
                        label={<Typography variant="caption">All shifts end at same time</Typography>}
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        type="time"
                        size="small"
                        label={genAllSameEnd ? 'End Time (all shifts)' : 'Minimum End Time (shifts should end no earlier than)'}
                        value={genMinEndTime}
                        onChange={e => setGenMinEndTime(e.target.value)}
                        sx={{ '& .MuiInputBase-root': { fontSize: '0.75rem', minHeight: 32 }, '& .MuiInputLabel-root': { fontSize: '0.65rem' } }}
                      />
                    </Box>
                  </Box>

                  <Paper sx={{ p: 2, bgcolor: '#F5F3FF', border: '1px solid #E9D5FF', borderRadius: 2 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Generation Inputs</Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      • Location: {locations.find(l => l.id === selectedLocationId)?.name || 'All locations'} ({selectedLocationId ? getMinStaffForLocation(selectedLocationId) : '-'} min/day | Day:{getShiftTypeMin(selectedLocationId||'','day')} Night:{getShiftTypeMin(selectedLocationId||'','wake_night')} Sleep:{getShiftTypeMin(selectedLocationId||'','sleep')})
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      • Staff available: {staffList.length}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      • Existing shifts: {shifts.length}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      • Shift types: Day, Sleep-in, Wake Night (staff assigned to home location first; cross-location noted)
                      • Visa weekly hour caps accounted for
                    </Typography>
                  </Paper>
                </>
              )}

              {!selectedLocationId && (
                <Paper sx={{ p: 2, bgcolor: '#F5F3FF', border: '1px solid #E9D5FF', borderRadius: 2 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Generation Inputs</Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    Select a location to configure shift start/end rules.
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    • Staff available: {staffList.length}
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    • Existing shifts: {shifts.length}
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    • Shift types: Day, Sleep-in, Wake Night (staff assigned to home location first; cross-location noted)
                    • Visa weekly hour caps accounted for
                  </Typography>
                </Paper>
              )}
            </Stack>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Card sx={{ flex: '1 1 140px', borderTop: '3px solid #7C3AED' }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">Total Shifts</Typography>
                    <Typography variant="h6" fontWeight={700}>{genResult.coverage_summary?.total_shifts || genResult.shifts?.length || 0}</Typography>
                  </CardContent>
                </Card>
                <Card sx={{ flex: '1 1 140px', borderTop: '3px solid #16A34A' }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">Staffed Days</Typography>
                    <Typography variant="h6" fontWeight={700}>{genResult.coverage_summary?.fully_staffed_days || '-'}</Typography>
                  </CardContent>
                </Card>
                <Card sx={{ flex: '1 1 140px', borderTop: '3px solid #F59E0B' }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">Understaffed Days</Typography>
                    <Typography variant="h6" fontWeight={700}>{genResult.coverage_summary?.understaffed_days || '-'}</Typography>
                  </CardContent>
                </Card>
                <Card sx={{ flex: '1 1 140px', borderTop: '3px solid #3B82F6' }}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant="caption" color="text.secondary">Utilization</Typography>
                    <Typography variant="h6" fontWeight={700}>{genResult.coverage_summary?.staff_utilization_pct || '-'}%</Typography>
                  </CardContent>
                </Card>
              </Stack>

              {genResult.summary && (
                <Paper sx={{ p: 2, bgcolor: '#F5F3FF', border: '1px solid #E9D5FF', borderRadius: 2 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>Summary</Typography>
                  <Typography variant="body2" color="text.secondary">{genResult.summary}</Typography>
                </Paper>
              )}

              {editableGenShifts?.length > 0 && (
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                    <Button
                      size="small"
                      variant={genEditMode ? 'contained' : 'outlined'}
                      onClick={() => setGenEditMode(!genEditMode)}
                      sx={{ bgcolor: genEditMode ? '#0F4C81' : 'transparent' }}
                    >
                      {genEditMode ? 'Done Editing' : 'Edit Shifts'}
                    </Button>
                    {genEditMode && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="success"
                        onClick={() => {
                          setEditableGenShifts([...editableGenShifts, {
                            date: new Date().toISOString().substring(0, 10),
                            shift_type: 'day',
                            start_time: '07:00',
                            end_time: '14:00',
                            location_id: selectedLocationId || locations[0]?.id || '',
                            location_name: locations.find(l => l.id === (selectedLocationId || locations[0]?.id))?.name || '',
                            assigned_staff: [],
                            assigned_staff_names: [],
                          }])
                        }}
                      >
                        + Add Row
                      </Button>
                    )}
                  </Stack>
                  <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Shift</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Date</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Type</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Start</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>End</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Location</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Assigned Staff</TableCell>
                          {genEditMode && <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', width: 40 }}></TableCell>}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {editableGenShifts.map((s: any, i: number) => {
                          const dateStr = s.date ? new Date(s.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
                          return (
                            <TableRow key={i} sx={{ '&:hover': { bgcolor: '#F5F3FF' } }}>
                              <TableCell sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>#{i + 1}</TableCell>
                              {genEditMode ? (
                                <>
                                  <TableCell sx={{ p: '4px' }}>
                                    <TextField
                                      type="date"
                                      size="small"
                                      sx={{ '& .MuiInputBase-root': { fontSize: '0.75rem', minHeight: 32 } }}
                                      value={s.date}
                                      onChange={e => {
                                        const updated = [...editableGenShifts]
                                        updated[i] = { ...updated[i], date: e.target.value }
                                        setEditableGenShifts(updated)
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ p: '4px' }}>
                                    <Select
                                      size="small"
                                      value={s.shift_type || 'day'}
                                      onChange={e => {
                                        const updated = [...editableGenShifts]
                                        updated[i] = { ...updated[i], shift_type: e.target.value }
                                        setEditableGenShifts(updated)
                                      }}
                                      sx={{ '& .MuiSelect-select': { fontSize: '0.75rem', py: 0.5 } }}
                                    >
                                      <MenuItem value="day">Day</MenuItem>
                                      <MenuItem value="wake_night">Night</MenuItem>
                                      <MenuItem value="sleep">Sleep</MenuItem>
                                    </Select>
                                  </TableCell>
                                  <TableCell sx={{ p: '4px' }}>
                                    <TextField
                                      type="time"
                                      size="small"
                                      sx={{ '& .MuiInputBase-root': { fontSize: '0.75rem', minHeight: 32 } }}
                                      value={s.start_time}
                                      onChange={e => {
                                        const updated = [...editableGenShifts]
                                        updated[i] = { ...updated[i], start_time: e.target.value }
                                        setEditableGenShifts(updated)
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ p: '4px' }}>
                                    <TextField
                                      type="time"
                                      size="small"
                                      sx={{ '& .MuiInputBase-root': { fontSize: '0.75rem', minHeight: 32 } }}
                                      value={s.end_time}
                                      onChange={e => {
                                        const updated = [...editableGenShifts]
                                        updated[i] = { ...updated[i], end_time: e.target.value }
                                        setEditableGenShifts(updated)
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ p: '4px' }}>
                                    <Select
                                      size="small"
                                      value={s.location_id || ''}
                                      onChange={e => {
                                        const loc = locations.find(l => l.id === e.target.value)
                                        const updated = [...editableGenShifts]
                                        updated[i] = { ...updated[i], location_id: e.target.value, location_name: loc?.name || '' }
                                        setEditableGenShifts(updated)
                                      }}
                                      sx={{ '& .MuiSelect-select': { fontSize: '0.75rem', py: 0.5 } }}
                                    >
                                      {locations.map(loc => (
                                        <MenuItem key={loc.id} value={loc.id}>{loc.name}</MenuItem>
                                      ))}
                                    </Select>
                                  </TableCell>
                                  <TableCell sx={{ p: '4px', minWidth: 180 }}>
                                    <Autocomplete
                                      multiple
                                      size="small"
                                      options={staffList}
                                      getOptionLabel={(opt: any) => `${opt.first_name} ${opt.last_name}`}
                                      value={staffList.filter((st: any) => (s.assigned_staff || []).includes(st.staff_id))}
                                      onChange={(_e, val: any[]) => {
                                        const updated = [...editableGenShifts]
                                        updated[i] = {
                                          ...updated[i],
                                          assigned_staff: val.map(v => v.staff_id),
                                          assigned_staff_names: val.map(v => `${v.first_name} ${v.last_name}`),
                                        }
                                        setEditableGenShifts(updated)
                                      }}
                                      renderInput={(params) => (
                                        <TextField {...params} placeholder="Select staff" sx={{ '& .MuiInputBase-root': { fontSize: '0.75rem' } }} />
                                      )}
                                      ChipProps={{ size: 'small', sx: { height: 20, fontSize: '0.65rem' } }}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ p: '4px' }}>
                                    <IconButton size="small" color="error" onClick={() => {
                                      const updated = editableGenShifts.filter((_: any, idx: number) => idx !== i)
                                      setEditableGenShifts(updated)
                                    }}>
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell sx={{ fontSize: '0.8rem' }}>{dateStr}</TableCell>
                                  <TableCell>
                                    <Chip label={s.shift_type || 'day'} size="small" sx={{
                                      height: 18, fontSize: '0.6rem',
                                      bgcolor: s.shift_type === 'sleep' ? '#E9D5FF' : s.shift_type === 'wake_night' ? '#1E1B4B' : '#D1FAE5',
                                      color: s.shift_type === 'sleep' ? '#581C87' : s.shift_type === 'wake_night' ? '#F8FAFC' : '#065F46',
                                    }} />
                                  </TableCell>
                                  <TableCell sx={{ fontSize: '0.8rem' }}>{s.start_time} - {s.end_time}</TableCell>
                                  <TableCell sx={{ fontSize: '0.8rem' }}>{s.location_name}</TableCell>
                                  <TableCell sx={{ fontSize: '0.8rem' }}>
                                    {(s.assigned_staff_names || []).join(', ') || <Typography variant="caption" color="#9CA3AF">Open</Typography>}
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              )}

              {genResult.warnings?.length > 0 && (
                <Box>
                  {genResult.warnings.map((w: string, i: number) => (
                    <Alert key={i} severity="warning" sx={{ mb: 0.5 }}>{w}</Alert>
                  ))}
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setGenDialogOpen(false)} disabled={genLoading || genApplying}>Cancel</Button>
          {!genResult ? (
            <Button variant="contained" disabled={genLoading} onClick={runGenerateRota}
              sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}>
              {genLoading ? <><CircularProgress size={16} sx={{ color: 'white', mr: 1 }} /> Generating...</> : 'Generate Rota'}
            </Button>
          ) : (
            <Button variant="contained" disabled={genApplying || !genResult.shifts?.length} onClick={applyGeneratedRota}
              sx={{ bgcolor: '#7C3AED', '&:hover': { bgcolor: '#6D28D9' } }}>
              {genApplying ? <><CircularProgress size={16} sx={{ color: 'white', mr: 1 }} /> Applying...</> : `Apply ${editableGenShifts?.length || 0} Shifts to Rota`}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <Dialog open={staffingDialog} onClose={() => setStaffingDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Staffing Rules</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Set minimum staff required per location. Day, Night (wake), and Sleep shift types each have their own configurable minimum. The general Minimum Staff Per Day is the fallback.
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Location</strong></TableCell>
                <TableCell align="right"><strong>Min Per Day</strong></TableCell>
                <TableCell align="right"><strong>Min Day Staff</strong></TableCell>
                <TableCell align="right"><strong>Min Night Staff</strong></TableCell>
                <TableCell align="right"><strong>Min Sleep Staff</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {staffingRules.map((rule, i) => (
                <TableRow key={rule.id}>
                  <TableCell>{rule.name}</TableCell>
                  <TableCell align="right" sx={{ width: 100 }}>
                    <TextField
                      type="number"
                      size="small"
                      inputProps={{ min: 1 }}
                      value={rule.minimum_staff_per_day}
                      onChange={e => {
                        const updated = [...staffingRules]
                        updated[i] = { ...updated[i], minimum_staff_per_day: parseInt(e.target.value) || 1 }
                        setStaffingRules(updated)
                      }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ width: 100 }}>
                    <TextField
                      type="number"
                      size="small"
                      inputProps={{ min: 0 }}
                      value={rule.min_day_staff}
                      onChange={e => {
                        const updated = [...staffingRules]
                        updated[i] = { ...updated[i], min_day_staff: parseInt(e.target.value) || 0 }
                        setStaffingRules(updated)
                      }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ width: 100 }}>
                    <TextField
                      type="number"
                      size="small"
                      inputProps={{ min: 0 }}
                      value={rule.min_night_staff}
                      onChange={e => {
                        const updated = [...staffingRules]
                        updated[i] = { ...updated[i], min_night_staff: parseInt(e.target.value) || 0 }
                        setStaffingRules(updated)
                      }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ width: 100 }}>
                    <TextField
                      type="number"
                      size="small"
                      inputProps={{ min: 0 }}
                      value={rule.min_sleep_staff}
                      onChange={e => {
                        const updated = [...staffingRules]
                        updated[i] = { ...updated[i], min_sleep_staff: parseInt(e.target.value) || 0 }
                        setStaffingRules(updated)
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setStaffingDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveStaffingRules} sx={{ bgcolor: '#0F4C81' }}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
