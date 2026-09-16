import { query } from '../../shared/database'
import { EmailService } from '../../shared/utils/email.service'
import logger from '../../shared/utils/logger'
import * as repo from './homecare.repository'
import type { PayslipData, PayslipMonthTotal } from './payslip.pdf'

export interface EarningsSummary {
  total_work_minutes: number
  total_paid_travel_minutes: number
  total_travel_minutes: number
  total_mileage_miles: number
  total_gross_pay_pence: number
  hourly_rate_pence: number | null
  mileage_rate_pence: number | null
  visit_count: number
}

/**
 * Single definition of how a carer's earnings are calculated from timesheet
 * rows. The Earnings screens and the payslip both use it so the figure a carer
 * sees on screen is the figure that appears on their payslip.
 */
export function summariseEarnings(visits: any[]): EarningsSummary {
  const sum = (pick: (v: any) => number) => visits.reduce((total, v) => total + (Number(pick(v)) || 0), 0)
  const firstRate = (key: string) => visits.find(v => v[key] != null)?.[key] ?? null

  return {
    total_work_minutes: sum(v => v.work_minutes),
    total_paid_travel_minutes: sum(v => v.paid_travel_minutes),
    total_travel_minutes: sum(v => v.travel_minutes),
    total_mileage_miles: sum(v => v.mileage_miles),
    total_gross_pay_pence: sum(v => v.gross_pay_pence),
    hourly_rate_pence: firstRate('hourly_rate_pence'),
    mileage_rate_pence: firstRate('mileage_rate_pence'),
    visit_count: visits.length,
  }
}

/**
 * Calendar-month bounds for a period, in YYYY-MM-DD form (inclusive of both
 * ends). A month index outside 0-11 rolls the year, so the pay period that
 * closes in December is reported as December, not "month 0".
 */
export function monthBounds(year: number, monthIndex: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0')
  const first = new Date(Date.UTC(year, monthIndex, 1))
  const last = new Date(Date.UTC(year, monthIndex + 1, 0))
  return {
    from: `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-01`,
    to: `${last.getUTCFullYear()}-${pad(last.getUTCMonth() + 1)}-${pad(last.getUTCDate())}`,
  }
}

export function periodLabel(from: string): string {
  const [year, month] = from.split('-').map(Number)
  return new Date(year, (month || 1) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/** The pay period that ended most recently: the calendar month before `now`. */
export function previousPeriod(now = new Date()): { from: string; to: string; label: string } {
  const bounds = monthBounds(now.getUTCFullYear(), now.getUTCMonth() - 1)
  return { ...bounds, label: periodLabel(bounds.from) }
}

/** Year-to-date earnings for a carer, through the end of a given date. */
export async function getYearToDateTotals(orgId: string, staffId: string, throughDate: string): Promise<PayslipData['ytd']> {
  const year = Number(throughDate.slice(0, 4))
  const rows = await repo.getStaffYearToDateMonths(orgId, staffId, `${year}-01-01`, throughDate)
  const months: PayslipMonthTotal[] = rows.map(row => ({
    month: row.month,
    gross_pay_pence: Number(row.gross_pay_pence) || 0,
    work_minutes: Number(row.work_minutes) || 0,
    mileage_miles: Number(row.mileage_miles) || 0,
    visit_count: Number(row.visit_count) || 0,
  }))

  return {
    year,
    total_gross_pay_pence: months.reduce((total, m) => total + m.gross_pay_pence, 0),
    total_work_minutes: months.reduce((total, m) => total + m.work_minutes, 0),
    total_mileage_miles: months.reduce((total, m) => total + Number(m.mileage_miles || 0), 0),
    visit_count: months.reduce((total, m) => total + m.visit_count, 0),
    months,
  }
}

export async function buildPayslipData(orgId: string, staffId: string, from: string, to: string): Promise<PayslipData | null> {
  const context = await repo.getPayslipStaffContext(orgId, staffId)
  if (!context) return null

  const visits = await repo.getStaffPeriodEarnings(orgId, staffId, from, to)
  const summary = summariseEarnings(visits)
  const ytd = await getYearToDateTotals(orgId, staffId, to)

  const name = [context.first_name, context.last_name].filter(Boolean).join(' ').trim()

  return {
    orgName: context.org_name || 'Meticle Care',
    userName: name || context.email,
    userEmail: context.email,
    periodFrom: from,
    periodTo: to,
    periodLabel: periodLabel(from),
    summary,
    ytd,
    visits,
  }
}

export async function renderPayslipPdf(data: PayslipData): Promise<Buffer> {
  const { buildPayslipPdf } = await import('./payslip.pdf')
  return buildPayslipPdf(data)
}

/**
 * Guard against re-sending a payslip for a period that has already been emailed.
 * The queue only deduplicates pending rows, so without this check a second run
 * after delivery would send a duplicate payslip.
 */
async function payslipAlreadyQueued(to: string, subject: string): Promise<boolean> {
  const existing = await query(
    `SELECT 1 FROM email_queue WHERE to_email = $1 AND subject = $2 LIMIT 1`,
    [to, subject]
  )
  return existing.rows.length > 0
}

export function payslipEmailSubject(label: string): string {
  return `Your payslip — ${label}`
}

/** Build and queue the payslip email for one carer. Returns true when queued. */
export async function queuePayslipEmail(orgId: string, staffId: string, from: string, to: string): Promise<boolean> {
  const data = await buildPayslipData(orgId, staffId, from, to)
  if (!data) return false
  if (data.summary.visit_count === 0) return false

  const subject = payslipEmailSubject(data.periodLabel)
  if (await payslipAlreadyQueued(data.userEmail, subject)) return false

  const pdf = await renderPayslipPdf(data)
  await EmailService.sendPayslipEmail(data.userEmail, data.userName, data.orgName, data.periodLabel, [
    { filename: `payslip-${data.periodFrom.replace(/-/g, '')}.pdf`, content: pdf, contentType: 'application/pdf' },
  ])
  return true
}

/**
 * Email every carer their payslip for a closed pay period. Runs across all
 * organisations; each payslip is built inside its own tenant boundary and one
 * failure never stops the rest of the run.
 */
export async function sendPayslipsForPeriod(from: string, to: string): Promise<{ queued: number; skipped: number; failed: number }> {
  const carers = await repo.listCarersWithEarningsForPeriod(from, to)
  let queued = 0
  let skipped = 0
  let failed = 0

  for (const carer of carers) {
    try {
      const sent = await queuePayslipEmail(carer.org_id, carer.staff_id, from, to)
      if (sent) queued += 1
      else skipped += 1
    } catch (err) {
      failed += 1
      logger.error({ err, orgId: carer.org_id, staffId: carer.staff_id, from, to }, 'Payslip email failed for carer')
    }
  }

  return { queued, skipped, failed }
}

/** End-of-pay-period entry point: queues payslips for the month that just closed. */
export async function sendMonthlyPayslips(now = new Date()): Promise<{ period: string; queued: number; skipped: number; failed: number }> {
  const period = previousPeriod(now)
  const result = await sendPayslipsForPeriod(period.from, period.to)
  return { period: period.label, ...result }
}
