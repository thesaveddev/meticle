import { publishDomainEvent } from '../events/events.outbox';

export interface AppetiteDeclinePayload {
  person_id: string;
  person_name: string;
  meal_date: string;
  meal_type: string;
  appetite_level: string;
  consumed_percent: number | null;
  dietary_appetite_baseline: string | null;
  consecutive_poor_meals: number;
}

export interface RefusedMealPayload {
  person_id: string;
  person_name: string;
  meal_id: string;
  meal_date: string;
  meal_type: string;
  refusal_reason: string | null;
  staff_concerns: string | null;
  consumed_percent: number | null;
  consecutive_refusals: number;
}

export async function publishAppetiteDeclineEvent(args: {
  organizationId: string;
  personId: string;
  personName: string;
  mealDate: string;
  mealType: string;
  appetiteLevel: string;
  consumedPercent: number | null;
  dietaryAppetiteBaseline: string | null;
  consecutivePoorMeals: number;
}): Promise<{ id: string }> {
  const payload: AppetiteDeclinePayload = {
    person_id: args.personId,
    person_name: args.personName,
    meal_date: args.mealDate,
    meal_type: args.mealType,
    appetite_level: args.appetiteLevel,
    consumed_percent: args.consumedPercent,
    dietary_appetite_baseline: args.dietaryAppetiteBaseline,
    consecutive_poor_meals: args.consecutivePoorMeals,
  };

  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'nutrition.appetite_decline',
    aggregateType: 'nutrition',
    aggregateId: args.personId,
    payload: payload as unknown as Record<string, unknown>,
  });
}

export async function publishRefusedMealEvent(args: {
  organizationId: string;
  personId: string;
  personName: string;
  mealId: string;
  mealDate: string;
  mealType: string;
  refusalReason: string | null;
  staffConcerns: string | null;
  consumedPercent: number | null;
  consecutiveRefusals: number;
}): Promise<{ id: string }> {
  const payload: RefusedMealPayload = {
    person_id: args.personId,
    person_name: args.personName,
    meal_id: args.mealId,
    meal_date: args.mealDate,
    meal_type: args.mealType,
    refusal_reason: args.refusalReason,
    staff_concerns: args.staffConcerns,
    consumed_percent: args.consumedPercent,
    consecutive_refusals: args.consecutiveRefusals,
  };

  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'nutrition.refused_meal',
    aggregateType: 'nutrition',
    aggregateId: args.mealId,
    payload: payload as unknown as Record<string, unknown>,
  });
}
