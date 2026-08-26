import { publishDomainEvent } from '../events/events.outbox';

export interface PolicyReviewDuePayload {
  policy_id: string;
  title: string;
  category: string;
  review_due_at: string;
  days_overdue: number;
}

/**
 * Publish `policy.review_due` when a policy's review date has been reached
 * or passed.
 */
export async function publishPolicyReviewDueEvent(args: {
  organizationId: string;
  policyId: string;
  title: string;
  category: string;
  reviewDueAt: string;
  daysOverdue: number;
}): Promise<{ id: string }> {
  const payload: PolicyReviewDuePayload = {
    policy_id: args.policyId,
    title: args.title,
    category: args.category,
    review_due_at: args.reviewDueAt,
    days_overdue: args.daysOverdue,
  };

  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'policy.review_due',
    aggregateType: 'policy',
    aggregateId: args.policyId,
    payload: payload as unknown as Record<string, unknown>,
  });
}