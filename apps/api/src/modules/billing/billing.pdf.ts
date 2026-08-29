import { generatePdf as sharedGeneratePdf } from '../../shared/pdf/pdf.service'

export function buildInvoiceHtml(invoice: any, org: { name?: string; primary_color?: string }): string {
  const amount = parseFloat(invoice.amount || '0').toFixed(2)
  const currency = (invoice.currency || 'gbp').toUpperCase()
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency + ' '
  const issued = invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
  const paid = invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  const dueDate = invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  const primary = org.primary_color || '#0F4C81'
  const now = new Date()
  const generatedAt = now.toLocaleString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  // Status badge
  const isPaid = invoice.status === 'paid'
  const statusBadge = isPaid
    ? `<span style="display:inline-block;background:#059669;color:#fff;padding:6px 18px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase">Paid</span>`
    : invoice.status === 'overdue'
    ? `<span style="display:inline-block;background:#DC2626;color:#fff;padding:6px 18px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase">Overdue</span>`
    : `<span style="display:inline-block;background:#D97706;color:#fff;padding:6px 18px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase">Unpaid</span>`

  // Payment status line
  const paymentLine = isPaid && paid
    ? `<div style="font-size:12px;color:#6B7280;margin-top:4px">Paid on ${paid}</div>`
    : dueDate
    ? `<div style="font-size:12px;color:#6B7280;margin-top:4px">Due by ${dueDate}</div>`
    : ''

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #1F2937;
    font-size: 13px;
    line-height: 1.5;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page { padding: 40px 48px; }

  /* ── Header ── */
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; }
  .brand-block { flex: 1; }
  .brand-name {
    font-size: 28px;
    font-weight: 800;
    color: ${primary};
    letter-spacing: -0.5px;
    line-height: 1.1;
  }
  .brand-tagline {
    font-size: 11px;
    color: #9CA3AF;
    font-weight: 500;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-top: 4px;
  }
  .brand-details {
    margin-top: 12px;
    font-size: 11px;
    color: #6B7280;
    line-height: 1.6;
  }
  .invoice-meta { text-align: right; }
  .invoice-label {
    font-size: 11px;
    color: #9CA3AF;
    font-weight: 600;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .invoice-number {
    font-size: 26px;
    font-weight: 800;
    color: #1F2937;
    letter-spacing: -0.5px;
  }
  .invoice-date {
    font-size: 12px;
    color: #6B7280;
    margin-top: 4px;
  }

  /* ── Accent bar ── */
  .accent-bar {
    height: 4px;
    background: linear-gradient(90deg, ${primary} 0%, ${primary}CC 100%);
    border-radius: 2px;
    margin-bottom: 32px;
  }

  /* ── Info grid ── */
  .info-grid {
    display: flex;
    gap: 32px;
    margin-bottom: 32px;
  }
  .info-block { flex: 1; }
  .info-label {
    font-size: 10px;
    font-weight: 700;
    color: #9CA3AF;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .info-value {
    font-size: 14px;
    font-weight: 600;
    color: #1F2937;
    line-height: 1.5;
  }
  .info-value-sub {
    font-size: 12px;
    color: #6B7280;
    font-weight: 400;
    line-height: 1.5;
  }

  /* ── Status card ── */
  .status-card {
    background: #F9FAFB;
    border: 1px solid #E5E7EB;
    border-radius: 10px;
    padding: 20px 24px;
    margin-bottom: 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .status-amount {
    font-size: 32px;
    font-weight: 800;
    color: ${primary};
    letter-spacing: -1px;
  }
  .status-amount-label {
    font-size: 11px;
    color: #9CA3AF;
    font-weight: 600;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-top: 2px;
  }

  /* ── Line items table ── */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 24px;
  }
  .items-table thead th {
    text-align: left;
    font-size: 10px;
    font-weight: 700;
    color: #9CA3AF;
    letter-spacing: 1px;
    text-transform: uppercase;
    padding: 12px 16px;
    border-bottom: 2px solid #E5E7EB;
    background: #F9FAFB;
  }
  .items-table thead th:last-child {
    text-align: right;
  }
  .items-table tbody td {
    padding: 14px 16px;
    border-bottom: 1px solid #F3F4F6;
    font-size: 13px;
    color: #374151;
    vertical-align: top;
  }
  .items-table tbody td:last-child {
    text-align: right;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .items-table tbody tr:last-child td {
    border-bottom: 2px solid #E5E7EB;
  }
  .item-name {
    font-weight: 600;
    color: #1F2937;
  }
  .item-desc {
    font-size: 12px;
    color: #9CA3AF;
    margin-top: 2px;
  }

  /* ── Summary ── */
  .summary-section {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 36px;
  }
  .summary-table {
    width: 280px;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    font-size: 13px;
    color: #6B7280;
  }
  .summary-row.total {
    border-top: 2px solid #1F2937;
    margin-top: 4px;
    padding-top: 12px;
    font-size: 18px;
    font-weight: 800;
    color: #1F2937;
  }
  .summary-row.total .value {
    color: ${primary};
  }

  /* ── Payment info ── */
  .payment-section {
    background: #F9FAFB;
    border: 1px solid #E5E7EB;
    border-radius: 10px;
    padding: 20px 24px;
    margin-bottom: 32px;
  }
  .payment-title {
    font-size: 11px;
    font-weight: 700;
    color: #9CA3AF;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 12px;
  }
  .payment-grid {
    display: flex;
    gap: 32px;
  }
  .payment-item {
    font-size: 12px;
    color: #374151;
    line-height: 1.6;
  }
  .payment-item strong {
    color: #1F2937;
  }

  /* ── Terms ── */
  .terms-section {
    margin-bottom: 32px;
  }
  .terms-title {
    font-size: 11px;
    font-weight: 700;
    color: #9CA3AF;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .terms-text {
    font-size: 11px;
    color: #6B7280;
    line-height: 1.6;
  }

  /* ── Footer ── */
  .footer {
    border-top: 1px solid #E5E7EB;
    padding-top: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .footer-left {
    font-size: 10px;
    color: #9CA3AF;
    line-height: 1.6;
  }
  .footer-right {
    font-size: 10px;
    color: #9CA3AF;
    text-align: right;
    line-height: 1.6;
  }
  .footer-brand {
    font-weight: 700;
    color: ${primary};
  }
</style></head><body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="brand-block">
      <div class="brand-name">Meticle</div>
      <div class="brand-tagline">Care Platform</div>
      <div class="brand-details">
        Meticle Ltd<br>
        United Kingdom<br>
        hello@meticlecare.com
      </div>
    </div>
    <div class="invoice-meta">
      <div class="invoice-label">Invoice</div>
      <div class="invoice-number">${invoice.invoice_number || 'INV-000000'}</div>
      <div class="invoice-date">Issued ${issued}</div>
      <div style="margin-top:8px">${statusBadge}</div>
      ${paymentLine}
    </div>
  </div>

  <!-- Accent bar -->
  <div class="accent-bar"></div>

  <!-- Info grid -->
  <div class="info-grid">
    <div class="info-block">
      <div class="info-label">Bill To</div>
      <div class="info-value">${org.name || 'Meticle Customer'}</div>
    </div>
    <div class="info-block">
      <div class="info-label">Invoice Date</div>
      <div class="info-value">${issued}</div>
      ${dueDate ? `<div class="info-value-sub">Due: ${dueDate}</div>` : ''}
    </div>
    <div class="info-block">
      <div class="info-label">Payment Method</div>
      <div class="info-value">${invoice.payment_method ? invoice.payment_method.charAt(0).toUpperCase() + invoice.payment_method.slice(1) : 'Card on file'}</div>
    </div>
  </div>

  <!-- Amount card -->
  <div class="status-card">
    <div>
      <div class="status-amount-label">Amount ${isPaid ? 'Paid' : 'Due'}</div>
      <div class="status-amount">${symbol}${amount}</div>
    </div>
    <div>
      ${statusBadge}
      ${paymentLine ? `<div style="font-size:12px;color:#6B7280;margin-top:6px;text-align:right">${isPaid ? 'Paid on ' + paid : 'Due by ' + (dueDate || '—')}</div>` : ''}
    </div>
  </div>

  <!-- Line items -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width:50%">Description</th>
        <th>Period</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <div class="item-name">${invoice.description || 'Meticle Subscription'}</div>
          <div class="item-desc">Care management platform access</div>
        </td>
        <td>
          ${invoice.period_start && invoice.period_end
            ? `${new Date(invoice.period_start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(invoice.period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
            : issued}
        </td>
        <td>${symbol}${amount}</td>
      </tr>
    </tbody>
  </table>

  <!-- Summary -->
  <div class="summary-section">
    <div class="summary-table">
      <div class="summary-row">
        <span>Subtotal</span>
        <span>${symbol}${amount}</span>
      </div>
      <div class="summary-row">
        <span>VAT (0%)</span>
        <span>${symbol}0.00</span>
      </div>
      <div class="summary-row total">
        <span>Total</span>
        <span class="value">${symbol}${amount}</span>
      </div>
    </div>
  </div>

  <!-- Payment info -->
  <div class="payment-section">
    <div class="payment-title">Payment Details</div>
    <div class="payment-grid">
      <div class="payment-item">
        <strong>Status:</strong> ${isPaid ? 'Payment received' : 'Payment pending'}
      </div>
      <div class="payment-item">
        <strong>Method:</strong> ${invoice.payment_method ? invoice.payment_method.charAt(0).toUpperCase() + invoice.payment_method.slice(1) : 'Card ending ••••'}
      </div>
      <div class="payment-item">
        <strong>Reference:</strong> ${invoice.invoice_number || '—'}
      </div>
    </div>
  </div>

  <!-- Terms -->
  <div class="terms-section">
    <div class="terms-title">Terms &amp; Conditions</div>
    <div class="terms-text">
      Payment is due within 30 days of the invoice date. Late payments may incur interest at 3% above the Bank of England base rate.
      This invoice is issued by Meticle Ltd. For billing enquiries, contact billing@meticlecare.com.
      All amounts are in ${currency} and are inclusive of VAT where applicable.
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      <span class="footer-brand">Meticle</span> — Supported living care platform<br>
      Generated ${generatedAt} &bull; This is a system-generated invoice
    </div>
    <div class="footer-right">
      meticlecare.com<br>
      billing@meticlecare.com
    </div>
  </div>

</div>
</body></html>`
}

export { sharedGeneratePdf as generatePdf }
