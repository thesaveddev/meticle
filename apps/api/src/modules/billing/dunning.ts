export const DUNNING_MILESTONES = [0, 3, 7, 14] as const;

export const HARD_DECLINES = [
  'lost_card',
  'stolen_card',
  'pickup_card',
  'account_closed',
  'card_not_supported',
  'card_velocity_exceeded',
  'do_not_honor',
] as const;

export interface DunningDecision {
  milestoneDay: number;
  urgency: number;
  hardDecline: boolean;
}

export interface DunningInput {
  daysSinceFirstFailure: number;
  declineCode?: string | null;
  sentMilestones: number[];
}

export function selectDunningMilestone(input: DunningInput): DunningDecision | null {
  const hardDecline = !!input.declineCode && HARD_DECLINES.includes(input.declineCode as any);
  const milestoneDay = hardDecline ? 0 : Math.min(Math.max(0, input.daysSinceFirstFailure), 14);
  if (!DUNNING_MILESTONES.includes(milestoneDay as any)) return null;
  if (input.sentMilestones.includes(milestoneDay)) return null;
  return { milestoneDay, urgency: hardDecline ? 14 : milestoneDay, hardDecline };
}
