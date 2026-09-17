export function parseDateOnly(value: string | Date): Date {
  const raw = String(value)
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)
}

export function formatDateOnly(value: string | Date | null | undefined, fallback = '—'): string {
  if (!value) return fallback
  const date = parseDateOnly(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatTimeOnly(value: string | Date | null | undefined, fallback = '—'): string {
  if (!value) return fallback
  const raw = String(value)
  const clock = raw.match(/^(\d{1,2}):(\d{2})/)
  if (clock) return `${clock[1].padStart(2, '0')}:${clock[2]}`
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? raw.replace(/\.\d+Z?$/i, '').slice(0, 5)
    : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
