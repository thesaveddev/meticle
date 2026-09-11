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
  billing_status: 'billable' | 'not_billable' | 'review';
  exclusion_reason: string | null;
}

export function calculateClientBillingLine(input: {
  visitStatus: string;
  scheduledMinutes: number;
  deliveredMinutes: number;
  clientRatePence: number | null;
}) {
  const scheduledMinutes = Math.max(0, Math.round(input.scheduledMinutes));
  const deliveredMinutes = Math.max(0, Math.round(input.deliveredMinutes));
  const rate = input.clientRatePence == null ? null : Math.max(0, Math.round(input.clientRatePence));

  if (input.visitStatus === 'cancelled' || input.visitStatus === 'missed') {
    return {
      scheduledMinutes,
      deliveredMinutes: 0,
      clientRatePence: rate,
      amountPence: 0,
      billingStatus: 'not_billable' as const,
      exclusionReason: input.visitStatus === 'cancelled' ? 'Visit cancelled' : 'Visit missed',
    };
  }
  if (input.visitStatus !== 'completed') {
    return {
      scheduledMinutes,
      deliveredMinutes,
      clientRatePence: rate,
      amountPence: 0,
      billingStatus: 'review' as const,
      exclusionReason: 'Visit is not completed',
    };
  }
  if (rate == null) {
    return {
      scheduledMinutes,
      deliveredMinutes,
      clientRatePence: null,
      amountPence: 0,
      billingStatus: 'review' as const,
      exclusionReason: 'Client rate is not configured',
    };
  }
  if (deliveredMinutes <= 0) {
    return {
      scheduledMinutes,
      deliveredMinutes,
      clientRatePence: rate,
      amountPence: 0,
      billingStatus: 'review' as const,
      exclusionReason: 'No delivered minutes recorded',
    };
  }
  return {
    scheduledMinutes,
    deliveredMinutes,
    clientRatePence: rate,
    amountPence: Math.round((deliveredMinutes / 60) * rate),
    billingStatus: 'billable' as const,
    exclusionReason: null,
  };
}
