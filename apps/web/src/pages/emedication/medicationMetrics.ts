export interface MedicationMetricItem {
  id: string
  times: string[]
  is_active: boolean
  is_prn: boolean
  start_date?: string | null
  end_date?: string | null
}

export interface MedicationMetricAdministration {
  scheduled_time: string
  status: string
}

export interface MedicationMetricChart {
  days: string[]
  items: MedicationMetricItem[]
  adminMap: Record<string, Record<string, MedicationMetricAdministration[]>>
}

export interface MedicationDailyMetrics {
  dueToday: number
  administeredToday: number
  missedToday: number
}

/** Count real chart slots for a date. A missing administration is due, never inferred missed. */
export function getMedicationDailyMetrics(chart: MedicationMetricChart | null | undefined, date: string): MedicationDailyMetrics {
  const metrics: MedicationDailyMetrics = { dueToday: 0, administeredToday: 0, missedToday: 0 }
  if (!chart?.days.includes(date)) return metrics

  for (const item of chart.items) {
    if (!item.is_active || item.is_prn) continue
    const itemStart = item.start_date?.slice(0, 10)
    const itemEnd = item.end_date?.slice(0, 10)
    if ((itemStart && date < itemStart) || (itemEnd && date > itemEnd)) continue

    for (const time of item.times || []) {
      const slot = new Date(`${date}T${time}:00`)
      const administration = (chart.adminMap[item.id]?.[date] || []).find(entry => {
        const scheduled = new Date(entry.scheduled_time)
        return scheduled.getHours() === slot.getHours() && scheduled.getMinutes() === slot.getMinutes()
      })
      if (administration?.status === 'given') metrics.administeredToday++
      else if (administration?.status === 'missed') metrics.missedToday++
      else if (!administration || administration.status === 'pending') metrics.dueToday++
    }
  }

  return metrics
}

/** People with an active account and at least one active MAR record, counted once. */
export function countPeopleOnActiveMedication(
  people: Array<{ id: string; status?: string | null }> = [],
  records: Array<{ person_id: string; status?: string | null }> = [],
): number {
  const activePeople = new Set(people.filter(person => person.status === 'active').map(person => person.id))
  const medicatedPeople = new Set(
    records
      .filter(record => record.status === 'active' && activePeople.has(record.person_id))
      .map(record => record.person_id),
  )
  return medicatedPeople.size
}
