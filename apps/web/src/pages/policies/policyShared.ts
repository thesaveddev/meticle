import { CATEGORY_COLORS, P } from '../../styles/tokens'
import { NOTICE_COLORS } from '../../theme/noticeTokens'

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

/**
 * Each policy category draws its hue from the shared categorical ramp
 * (`CATEGORY_COLORS` in styles/tokens.ts) rather than a page-local set: ten
 * categories need ten readable hues, and a ramp declared per page is a ramp
 * that drifts the moment a second page wants the same categories.
 */
export const categoryColors: Record<string, string> = {
  'Risk Management': CATEGORY_COLORS.crimson,
  'Human Resources': CATEGORY_COLORS.blue,
  'Health & Safety': CATEGORY_COLORS.amber,
  'GDPR & Data Protection': CATEGORY_COLORS.violet,
  'Infection Control': CATEGORY_COLORS.teal,
  'Equality & Diversity': CATEGORY_COLORS.green,
  'Mental Health': CATEGORY_COLORS.cyan,
  'Fire Safety': CATEGORY_COLORS.rust,
  Medication: CATEGORY_COLORS.mint,
  Safeguarding: CATEGORY_COLORS.plum,
}

export const INK = P.navy
export const MUTED = P.slate
export const NAVY = P.primary
export const EMERALD = NOTICE_COLORS.success.fg
export const BONE = P.warm
export const HAIRLINE = P.hairline

export function statusLabel(status: string) {
  return status === 'active' ? 'Published' : status.charAt(0).toUpperCase() + status.slice(1)
}

export function statusColor(status: string) {
  if (status === 'published' || status === 'active') return EMERALD
  if (status === 'archived') return '#51637A'
  return '#9A6700'
}

export function formatDate(date?: string) {
  if (!date) return 'Not set'
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function isReviewDue(date?: string) {
  return Boolean(date && new Date(`${date}T23:59:59`) < new Date())
}
