// Who can cover an appointment, derived from the rota: a staffer whose
// assigned shift (not rejected) overlaps the appointment window is on shift.
// Everyone else is listed after, so the picker shows the truth rather than
// only whoever happened to be free.

export interface ShiftOverlap {
  staff_id: string
  shift_start: string
  shift_end: string
}

export interface StaffAvailability {
  staff_id: string
  name: string
  available: boolean
  // Short human line for the picker row ("On shift 2:00 - 10:00 pm",
  // "On shift from 8:00 pm", "Not on shift that day").
  detail: string
  shift_start?: string
  shift_end?: string
  // Sort key: available first, then earliest shift start.
  sortKey: number
}

const fmtT = (iso: string) => {
  const d = new Date(iso)
  const h = d.getHours() % 12 || 12
  return `${h}:${String(d.getMinutes()).padStart(2, '0')}`
}

const ampm = (iso: string) => (new Date(iso).getHours() < 12 ? 'am' : 'pm')

export function fmtShiftRange(start: string, end: string) {
  const s = fmtT(start); const e = fmtT(end)
  const sa = ampm(start); const ea = ampm(end)
  return sa === ea ? `${s} - ${e} ${ea}` : `${s} ${sa} - ${e} ${ea}`
}

export function staffAvailabilityFor(
  staff: { staff_id?: string; id?: string; first_name?: string; last_name?: string; email?: string }[],
  shifts: any[],
  apptStart: string,
  apptEnd: string,
): StaffAvailability[] {
  const start = new Date(apptStart).getTime()
  const end = new Date(apptEnd).getTime()
  const overlapsByStaff = new Map<string, { shift_start: string; shift_end: string }>()
  const laterByStaff = new Map<string, { shift_start: string; shift_end: string }>()

  for (const s of shifts || []) {
    const sStart = new Date(s.start_time).getTime()
    const sEnd = new Date(s.end_time).getTime()
    for (const a of s.assignments || []) {
      if (!a?.staff_id || a.status === 'rejected') continue
      if (sStart < end && sEnd > start) {
        const prev = overlapsByStaff.get(a.staff_id)
        if (!prev || sStart < new Date(prev.shift_start).getTime()) {
          overlapsByStaff.set(a.staff_id, { shift_start: s.start_time, shift_end: s.end_time })
        }
      } else if (sStart >= end) {
        const prev = laterByStaff.get(a.staff_id)
        if (!prev || sStart < new Date(prev.shift_start).getTime()) {
          laterByStaff.set(a.staff_id, { shift_start: s.start_time, shift_end: s.end_time })
        }
      }
    }
  }

  return staff
    .filter(s => s.staff_id || s.id)
    .map(s => {
      const id = String(s.staff_id || s.id)
      const name = `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email || 'Unknown'
      const overlap = overlapsByStaff.get(id)
      if (overlap) {
        return {
          staff_id: id, name, available: true,
          detail: `On shift ${fmtShiftRange(overlap.shift_start, overlap.shift_end)}`,
          shift_start: overlap.shift_start, shift_end: overlap.shift_end,
          sortKey: new Date(overlap.shift_start).getTime(),
        }
      }
      const later = laterByStaff.get(id)
      if (later) {
        return {
          staff_id: id, name, available: false,
          detail: `On shift from ${fmtT(later.shift_start)} ${ampm(later.shift_start)}`,
          shift_start: later.shift_start, shift_end: later.shift_end,
          sortKey: 1e15 + new Date(later.shift_start).getTime(),
        }
      }
      return { staff_id: id, name, available: false, detail: 'Not on shift that day', sortKey: 2e15 }
    })
    .sort((x, y) => x.sortKey - y.sortKey)
}

// One-line helper under the form's staff field: what the selected staffer is
// doing around the appointment, so a clash is caught before saving.
export function staffShiftHelper(
  availability: StaffAvailability[],
  staffId: string,
  firstName?: string
): string | undefined {
  if (!staffId) return undefined
  const row = availability.find(a => a.staff_id === staffId)
  if (!row) return undefined
  const who = firstName || row.name.split(' ')[0] || 'They'
  if (row.available && row.shift_end) return `${who} is on shift until ${fmtT(row.shift_end)} ${ampm(row.shift_end)}.`
  if (row.shift_start) return `${who} is on shift from ${fmtT(row.shift_start)} ${ampm(row.shift_start)}.`
  return `${who} has no shifts that day.`
}
