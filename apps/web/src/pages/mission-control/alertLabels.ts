/**
 * The words a manager reads on an alert row.
 *
 * Mission Control's list is a stream of event types, and the chip beside each row is
 * the only place those become language. A type this map does not know falls through
 * as the raw dotted name — `room_check.overdue` — which is an API identifier leaking
 * into a clinical dashboard. Kept out of the page component so the mapping can be
 * asserted without mounting the whole screen.
 */
export const categoryLabel = (type: string): string => {
  if (type.startsWith('medication.')) return 'Medication'
  // A room with no check today reads as "Room Checks". The record is daily, it is a
  // safety and cleanliness observation, and it is the one supported-living event with
  // no obvious organisational home in the older label set.
  if (type === 'room_check.overdue') return 'Room Checks'
  // `shift.handover_due` sits with the staffing gaps: it is the shift that ran without
  // its responsibility being handed on, which is what the category filter means.
  if (type === 'shift.unfilled' || type === 'shift.understaffed' || type === 'shift.handover_due') return 'Staffing'
  if (type === 'incident.action_overdue') return 'Safety'
  if (type === 'training.expiring') return 'Training'
  if (type === 'dbs.expiring') return 'DBS'
  if (type === 'policy.review_due') return 'Policy'
  if (type === 'care_plan.review_due') return 'Care Plan'
  if (type === 'fluid.intake_below_target') return 'Health'
  if (type.startsWith('nutrition.')) return 'Nutrition'
  return type
}
