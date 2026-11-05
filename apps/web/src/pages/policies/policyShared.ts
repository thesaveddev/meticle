import { createElement, Fragment, type ReactNode } from 'react'
import { CATEGORY_COLORS, P } from '../../styles/tokens'
import { NOTICE_COLORS } from '../../theme/noticeTokens'

export interface Policy {
  id: string
  title: string
  category: string
  content: string
  version: string
  status: string
  acknowledged_count?: number
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

export const REVIEW_SOON_DAYS = 30

export function isReviewSoon(date?: string) {
  if (!date || isReviewDue(date)) return false
  const diffDays = (new Date(`${date}T23:59:59`).getTime() - Date.now()) / 86_400_000
  return diffDays <= REVIEW_SOON_DAYS
}

export type ReviewState = 'overdue' | 'soon' | 'current'

export function reviewState(date?: string): ReviewState {
  if (isReviewDue(date)) return 'overdue'
  if (isReviewSoon(date)) return 'soon'
  return 'current'
}

export interface PolicyVersion {
  id: string
  version: string
  title: string
  category: string
  status: string
  what_changed?: string | null
  created_by_name?: string
  created_at: string
}

/**
 * The version the Edit dialog pre-fills: saving an edited policy always mints
 * the next minor version (5.10: "saving creates version 1.1"), so the version
 * history the Delete dialog warns about actually grows. Unparseable versions
 * are left alone rather than mangled.
 */
export function bumpVersion(version: string): string {
  const match = /^(\d+)\.(\d+)$/.exec(version.trim())
  if (!match) return version
  return `${match[1]}.${parseInt(match[2], 10) + 1}`
}

export function addMonthsToDateString(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const rolled = new Date(year, month - 1 + months, day)
  return `${rolled.getFullYear()}-${String(rolled.getMonth() + 1).padStart(2, '0')}-${String(rolled.getDate()).padStart(2, '0')}`
}

export function todayPlusMonths(months: number): string {
  const now = new Date()
  const rolled = new Date(now.getFullYear(), now.getMonth() + months, now.getDate())
  return `${rolled.getFullYear()}-${String(rolled.getMonth() + 1).padStart(2, '0')}-${String(rolled.getDate()).padStart(2, '0')}`
}

/**
 * When the review reminder goes out: a month before the review is due (5.10
 * Set review date: "We'll remind you on 25 Aug 2027, a month before.").
 * `T12:00:00` pins the parse to noon so the date cannot slip a day in timezones
 * behind UTC — the same reason `isReviewDue` parses at end of day.
 */
export function reminderForReviewDate(date?: string): string {
  if (!date) return 'Not set'
  const [year, month, day] = date.split('-').map(Number)
  const reminder = new Date(year, month - 2, day, 12, 0, 0)
  return reminder.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * The Add/Edit dialog's formatting toolbar writes a small markdown subset
 * (headings, bold, lists, links), and the detail page reads it back here.
 * Everything renders through `createElement` text children, so policy content
 * can never inject HTML — a link that is not http(s) renders as plain text.
 */
const INLINE_PATTERN = /(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  INLINE_PATTERN.lastIndex = 0
  let key = 0
  while ((match = INLINE_PATTERN.exec(text)) !== null) {
    if (match.index > last) nodes.push(createElement(Fragment, { key: `${keyPrefix}-${key++}` }, text.slice(last, match.index)))
    const token = match[0]
    if (token.startsWith('**')) {
      nodes.push(createElement('strong', { key: `${keyPrefix}-${key++}` }, token.slice(2, -2)))
    } else {
      const labelEnd = token.indexOf(']')
      const label = token.slice(1, labelEnd)
      const url = token.slice(labelEnd + 2, -1)
      nodes.push(createElement('a', { key: `${keyPrefix}-${key++}`, href: url, target: '_blank', rel: 'noopener noreferrer' }, label))
    }
    last = match.index + token.length
  }
  if (last < text.length) nodes.push(createElement(Fragment, { key: `${keyPrefix}-${key++}` }, text.slice(last)))
  return nodes
}

export function renderPolicyRichText(content: string): ReactNode {
  const blocks = content.split(/\n{2,}/)
  return blocks.map((block, index) => {
    const key = `block-${index}`
    if (block.startsWith('### ')) {
      return createElement('div', { key, style: { fontWeight: 700, fontSize: '1.02rem', margin: index === 0 ? '0 0 4px' : '14px 0 4px', color: INK } },
        ...renderInline(block.slice(4).trim(), key))
    }
    const lines = block.split('\n')
    if (lines.length > 1 && lines.every((line) => /^\s*[-•]\s+/.test(line))) {
      return createElement('ul', { key, style: { margin: '4px 0', paddingLeft: 22, lineHeight: 1.85 } },
        ...lines.map((line, lineIndex) =>
          createElement('li', { key: `${key}-${lineIndex}` }, ...renderInline(line.replace(/^\s*[-•]\s+/, ''), `${key}-${lineIndex}`))))
    }
    const paragraphLines: ReactNode[] = []
    lines.forEach((line, lineIndex) => {
      if (lineIndex > 0) paragraphLines.push(createElement('br', { key: `${key}-br-${lineIndex}` }))
      paragraphLines.push(...renderInline(line, `${key}-${lineIndex}`))
    })
    return createElement('p', { key, style: { margin: index === 0 ? '0 0 10px' : '10px 0' } }, ...paragraphLines)
  })
}
