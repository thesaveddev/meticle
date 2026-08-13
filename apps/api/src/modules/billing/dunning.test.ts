import { describe, it, expect } from 'vitest';
import { selectDunningMilestone, HARD_DECLINES, DUNNING_MILESTONES } from './dunning';

describe('selectDunningMilestone', () => {
  it('emails on day 0 (first failure)', () => {
    const d = selectDunningMilestone({ daysSinceFirstFailure: 0, sentMilestones: [] });
    expect(d).toEqual({ milestoneDay: 0, urgency: 0, hardDecline: false });
  });

  it('emails on day 3, 7 and 14', () => {
    for (const day of [3, 7, 14]) {
      const d = selectDunningMilestone({ daysSinceFirstFailure: day, sentMilestones: [] });
      expect(d).toEqual({ milestoneDay: day, urgency: day, hardDecline: false });
    }
  });

  it('caps milestone at 14 and stops after the final notice', () => {
    const d = selectDunningMilestone({ daysSinceFirstFailure: 30, sentMilestones: [] });
    expect(d?.milestoneDay).toBe(14);
    const afterFinal = selectDunningMilestone({ daysSinceFirstFailure: 30, sentMilestones: [0, 3, 7, 14] });
    expect(afterFinal).toBeNull();
  });

  it('does not email on non-milestone days', () => {
    for (const day of [1, 2, 4, 5, 6, 8, 9, 10, 11, 12, 13]) {
      expect(selectDunningMilestone({ daysSinceFirstFailure: day, sentMilestones: [] })).toBeNull();
    }
  });

  it('never re-sends an already-sent milestone', () => {
    const d = selectDunningMilestone({ daysSinceFirstFailure: 7, sentMilestones: [0, 3, 7] });
    expect(d).toBeNull();
  });

  it('escalates hard declines immediately with day-14 urgency', () => {
    const d = selectDunningMilestone({ daysSinceFirstFailure: 0, declineCode: 'lost_card', sentMilestones: [] });
    expect(d).toEqual({ milestoneDay: 0, urgency: 14, hardDecline: true });
  });

  it('escalates on all hard-decline codes', () => {
    for (const code of HARD_DECLINES) {
      const d = selectDunningMilestone({ daysSinceFirstFailure: 0, declineCode: code, sentMilestones: [] });
      expect(d?.hardDecline).toBe(true);
      expect(d?.urgency).toBe(14);
    }
  });

  it('treats soft declines like normal retries', () => {
    const d = selectDunningMilestone({ daysSinceFirstFailure: 3, declineCode: 'insufficient_funds', sentMilestones: [] });
    expect(d?.hardDecline).toBe(false);
    expect(d?.urgency).toBe(3);
  });

  it('treats unknown/missing decline codes as soft', () => {
    expect(selectDunningMilestone({ daysSinceFirstFailure: 0, sentMilestones: [] })?.hardDecline).toBe(false);
    expect(selectDunningMilestone({ daysSinceFirstFailure: 0, declineCode: null, sentMilestones: [] })?.hardDecline).toBe(false);
  });

  it('clamps negative days to 0', () => {
    const d = selectDunningMilestone({ daysSinceFirstFailure: -5, sentMilestones: [] });
    expect(d?.milestoneDay).toBe(0);
  });

  it('exposes exactly the documented milestone schedule', () => {
    expect([...DUNNING_MILESTONES]).toEqual([0, 3, 7, 14]);
  });
});
