import { generatePdf as sharedGeneratePdf } from '../../shared/pdf/pdf.service'

export function buildInvoiceHtml(invoice: any, org: { name?: string; primary_color?: string }): string {
  const amount = parseFloat(invoice.amount || '0').toFixed(2)
  const currency = (invoice.currency || 'gbp').toUpperCase()
  const issued = invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  const paid = invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  const primary = org.primary_color || '#0F4C81'
  const status = invoice.status === 'paid'
    ? '<span style="background:#DCFCE7;color:#166534;padding:4px 12px;border-radius:6px;font-weight:700">PAID</span>'
    : '<span style="background:#FEF3C7;color:#92400E;padding:4px 12px;border-radius:6px;font-weight:700">UPCOMING</span>'
  const now = new Date().toLocaleString()

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1B2430; font-size: 13px; line-height: 1.5; margin: 0; padding: 0; }
  .header { border-bottom: 3px solid ${primary}; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { font-size: 22px; font-weight: 800; color: ${primary}; letter-spacing: 0.5px; }
  .brand small { display: block; font-size: 11px; color: #6B7280; font-weight: 600; letter-spacing: 2px; margin-top: 2px; }
  .inv-title { text-align: right; }
  .inv-title h1 { margin: 0; font-size: 24px; color: ${primary}; }
  .inv-title div { color: #6B7280; font-size: 13px; }
  .bill-to { background: #F7F4EE; border-radius: 8px; padding: 14px 18px; margin: 20px 0; }
  .bill-to .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6B7280; margin-bottom: 4px; }
  .bill-to .name { font-size: 16px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { text-align: left; color: #6B7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #E5E7EB; padding: 8px 10px; }
  td { padding: 12px 10px; border-bottom: 1px solid #F3F4F6; }
  .amount-row td { font-size: 15px; }
  .total { text-align: right; font-size: 20px; font-weight: 800; color: ${primary}; }
  .status-line { margin: 8px 0 4px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #D1D5DB; font-size: 10px; color: #9CA3AF; text-align: center; }
</style></head><body>
  <div class="header">
    <div>
      <div class="brand">Meticle<small>CARE PLATFORM</small></div>
      <div style="margin-top:8px;font-size:12px;color:#6B7280">Invoice</div>
    </div>
    <div class="inv-title">
      <h1>${invoice.invoice_number || 'INVOICE'}</h1>
      <div>${now}</div>
      <div class="status-line">${status}</div>
    </div>
  </div>

  <div class="bill-to">
    <div class="label">Billed to</div>
    <div class="name">${org.name || 'Meticle customer'}</div>
  </div>

  <table>
    <thead><tr><th>Description</th><th>Issued</th><th>Paid</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>
      <tr class="amount-row">
        <td>${invoice.description || 'Subscription'}</td>
        <td>${issued}</td>
        <td>${paid}</td>
        <td style="text-align:right">${currency} ${amount}</td>
      </tr>
    </tbody>
  </table>

  <div class="total">Total: ${currency} ${amount}</div>

  <div class="footer">
    Meticle — Supported living &amp; domiciliary care platform &bull; Generated ${now} &bull; This is a system-generated invoice
  </div>
</body></html>`
}

export { sharedGeneratePdf as generatePdf }
