import { publishDomainEvent } from '../events/events.outbox';

export interface FluidIntakeBelowTargetPayload {
  person_id: string;
  person_name: string;
  recorded_date: string;
  actual_ml: number;
  target_ml: number;
  pct_of_target: number;
}

/**
 * Publish `fluid.intake_below_target` when a person's daily fluid intake
 * falls below their configured target.
 */
export async function publishFluidIntakeBelowTargetEvent(args: {
  organizationId: string;
  personId: string;
  personName: string;
  recordedDate: string;
  actualMl: number;
  targetMl: number;
}): Promise<{ id: string }> {
  const payload: FluidIntakeBelowTargetPayload = {
    person_id: args.personId,
    person_name: args.personName,
    recorded_date: args.recordedDate,
    actual_ml: args.actualMl,
    target_ml: args.targetMl,
    pct_of_target: args.targetMl > 0 ? Math.round((args.actualMl / args.targetMl) * 100) : 0,
  };

  return publishDomainEvent({
    organizationId: args.organizationId,
    eventName: 'fluid.intake_below_target',
    aggregateType: 'fluid_intake',
    aggregateId: args.personId,
    payload: payload as unknown as Record<string, unknown>,
  });
}