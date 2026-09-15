import { generatePdf } from '../../shared/pdf/pdf.service'

export interface PayslipVisitLine {
  scheduled_start: string
  person_name: string | null
  label: string | null
  work_minutes: number | null
  paid_travel_minutes: number | null
  mileage_miles: number | null
  gross_pay_pence: number | null
}

export interface PayslipMonthTotal {
  /** Calendar month key, e.g. 2026-03 */
  month: string
  gross_pay_pence: number
  work_minutes: number
  mileage_miles: number
  visit_count: number
}

export interface PayslipData {
  orgName: string
  userName: string
  userEmail: string
  periodFrom: string
  periodTo: string
  periodLabel: string
  summary: {
    total_gross_pay_pence: number
    total_work_minutes: number
    total_paid_travel_minutes: number
    total_mileage_miles: number
    hourly_rate_pence: number | null
    mileage_rate_pence: number | null
    visit_count: number
  }
  ytd: {
    year: number
    total_gross_pay_pence: number
    total_work_minutes: number
    total_mileage_miles: number
    visit_count: number
    months: PayslipMonthTotal[]
  }
  visits: PayslipVisitLine[]
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(pence: number | null | undefined): string {
  if (pence == null) return '£0.00'
  return `£${(Number(pence) / 100).toFixed(2)}`
}

function hours(minutes: number | null | undefined): string {
  const total = Math.max(0, Math.round(Number(minutes) || 0))
  const hrs = Math.floor(total / 60)
  const mins = total % 60
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtMonth(key: string): string {
  const [year, month] = key.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export function buildPayslipHtml(data: PayslipData): string {
  const s = data.summary
  const workHours = (Number(s.total_work_minutes) || 0) / 60
  const travelHours = (Number(s.total_paid_travel_minutes) || 0) / 60
  const mileage = Number(s.total_mileage_miles) || 0
  const hourlyRate = Number(s.hourly_rate_pence || 0)
  const mileageRate = Number(s.mileage_rate_pence || 0)
  const workPay = Math.round(workHours * hourlyRate)
  const travelPay = Math.round(travelHours * hourlyRate)
  const mileagePay = Math.round(mileage * mileageRate)
  const computedTotal = workPay + travelPay + mileagePay
  const grossTotal = computedTotal || Number(s.total_gross_pay_pence) || 0

  const visitRows = data.visits.map(v => `
    <tr>
      <td>${fmtDate(v.scheduled_start)}</td>
      <td>${esc(v.person_name || 'Client')}</td>
      <td>${esc(v.label || '—')}</td>
      <td class="num">${hours(v.work_minutes)}</td>
      <td class="num">${Number(v.mileage_miles) > 0 ? `${Number(v.mileage_miles).toFixed(1)} mi` : '—'}</td>
      <td class="num strong">${money(v.gross_pay_pence)}</td>
    </tr>`).join('')

  const monthRows = data.ytd.months.map(m => `
    <tr>
      <td>${fmtMonth(m.month)}</td>
      <td class="num">${m.visit_count}</td>
      <td class="num">${hours(m.work_minutes)}</td>
      <td class="num">${Number(m.mileage_miles || 0).toFixed(1)} mi</td>
      <td class="num strong">${money(m.gross_pay_pence)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payslip ${esc(data.periodLabel)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1A2332; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 2px solid #1A2332; }
    .brand { font-size: 20px; font-weight: 800; letter-spacing: -0.4px; }
    .org { font-size: 12px; color: #6B7280; margin-top: 3px; }
    .title { text-align: right; }
    .title h1 { font-size: 17px; font-weight: 700; }
    .title p { font-size: 11px; color: #6B7280; margin-top: 2px; }
    .summary { display: flex; gap: 10px; margin: 18px 0; }
    .summary-box { flex: 1; padding: 12px; border-radius: 8px; text-align: center; background: #F7F9F7; }
    .summary-box.hero { background: #1A2332; color: #fff; }
    .summary-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #6B7280; }
    .summary-box.hero .summary-label { color: rgba(255,255,255,0.65); }
    .summary-value { font-size: 17px; font-weight: 800; margin-top: 3px; }
    .summary-sub { font-size: 10px; color: #6B7280; }
    .summary-box.hero .summary-sub { color: rgba(255,255,255,0.5); }
    h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #9CA3AF; margin: 18px 0 8px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #F7F9F7; padding: 7px 9px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; color: #6B7280; text-align: left; }
    td { padding: 7px 9px; border-bottom: 1px solid #E5E7EB; font-size: 11px; }
    .num { text-align: right; }
    .strong { font-weight: 700; }
    .breakdown td.label { color: #6B7280; }
    .breakdown .total td { border-top: 2px solid #1A2332; border-bottom: none; font-weight: 700; font-size: 13px; padding-top: 10px; }
    .ytd .total td { border-top: 2px solid #1A2332; border-bottom: none; font-weight: 700; }
    .muted { color: #9CA3AF; }
    .footer { margin-top: 22px; padding-top: 10px; border-top: 1px solid #E5E7EB; text-align: center; }
    .footer p { font-size: 10px; color: #9CA3AF; margin-top: 3px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">MeticleCare</div>
      <div class="org">${esc(data.orgName)}</div>
    </div>
    <div class="title">
      <h1>Payslip</h1>
      <p>${esc(data.periodLabel)}</p>
      <p>${esc(data.userName)}</p>
      <p>${esc(data.userEmail)}</p>
    </div>
  </div>

  <div class="summary">
    <div class="summary-box hero">
      <div class="summary-label">Gross Pay</div>
      <div class="summary-value">${money(grossTotal)}</div>
      <div class="summary-sub">Estimated</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Calls</div>
      <div class="summary-value">${s.visit_count || 0}</div>
      <div class="summary-sub">completed</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Work</div>
      <div class="summary-value">${hours(s.total_work_minutes)}</div>
      <div class="summary-sub">paid time</div>
    </div>
    <div class="summary-box">
      <div class="summary-label">Mileage</div>
      <div class="summary-value">${mileage.toFixed(1)} mi</div>
      <div class="summary-sub">driven</div>
    </div>
  </div>

  <h2>Pay breakdown — ${esc(data.periodLabel)}</h2>
  <table class="breakdown">
    <tr>
      <td class="label">Work hours (${hours(s.total_work_minutes)} at ${money(hourlyRate)}/hr)</td>
      <td class="num strong">${money(workPay)}</td>
    </tr>
    ${travelHours > 0 ? `<tr>
      <td class="label">Travel time (${hours(s.total_paid_travel_minutes)} at ${money(hourlyRate)}/hr)</td>
      <td class="num strong">${money(travelPay)}</td>
    </tr>` : ''}
    <tr>
      <td class="label">Mileage (${mileage.toFixed(1)} mi at ${money(mileageRate)}/mi)</td>
      <td class="num strong">${money(mileagePay)}</td>
    </tr>
    <tr class="total">
      <td>Total gross pay</td>
      <td class="num">${money(grossTotal)}</td>
    </tr>
  </table>

  <h2>Year to date — ${data.ytd.year}</h2>
  <table class="ytd">
    <thead>
      <tr>
        <th>Month</th>
        <th style="text-align:right">Calls</th>
        <th style="text-align:right">Work</th>
        <th style="text-align:right">Mileage</th>
        <th style="text-align:right">Gross pay</th>
      </tr>
    </thead>
    <tbody>
      ${monthRows || `<tr><td colspan="5" class="muted">No earnings recorded in ${data.ytd.year} yet.</td></tr>`}
      <tr class="total">
        <td>Total ${data.ytd.year} to date</td>
        <td class="num">${data.ytd.visit_count}</td>
        <td class="num">${hours(data.ytd.total_work_minutes)}</td>
        <td class="num">${Number(data.ytd.total_mileage_miles || 0).toFixed(1)} mi</td>
        <td class="num">${money(data.ytd.total_gross_pay_pence)}</td>
      </tr>
    </tbody>
  </table>

  ${data.visits.length > 0 ? `
  <h2>Completed calls (${data.visits.length})</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Client</th>
        <th>Call</th>
        <th style="text-align:right">Work</th>
        <th style="text-align:right">Miles</th>
        <th style="text-align:right">Pay</th>
      </tr>
    </thead>
    <tbody>${visitRows}</tbody>
  </table>` : ''}

  <div class="footer">
    <p>Period ${fmtDate(data.periodFrom)} — ${fmtDate(data.periodTo)}</p>
    <p>This is an estimated payslip generated by MeticleCare from approved timesheet data. Actual pay may vary and statutory deductions are not calculated here.</p>
    <p>Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  </div>
</body>
</html>`
}

export async function buildPayslipPdf(data: PayslipData): Promise<Buffer> {
  return generatePdf(buildPayslipHtml(data), {
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="font-size:9px;color:#9CA3AF;width:100%;text-align:center;padding:5px 15mm">MeticleCare payslip · <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
  })
}
