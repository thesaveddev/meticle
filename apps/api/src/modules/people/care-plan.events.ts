import { publishDomainEvent } from '../events/events.outbox';

export interface CarePlanReviewDuePayload {
  care_plan_id: string;
  person_id: string;
  person_name: string;
  title: string;
  category: string;
  review_date: string;
  days_overdue: number;
}

/**
 * Publish `care_plan.review_due` when a care plan's review date has been
 * reached or passed.
 */
export async function publishCarePlanReviewDueEvent(args: {
  organizationId: string;
  carePlanId: string;
  personId: string;
  personName: string;
  title: string;
  category: string;
  reviewDate: string;
  daysOverdue: number;
}): Promise<{ id: string }> {
  const payload: CarePlanReviewDuePayload = {
    care_plan_id: args.carePlanId,
    person_id: args.personId,
    person_name: args.personName,
    title: args.title,
    category: args.category,
    review_date: args.reviewDate,
    days_overdue: args.daysOverdue,
  };

  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'care_plan.review_due',
    aggregateType: 'care_plan',
    aggregateId: args.carePlanId,
    payload: payload as unknown as Record<string, unknown>,
  });
}