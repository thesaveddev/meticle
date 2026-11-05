/**
 * Drag-and-drop for the rota grid (RosterView): what a drop *means*, decided
 * in one pure place so the view and the page cannot disagree.
 *
 * A dragged chip carries the shift plus where it came from — the assignment
 * (staff) and the day — because the drop target names a (staff, day) cell and
 * the two halves of the move go to different endpoints:
 *
 *   - a different day moves the whole shift (`PATCH /shifts/:id` with the
 *     same times of day on the new date, duration preserved so an overnight
 *     shift stays overnight). Every assignment rides along; a shift with two
 *     carers cannot be split across days by dragging one chip.
 *   - a different staff member moves only that assignment
 *     (`DELETE …/assign/:from` then `POST …/assign`), so dragging one carer's
 *     chip off a double-covered shift leaves the other carer where they were.
 *     A drop with no source staff (an open shift has no chip to drag, so this
 *     only arises programmatically) is a pure assign.
 *   - same staff, same day is a no-op: the chip was picked up and put back.
 *
 * Drops onto a past day are refused here as well as in the view. The view
 * hides the drop highlight, but a dataTransfer payload is user-controlled
 * bytes, so the plan is the second check, not the first.
 *
 * Errors (compliance block, conflicting shift, 11-hour rest) surface from the
 * API when the page executes the plan; this module only decides *which* calls
 * the drop needs, never whether they will succeed.
 */

export interface RotaDragPayload {
  shiftId: string
  /** Null when the dragged chip names no assignment (a pure assign). */
  fromStaffId: string | null
  fromDate: string
}

export interface RotaDropPlan {
  /** New date for the whole shift, or null when the day did not change. */
  moveDate: string | null
  /** Staff to unassign, or null when nothing (or nobody) is unassigned. */
  reassignFrom: string | null
  /** Staff to assign, or null when the assignment did not change. */
  reassignTo: string | null
}

export const ROTA_DRAG_MIME = 'application/x-meticle-rota-shift'

const NO_PLAN: RotaDropPlan = { moveDate: null, reassignFrom: null, reassignTo: null }

export function encodeRotaDrag(payload: RotaDragPayload): string {
  return JSON.stringify(payload)
}

export function decodeRotaDrag(raw: string | null | undefined): RotaDragPayload | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<RotaDragPayload>
    if (typeof parsed?.shiftId !== 'string' || !parsed.shiftId) return null
    if (typeof parsed?.fromDate !== 'string' || !parsed.fromDate) return null
    if (parsed.fromStaffId !== null && parsed.fromStaffId !== undefined && typeof parsed.fromStaffId !== 'string') return null
    return {
      shiftId: parsed.shiftId,
      fromStaffId: parsed.fromStaffId ?? null,
      fromDate: parsed.fromDate,
    }
  } catch {
    return null
  }
}

export function resolveRotaDrop(args: {
  shiftStartDate: string
  fromStaffId: string | null
  toStaffId: string
  toDate: string
  /** `YYYY-MM-DD`; defaults to today. Drops before it are refused. */
  todayStr?: string
}): RotaDropPlan {
  const { shiftStartDate, fromStaffId, toStaffId, toDate } = args
  const today = args.todayStr ?? new Date().toISOString().slice(0, 10)
  if (!toStaffId || !toDate || toDate < today) return NO_PLAN

  const moveDate = toDate !== shiftStartDate ? toDate : null
  const staffChanged = (fromStaffId ?? null) !== toStaffId
  if (!moveDate && !staffChanged) return NO_PLAN
  return {
    moveDate,
    reassignFrom: staffChanged ? fromStaffId : null,
    reassignTo: staffChanged ? toStaffId : null,
  }
}
