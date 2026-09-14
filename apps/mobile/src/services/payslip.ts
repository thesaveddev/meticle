import { Linking } from 'react-native'

function money(pence: number | null | undefined) {
  return pence == null ? '£0.00' : `£${(Number(pence) / 100).toFixed(2)}`
}

function mins(h: number) {
  const hrs = Math.floor(h / 60)
  const m = h % 60
  return hrs > 0 ? `${hrs}h ${m}m` : `${m}m`
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface PayslipData {
  userName: string
  userEmail: string
  orgName: string
  monthLabel: string
  summary: {
    total_gross_pay_pence?: number
    total_work_minutes?: number
    total_paid_travel_minutes?: number
    total_travel_minutes?: number
    total_mileage_miles?: number
    hourly_rate_pence?: number
    mileage_rate_pence?: number
    visit_count?: number
  }
  completedVisits: any[]
}

function buildPayslipHTML(data: PayslipData): string {
  const s = data.summary
  const workHours = (s.total_work_minutes || 0) / 60
  const travelHours = (s.total_paid_travel_minutes || 0) / 60
  const mileage = Number(s.total_mileage_miles) || 0
  const hourlyRate = Number(s.hourly_rate_pence || 0)
  const mileageRate = Number(s.mileage_rate_pence || 0)
  const workPay = Math.round(workHours * hourlyRate)
  const travelPay = Math.round(travelHours * hourlyRate)
  const mileagePay = Math.round(mileage * mileageRate)
  const total = workPay + travelPay + mileagePay

  const visitRows = data.completedVisits.map(v => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#1A2332;">${formatDate(v.scheduled_start)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#1A2332;">${v.person_name || 'Client'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#1A2332;">${v.label}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#1A2332;text-align:right;">${v.work_minutes != null ? mins(v.work_minutes) : '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#1A2332;text-align:right;">${Number(v.mileage_miles) > 0 ? `${Number(v.mileage_miles).toFixed(1)} mi` : '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#1A2332;text-align:right;font-weight:600;">${money(v.gross_pay_pence)}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1A2332; background: #fff; }
    .page { padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #1A2332; }
    .logo { font-size: 24px; font-weight: 800; color: #1A2332; letter-spacing: -0.5px; }
    .org { font-size: 13px; color: #6B7280; margin-top: 4px; }
    .payslip-title { text-align: right; }
    .payslip-title h2 { font-size: 18px; font-weight: 700; color: #1A2332; }
    .payslip-title p { font-size: 12px; color: #6B7280; margin-top: 4px; }
    .summary { display: flex; gap: 20px; margin-bottom: 32px; }
    .summary-box { flex: 1; background: #F7F9F7; border-radius: 12px; padding: 16px; text-align: center; }
    .summary-box.hero { background: #1A2332; color: #fff; }
    .summary-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; margin-bottom: 4px; }
    .summary-box.hero .summary-label { color: rgba(255,255,255,0.65); }
    .summary-value { font-size: 20px; font-weight: 800; color: #1A2332; }
    .summary-box.hero .summary-value { color: #fff; }
    .summary-sub { font-size: 11px; color: #6B7280; margin-top: 2px; }
    .summary-box.hero .summary-sub { color: rgba(255,255,255,0.5); }
    .breakdown { margin-bottom: 32px; }
    .breakdown h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #9CA3AF; margin-bottom: 12px; }
    .breakdown-table { width: 100%; border-collapse: collapse; }
    .breakdown-table td { padding: 10px 12px; border-bottom: 1px solid #F3F4F6; font-size: 14px; }
    .breakdown-table .label { color: #6B7280; }
    .breakdown-table .amount { text-align: right; font-weight: 600; color: #1A2332; }
    .breakdown-table .total-row td { border-top: 2px solid #1A2332; border-bottom: none; font-weight: 700; font-size: 16px; padding-top: 14px; }
    .visits { margin-bottom: 32px; }
    .visits h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #9CA3AF; margin-bottom: 12px; }
    .visits table { width: 100%; border-collapse: collapse; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; }
    .visits th { background: #F7F9F7; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6B7280; text-align: left; }
    .visits th:last-child, .visits td:last-child { text-align: right; }
    .footer { text-align: center; padding-top: 20px; border-top: 1px solid #E5E7EB; }
    .footer p { font-size: 11px; color: #9CA3AF; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="logo">MeticleCare</div>
        <div class="org">${data.orgName}</div>
      </div>
      <div class="payslip-title">
        <h2>Payslip</h2>
        <p>${data.monthLabel}</p>
        <p>${data.userName}</p>
        <p>${data.userEmail}</p>
      </div>
    </div>

    <div class="summary">
      <div class="summary-box hero">
        <div class="summary-label">Gross Pay</div>
        <div class="summary-value">${money(total || s.total_gross_pay_pence)}</div>
        <div class="summary-sub">Estimated</div>
      </div>
      <div class="summary-box">
        <div class="summary-label">Calls</div>
        <div class="summary-value">${s.visit_count || 0}</div>
        <div class="summary-sub">completed</div>
      </div>
      <div class="summary-box">
        <div class="summary-label">Work</div>
        <div class="summary-value">${mins(s.total_work_minutes || 0)}</div>
        <div class="summary-sub">paid time</div>
      </div>
      <div class="summary-box">
        <div class="summary-label">Mileage</div>
        <div class="summary-value">${mileage.toFixed(1)} mi</div>
        <div class="summary-sub">driven</div>
      </div>
    </div>

    <div class="breakdown">
      <h3>Pay Breakdown</h3>
      <table class="breakdown-table">
        <tr>
          <td class="label">Work hours (${mins(s.total_work_minutes || 0)} at ${money(hourlyRate)}/hr)</td>
          <td class="amount">${money(workPay)}</td>
        </tr>
        ${travelHours > 0 ? `<tr>
          <td class="label">Travel time (${mins(s.total_paid_travel_minutes || 0)} at ${money(hourlyRate)}/hr)</td>
          <td class="amount">${money(travelPay)}</td>
        </tr>` : ''}
        <tr>
          <td class="label">Mileage (${mileage.toFixed(1)} mi at ${money(mileageRate)}/mi)</td>
          <td class="amount">${money(mileagePay)}</td>
        </tr>
        <tr class="total-row">
          <td>Total Gross Pay</td>
          <td class="amount">${money(total || s.total_gross_pay_pence)}</td>
        </tr>
      </table>
    </div>

    ${data.completedVisits.length > 0 ? `
    <div class="visits">
      <h3>Completed Calls (${data.completedVisits.length})</h3>
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
        <tbody>
          ${visitRows}
        </tbody>
      </table>
    </div>
    ` : ''}

    <div class="footer">
      <p>This is an estimated payslip generated by MeticleCare. Actual pay may vary.</p>
      <p style="margin-top:4px;">Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </div>
  </div>
</body>
</html>`
}

export async function generateAndSharePayslip(data: PayslipData): Promise<boolean> {
  try {
    const html = buildPayslipHTML(data)

    // Try expo-print + sharing first (works in dev builds)
    try {
      const Print = await import('expo-print')
      const Sharing = await import('expo-sharing')
      if (await Sharing.isAvailableAsync()) {
        const { uri } = await Print.printToFileAsync({ html, base64: false })
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Save payslip',
          UTI: 'com.adobe.pdf',
        })
        return true
      }
    } catch { /* expo-print not available in Expo Go */ }

    // Fallback: open HTML in browser for printing/saving
    try {
      // Use a Blob URL approach — encode HTML and open via the browser
      const encoded = btoa(unescape(encodeURIComponent(html)))
      await Linking.openURL(`data:text/html;base64,${encoded}`)
      return true
    } catch { /* fallback failed */ }

    return false
  } catch {
    return false
  }
}
