import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  addMonthsToDateString,
  bumpVersion,
  reminderForReviewDate,
  renderPolicyRichText,
  todayPlusMonths,
} from './policyShared'

describe('policyShared version helpers', () => {
  it('bumps the minor version for an edit', () => {
    expect(bumpVersion('1.0')).toBe('1.1')
    expect(bumpVersion('2.9')).toBe('2.10')
  })

  it('leaves unparseable versions alone rather than mangling them', () => {
    expect(bumpVersion('final')).toBe('final')
  })

  it('rolls review presets forward by calendar months', () => {
    expect(addMonthsToDateString('2027-01-15', 1)).toBe('2027-02-15')
    expect(addMonthsToDateString('2027-01-31', 1)).toBe('2027-03-03')
  })

  it('puts the reminder a month before the review date', () => {
    expect(reminderForReviewDate('2027-09-25')).toBe('25 Aug 2027')
    expect(reminderForReviewDate(undefined)).toBe('Not set')
  })

  it('builds an ISO date months from today', () => {
    expect(todayPlusMonths(12)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('renderPolicyRichText', () => {
  it('renders headings, lists, bold and safe links', () => {
    render(<div>{renderPolicyRichText('### Purpose\n\n- Keep people safe\n- Record decisions\n\nRead the **full guide** at [CQC](https://www.cqc.org.uk).')}</div>)
    expect(screen.getByText('Purpose').tagName).toBe('DIV')
    expect(screen.getByText('Keep people safe').tagName).toBe('LI')
    expect(screen.getByText('full guide').tagName).toBe('STRONG')
    const link = screen.getByText('CQC')
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('https://www.cqc.org.uk')
  })

  it('keeps plain paragraphs and line breaks readable', () => {
    render(<div>{renderPolicyRichText('First line\nSecond line')}</div>)
    expect(screen.getByText(/First line/)).toBeDefined()
    expect(screen.getByText(/Second line/)).toBeDefined()
  })

  it('refuses non-http links and never injects HTML', () => {
    render(<div>{renderPolicyRichText('See [notes](javascript:alert(1)) and <img src=x onerror=alert(1)>.')}</div>)
    expect(screen.queryByRole('link')).toBeNull()
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByText(/notes/)).toBeDefined()
  })
})
