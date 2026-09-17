export function formatDateOnly(value?: string | null, fallback = '—'): string {
  if (!value) return fallback
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : value.slice(0, 10)
  const [year, month, day] = dateOnly.split('-').map(Number)
  if (!year || !month || !day) return fallback
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatTimeOnly(value?: string | null, fallback = '—'): string {
  if (!value) return fallback
  const match = value.match(/(?:T|\s)(\d{2}):(\d{2})/) || value.match(/^(\d{2}):(\d{2})/)
  if (match) return `${match[1]}:${match[2]}`
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function formatTimeRange(start?: string | null, end?: string | null): string {
  return `${formatTimeOnly(start)} – ${formatTimeOnly(end)}`
}

export function localDateInput(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
