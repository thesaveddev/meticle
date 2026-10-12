import { P } from '../../../styles/tokens'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const toLocalDateStr = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const isShiftPast = (shift: any) => new Date(shift.end_time) < new Date()

const isDayPast = (date: Date) => {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return date < today
}

const minutesOfDay = (iso: string) => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

const shiftStartMinutes = (shift: any) => minutesOfDay(shift.start_time)
const shiftEndMinutes = (shift: any) => minutesOfDay(shift.end_time)

const shiftDurationHours = (shift: any) => {
  const start = new Date(shift.start_time)
  const end = new Date(shift.end_time)
  return Math.max(0.25, (end.getTime() - start.getTime()) / 3600000)
}

const sortShiftsByStart = (a: any, b: any) =>
  (a._startHour ?? shiftStartMinutes(a) / 60) - (b._startHour ?? shiftStartMinutes(b) / 60) ||
  (a._startDate ?? '').localeCompare(b._startDate ?? '')

const shiftMatchesDay = (shift: any, dateStr: string) =>
  shift._startDate === dateStr || shift._endDate === dateStr

// Semantic shift visuals shared across all rota views.
// Open = amber, agency = blue, sleep = purple, wake night = deep navy, day = emerald.
const shiftVisual = (shift: any) => {
  const isOpen = (shift.assignments?.length || 0) === 0
  if (isOpen) return { bar: '#F59E0B', barText: '#0C1B2E', chipBg: '#FFF7E6', chipFg: '#9A6700' }
  if (shift.agency_id) return { bar: '#0164C8', barText: '#FFFFFF', chipBg: '#EAF3FF', chipFg: '#004085' }
  if (shift.shift_type === 'sleep') return { bar: '#8B7CF6', barText: '#FFFFFF', chipBg: '#EAF3FF', chipFg: '#8B7CF6' }
  if (shift.shift_type === 'wake_night') return { bar: '#8B7CF6', barText: '#F7FAFE', chipBg: '#EAF3FF', chipFg: P.navyLight }
  return { bar: '#10B981', barText: '#FFFFFF', chipBg: '#EAFBF5', chipFg: '#087A55' }
}

export const rotaHelpers = {
  DAYS,
  toLocalDateStr,
  isShiftPast,
  isDayPast,
  minutesOfDay,
  shiftStartMinutes,
  shiftEndMinutes,
  shiftDurationHours,
  sortShiftsByStart,
  shiftMatchesDay,
  shiftVisual,
}
