import { generatePdf } from '../../shared/pdf/pdf.service'

export interface InvoiceLineItem {
  person_name: string
  package_name: string
  visit_label: string
  scheduled_start: string
  delivered_minutes: number
  client_rate_pence: number | null
  net_amount_pence: number
  vat_rate: number | null
  vat_amount_pence: number
  gross_amount_pence: number
  billing_status: string
  funding_applied: string | null
}

export interface InvoiceData {
  invoice_number: string
  invoice_date: string
  tax_point: string
  period_from: string
  period_to: string
  status: string
  subtotal_pence: number
  vat_rate: number | null
  vat_inclusive: boolean
  vat_amount_pence: number
  gross_amount_pence: number
  funding_breakdown: Record<string, { count: number; net_pence: number; vat_pence: number; gross_pence: number; billable_count: number }>
  voided_at: string | null
  void_reason: string | null
  lines: InvoiceLineItem[]
}

export interface SupplierInfo {
  name: string
  address: string
  vat_number: string | null
  company_number: string | null
  email: string
  phone: string | null
  color: string
}

export interface CustomerInfo {
  name: string
  address: string | null
  contact_email: string | null
}

function pence(n: number): string {
  return (n / 100).toFixed(2)
}

function gbp(n: number): string {
  return `£${pence(n)}`
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtShortDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function buildClientInvoiceHtml(data: InvoiceData, supplier: SupplierInfo, customer: CustomerInfo): string {
  const { invoice_number, invoice_date, tax_point, period_from, period_to, status, subtotal_pence, vat_rate, vat_amount_pence, gross_amount_pence, funding_breakdown, lines } = data
  const isVoid = status === 'void'
  const primary = supplier.color || '#0F4C81'

  // Status badge
  const statusBadge = isVoid
    ? `<span style="display:inline-block;background:#9CA3AF;color:#fff;padding:4px 14px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase">VOID</span>`
    : `<span style="display:inline-block;background:#059669;color:#fff;padding:4px 14px;border-radius:6px;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase">ISSUED</span>`

  // Line items
  const lineRows = lines.filter(l => l.billing_status === 'billable').map(line => `
    <tr>
      <td>
        <div style="font-weight:600;color:#1F2937">${line.person_name}</div>
        <div style="font-size:11px;color:#9CA3AF;margin-top:2px">${line.package_name} — ${line.visit_label || 'Visit'}</div>
      </td>
      <td style="text-align:center">${fmtShortDate(line.scheduled_start)}</td>
      <td style="text-align:center">${line.delivered_minutes} min</td>
      <td style="text-align:right">${line.client_rate_pence != null ? gbp(line.client_rate_pence) + '/hr' : '—'}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums">${gbp(line.net_amount_pence)}</td>
      <td style="text-align:center">${line.vat_rate != null ? line.vat_rate + '%' : '—'}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums">${gbp(line.vat_amount_pence)}</td>
      <td style="text-align:right;font-weight:600;font-variant-numeric:tabular-nums">${gbp(line.gross_amount_pence)}</td>
    </tr>`).join('')

  // Funding breakdown rows
  const fundingRows = Object.entries(funding_breakdown).filter(([, v]) => v.billable_count > 0).map(([key, v]) => `
    <tr>
      <td style="text-transform:capitalize">${key.replace('_', ' ')}</td>
      <td style="text-align:center">${v.billable_count} of ${v.count}</td>
      <td style="text-align:right">${gbp(v.net_pence)}</td>
      <td style="text-align:right">${gbp(v.vat_pence)}</td>
      <td style="text-align:right;font-weight:600">${gbp(v.gross_pence)}</td>
    </tr>`).join('')

  const hasMultipleRates = lines.some(l => l.vat_rate !== null && l.vat_rate !== (vat_rate ?? 0))

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #1F2937; font-size: 12px; line-height: 1.5; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .page { padding: 36px 44px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
  .brand-name { font-size: 24px; font-weight: 800; color: ${primary}; letter-spacing: -0.5px; }
  .brand-details { font-size: 11px; color: #6B7280; margin-top: 6px; line-height: 1.6; }
  .invoice-meta { text-align: right; }
  .invoice-label { font-size: 10px; color: #9CA3AF; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; }
  .invoice-number { font-size: 22px; font-weight: 800; color: #1F2937; letter-spacing: -0.5px; }
  .invoice-date { font-size: 11px; color: #6B7280; margin-top: 2px; }
  .accent-bar { height: 3px; background: linear-gradient(90deg, ${primary} 0%, ${primary}CC 100%); border-radius: 2px; margin-bottom: 24px; }
  .info-grid { display: flex; gap: 24px; margin-bottom: 24px; }
  .info-block { flex: 1; }
  .info-label { font-size: 9px; font-weight: 700; color: #9CA3AF; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px; }
  .info-value { font-size: 12px; font-weight: 600; color: #1F2937; line-height: 1.5; }
  .info-sub { font-size: 11px; color: #6B7280; font-weight: 400; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { text-align: left; font-size: 9px; font-weight: 700; color: #9CA3AF; letter-spacing: 1px; text-transform: uppercase; padding: 10px 12px; border-bottom: 2px solid #E5E7EB; background: #F9FAFB; }
  td { padding: 10px 12px; border-bottom: 1px solid #F3F4F6; font-size: 11px; color: #374151; vertical-align: top; }
  tr:last-child td { border-bottom: 2px solid #E5E7EB; }
  .totals { display: flex; justify-content: flex-end; margin-bottom: 24px; }
  .totals-table { width: 300px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #6B7280; }
  .totals-row.total { border-top: 2px solid #1F2937; margin-top: 4px; padding-top: 10px; font-size: 16px; font-weight: 800; color: #1F2937; }
  .totals-row.total .value { color: ${primary}; }
  .section-title { font-size: 9px; font-weight: 700; color: #9CA3AF; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px; margin-top: 16px; }
  .terms { font-size: 10px; color: #9CA3AF; line-height: 1.6; margin-bottom: 20px; }
  .footer { border-top: 1px solid #E5E7EB; padding-top: 12px; display: flex; justify-content: space-between; font-size: 9px; color: #9CA3AF; }
  .mtd-badge { display: inline-block; background: #EFF6FF; color: #1D4ED8; padding: 3px 10px; border-radius: 4px; font-size: 9px; font-weight: 600; letter-spacing: 0.5px; }
</style></head><body>
<div class="page">

  <div class="header">
    <div>
      <div class="brand-name">${supplier.name}</div>
      <div class="brand-details">
        ${supplier.address.replace(/\n/g, '<br>')}
        ${supplier.vat_number ? `<br>VAT Reg. No. ${supplier.vat_number}` : ''}
        ${supplier.company_number ? `<br>Company No. ${supplier.company_number}` : ''}
        <br>${supplier.email}
        ${supplier.phone ? `<br>${supplier.phone}` : ''}
      </div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-label">VAT Invoice</div>
      <div class="invoice-number">${invoice_number}</div>
      <div class="invoice-date">Issued ${fmtDate(invoice_date)}</div>
      <div style="margin-top:6px">${statusBadge}</div>
    </div>
  </div>

  <div class="accent-bar"></div>

  <div class="info-grid">
    <div class="info-block">
      <div class="info-label">Bill To</div>
      <div class="info-value">${customer.name}</div>
      ${customer.address ? `<div class="info-sub">${customer.address}</div>` : ''}
      ${customer.contact_email ? `<div class="info-sub">${customer.contact_email}</div>` : ''}
    </div>
    <div class="info-block">
      <div class="info-label">Tax Point</div>
      <div class="info-value">${fmtDate(tax_point)}</div>
      <div class="info-sub">Period: ${fmtShortDate(period_from)} – ${fmtShortDate(period_to)}</div>
    </div>
    <div class="info-block">
      <div class="info-label">Payment Terms</div>
      <div class="info-value">Net 30 days</div>
      <div class="info-sub">Due by ${fmtDate(new Date(new Date(invoice_date).getTime() + 30 * 86400000).toISOString())}</div>
    </div>
  </div>

  <!-- Line Items -->
  <div class="section-title">Services Supplied</div>
  <table>
    <thead>
      <tr>
        <th>Client / Package</th>
        <th style="text-align:center">Date</th>
        <th style="text-align:center">Duration</th>
        <th style="text-align:right">Rate</th>
        <th style="text-align:right">Net</th>
        <th style="text-align:center">VAT%</th>
        <th style="text-align:right">VAT</th>
        <th style="text-align:right">Gross</th>
      </tr>
    </thead>
    <tbody>${lineRows || '<tr><td colspan="8" style="text-align:center;color:#9CA3AF;padding:20px">No billable services in this period</td></tr>'}</tbody>
  </table>

  <!-- Totals -->
  <div class="totals">
    <div class="totals-table">
      <div class="totals-row">
        <span>Net Total</span>
        <span>${gbp(subtotal_pence)}</span>
      </div>
      <div class="totals-row">
        <span>VAT${hasMultipleRates ? ' (mixed rates)' : vat_rate != null ? ` (${vat_rate}%)` : ''}</span>
        <span>${gbp(vat_amount_pence)}</span>
      </div>
      <div class="totals-row total">
        <span>Total Due</span>
        <span class="value">${gbp(gross_amount_pence)}</span>
      </div>
    </div>
  </div>

  ${fundingRows.length > 0 ? `
  <!-- Funding Breakdown -->
  <div class="section-title">Funding Breakdown</div>
  <table>
    <thead>
      <tr>
        <th>Funder</th>
        <th style="text-align:center">Visits</th>
        <th style="text-align:right">Net</th>
        <th style="text-align:right">VAT</th>
        <th style="text-align:right">Gross</th>
      </tr>
    </thead>
    <tbody>${fundingRows}</tbody>
  </table>` : ''}

  <!-- Terms -->
  <div class="section-title">Terms &amp; Conditions</div>
  <div class="terms">
    Payment is due within 30 days of the invoice date. Late payments may incur interest at 8% above the Bank of England base rate plus a fixed charge of £40 per invoice, in accordance with the Late Payment of Commercial Debts (Interest) Act 1998.<br><br>
    ${supplier.vat_number ? `This is a VAT invoice issued under the Value Added Tax Act 1994. VAT registration number: ${supplier.vat_number}. All amounts shown include VAT where applicable.` : 'This is a commercial invoice. The supplier is not VAT-registered.'}
  </div>

  <div class="footer">
    <div>
      <span class="mtd-badge">MTD Compliant</span>
      <span style="margin-left:8px">Digital link maintained — source data retained for 6 years</span>
    </div>
    <div style="text-align:right">
      ${supplier.name} — ${supplier.email}<br>
      Invoice ${invoice_number} &bull; ${fmtDate(invoice_date)}
    </div>
  </div>

</div>
</body></html>`
}

export async function generateClientInvoicePdf(data: InvoiceData, supplier: SupplierInfo, customer: CustomerInfo): Promise<Buffer> {
  const html = buildClientInvoiceHtml(data, supplier, customer)
  return generatePdf(html, {
    margin: { top: '10mm', right: '12mm', bottom: '12mm', left: '12mm' },
    headerTemplate: '<div></div>',
    footerTemplate: `<div style="font-size:8px;color:#9CA3AF;width:100%;text-align:center;padding:0 12mm">${supplier.name} | ${data.invoice_number} | Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
  })
}

export function buildMtdDigitalLink(data: InvoiceData, supplier: SupplierInfo, customer: CustomerInfo) {
  return {
    version: '1.0',
    format: 'HMRC_MTD_VAT',
    generated_at: new Date().toISOString(),
    invoice: {
      invoice_number: data.invoice_number,
      invoice_date: data.invoice_date,
      tax_point: data.tax_point,
      period_from: data.period_from,
      period_to: data.period_to,
      status: data.status,
    },
    supplier: {
      name: supplier.name,
      address: supplier.address,
      vat_number: supplier.vat_number,
      company_number: supplier.company_number,
    },
    customer: {
      name: customer.name,
      address: customer.address,
      contact_email: customer.contact_email,
    },
    totals: {
      net_pence: data.subtotal_pence,
      vat_rate: data.vat_rate,
      vat_inclusive: data.vat_inclusive,
      vat_pence: data.vat_amount_pence,
      gross_pence: data.gross_amount_pence,
      currency: 'GBP',
    },
    line_items: data.lines.filter(l => l.billing_status === 'billable').map(l => ({
      description: `${l.person_name} — ${l.package_name} — ${l.visit_label || 'Visit'}`,
      date_of_supply: l.scheduled_start,
      duration_minutes: l.delivered_minutes,
      unit_rate_pence: l.client_rate_pence,
      net_pence: l.net_amount_pence,
      vat_rate: l.vat_rate,
      vat_pence: l.vat_amount_pence,
      gross_pence: l.gross_amount_pence,
    })),
    funding_breakdown: data.funding_breakdown,
    digital_link: {
      source: 'meticle_client_billing',
      billing_run_id: data.invoice_number,
      audit_trail: 'automated_generation_from_approved_billing_run',
      retention_years: 6,
    },
  }
}
