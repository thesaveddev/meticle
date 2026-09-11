export interface ClientBillingUtilisationRow {
  visit_id: string;
  package_id: string;
  person_id: string;
  person_name: string;
  package_name: string;
  funding_type: string;
  visit_status: string;
  scheduled_start: string;
  scheduled_minutes: number;
  delivered_minutes: number;
  client_rate_pence: number | null;
  amount_pence: number;
  net_amount_pence: number;
  vat_rate: number | null;
  vat_inclusive: boolean;
  vat_amount_pence: number;
  gross_amount_pence: number;
  funding_applied: string | null;
  cancellation_policy_applied: string | null;
  billing_status: 'billable' | 'not_billable' | 'review';
  exclusion_reason: string | null;
}

export function applyVat(baseAmountPence: number, vatRate: number | null, vatInclusive: boolean) {
  const amount = Math.max(0, Math.round(baseAmountPence));
  const rate = vatRate == null || Number.isNaN(Number(vatRate)) ? null : Math.max(0, Math.min(100, Math.round(Number(vatRate))));
  if (rate == null || rate === 0 || amount === 0) {
    return { vatRate: rate, vatInclusive, netAmountPence: amount, vatAmountPence: 0, grossAmountPence: amount };
  }
  if (vatInclusive) {
    const net = Math.round((amount * 100) / (100 + rate));
    return { vatRate: rate, vatInclusive: true, netAmountPence: net, vatAmountPence: amount - net, grossAmountPence: amount };
  }
  const vat = Math.round((amount * rate) / 100);
  return { vatRate: rate, vatInclusive: false, netAmountPence: amount, vatAmountPence: vat, grossAmountPence: amount + vat };
}

export function fundingLabel(fundingType: string) {
  return String(fundingType || 'private').toLowerCase();
}

export function cancellationPolicyLabel(visitStatus: string) {
  if (visitStatus === 'cancelled') return 'Cancelled — no charge';
  if (visitStatus === 'missed') return 'Missed — no charge';
  return null;
}

export function buildFundingBreakdown(rows: Array<{ funding_type: string; gross_amount_pence: number; net_amount_pence: number; vat_amount_pence: number; billing_status: string }>) {
  const breakdown: Record<string, { count: number; net_pence: number; vat_pence: number; gross_pence: number; billable_count: number }> = {};
  for (const row of rows) {
    const key = fundingLabel(row.funding_type);
    if (!breakdown[key]) breakdown[key] = { count: 0, net_pence: 0, vat_pence: 0, gross_pence: 0, billable_count: 0 };
    breakdown[key].count += 1;
    breakdown[key].net_pence += row.net_amount_pence;
    breakdown[key].vat_pence += row.vat_amount_pence;
    breakdown[key].gross_pence += row.gross_amount_pence;
    if (row.billing_status === 'billable') breakdown[key].billable_count += 1;
  }
  return breakdown;
}

export function calculateClientBillingLine(input: {
  visitStatus: string;
  scheduledMinutes: number;
  deliveredMinutes: number;
  clientRatePence: number | null;
  fundingType?: string;
  vatRate?: number | null;
  vatInclusive?: boolean;
}) {
  const scheduledMinutes = Math.max(0, Math.round(input.scheduledMinutes));
  const deliveredMinutes = Math.max(0, Math.round(input.deliveredMinutes));
  const rate = input.clientRatePence == null ? null : Math.max(0, Math.round(input.clientRatePence));

  const vatRate = input.vatRate ?? null;
  const vatInclusive = Boolean(input.vatInclusive);
  const fundingApplied = fundingLabel(input.fundingType || 'private');

  if (input.visitStatus === 'cancelled' || input.visitStatus === 'missed') {
    const vat = applyVat(0, vatRate, vatInclusive);
    return {
      scheduledMinutes,
      deliveredMinutes: 0,
      clientRatePence: rate,
      amountPence: 0,
      netAmountPence: vat.netAmountPence,
      vatRate: vat.vatRate,
      vatInclusive: vat.vatInclusive,
      vatAmountPence: vat.vatAmountPence,
      grossAmountPence: vat.grossAmountPence,
      fundingApplied,
      cancellationPolicyApplied: cancellationPolicyLabel(input.visitStatus),
      billingStatus: 'not_billable' as const,
      exclusionReason: input.visitStatus === 'cancelled' ? 'Visit cancelled' : 'Visit missed',
    };
  }
  if (input.visitStatus !== 'completed') {
    const vat = applyVat(0, vatRate, vatInclusive);
    return {
      scheduledMinutes,
      deliveredMinutes,
      clientRatePence: rate,
      amountPence: 0,
      netAmountPence: vat.netAmountPence,
      vatRate: vat.vatRate,
      vatInclusive: vat.vatInclusive,
      vatAmountPence: vat.vatAmountPence,
      grossAmountPence: vat.grossAmountPence,
      fundingApplied,
      cancellationPolicyApplied: null,
      billingStatus: 'review' as const,
      exclusionReason: 'Visit is not completed',
    };
  }
  if (rate == null) {
    const vat = applyVat(0, vatRate, vatInclusive);
    return {
      scheduledMinutes,
      deliveredMinutes,
      clientRatePence: null,
      amountPence: 0,
      netAmountPence: vat.netAmountPence,
      vatRate: vat.vatRate,
      vatInclusive: vat.vatInclusive,
      vatAmountPence: vat.vatAmountPence,
      grossAmountPence: vat.grossAmountPence,
      fundingApplied,
      cancellationPolicyApplied: null,
      billingStatus: 'review' as const,
      exclusionReason: 'Client rate is not configured',
    };
  }
  if (deliveredMinutes <= 0) {
    const vat = applyVat(0, vatRate, vatInclusive);
    return {
      scheduledMinutes,
      deliveredMinutes,
      clientRatePence: rate,
      amountPence: 0,
      netAmountPence: vat.netAmountPence,
      vatRate: vat.vatRate,
      vatInclusive: vat.vatInclusive,
      vatAmountPence: vat.vatAmountPence,
      grossAmountPence: vat.grossAmountPence,
      fundingApplied,
      cancellationPolicyApplied: null,
      billingStatus: 'review' as const,
      exclusionReason: 'No delivered minutes recorded',
    };
  }
  const base = Math.round((deliveredMinutes / 60) * rate);
  const vat = applyVat(base, vatRate, vatInclusive);
  return {
    scheduledMinutes,
    deliveredMinutes,
    clientRatePence: rate,
    amountPence: base,
    netAmountPence: vat.netAmountPence,
    vatRate: vat.vatRate,
    vatInclusive: vat.vatInclusive,
    vatAmountPence: vat.vatAmountPence,
    grossAmountPence: vat.grossAmountPence,
    fundingApplied,
    cancellationPolicyApplied: null,
    billingStatus: 'billable' as const,
    exclusionReason: null,
  };
}
