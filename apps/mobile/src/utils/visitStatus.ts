import type { HomecareVisit } from '../types'

/** Check if a visit is overdue — past its scheduled end and not completed/missed/cancelled */
export function isOverdue(visit: HomecareVisit): boolean {
  if (['completed', 'missed', 'cancelled'].includes(visit.status)) return false
  const now = new Date()
  const end = new Date(visit.scheduled_end)
  return now > end
}

/** How many minutes overdue a visit is, or 0 if not overdue */
export function overdueMinutes(visit: HomecareVisit): number {
  if (!isOverdue(visit)) return 0
  const now = new Date()
  const end = new Date(visit.scheduled_end)
  return Math.floor((now.getTime() - end.getTime()) / 60000)
}

/** Human-readable overdue label */
export function overdueLabel(visit: HomecareVisit): string {
  const mins = overdueMinutes(visit)
  if (mins <= 0) return ''
  if (mins < 60) return `${mins}min overdue`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}min overdue` : `${h}h overdue`
}
