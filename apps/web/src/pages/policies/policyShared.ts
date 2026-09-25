export interface Policy {
  id: string
  title: string
  category: string
  content: string
  version: string
  status: string
  updated_by?: string
  updated_by_name?: string
  review_due_at?: string
  created_at: string
  updated_at?: string
}

export interface Channel {
  id: string
  name: string
  type: string
}

export const CATEGORIES = [
  'Risk Management',
  'Human Resources',
  'Health & Safety',
  'GDPR & Data Protection',
  'Infection Control',
  'Equality & Diversity',
  'Mental Health',
  'Fire Safety',
  'Medication',
  'Safeguarding',
]

export const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
]

export const categoryColors: Record<string, string> = {
  'Risk Management': '#B42318',
  'Human Resources': '#0F4C81',
  'Health & Safety': '#B54708',
  'GDPR & Data Protection': '#6941C6',
  'Infection Control': '#027A8B',
  'Equality & Diversity': '#087443',
  'Mental Health': '#087E8B',
  'Fire Safety': '#C4320A',
  Medication: '#047857',
  Safeguarding: '#9F1239',
}

export const INK = '#17212B'
export const MUTED = '#607080'
export const NAVY = '#0F4C81'
export const EMERALD = '#047857'
export const BONE = '#F7F4EE'
export const HAIRLINE = '#E2E8F0'

export function statusLabel(status: string) {
  return status === 'active' ? 'Published' : status.charAt(0).toUpperCase() + status.slice(1)
}

export function statusColor(status: string) {
  if (status === 'published' || status === 'active') return EMERALD
  if (status === 'archived') return '#667085'
  return '#B54708'
}

export function formatDate(date?: string) {
  if (!date) return 'Not set'
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function isReviewDue(date?: string) {
  return Boolean(date && new Date(`${date}T23:59:59`) < new Date())
}
