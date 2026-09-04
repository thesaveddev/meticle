import { describe, expect, it } from 'vitest';
import { selectReminderMilestone } from './trial-reminders';

describe('selectReminderMilestone', () => {
  it('selects the nearest due milestone instead of the largest matching milestone', () => {
    expect(selectReminderMilestone(8)).toBeNull();
    expect(selectReminderMilestone(6)).toBe(7);
    expect(selectReminderMilestone(3)).toBe(3);
    expect(selectReminderMilestone(2)).toBe(3);
    expect(selectReminderMilestone(1)).toBe(1);
  });

  it('returns null when no reminder milestone is due', () => {
    expect(selectReminderMilestone(0)).toBeNull();
    expect(selectReminderMilestone(-1)).toBeNull();
    expect(selectReminderMilestone(30)).toBeNull();
  });

  it('works with a separate invoice milestone list', () => {
    expect(selectReminderMilestone(3, [1, 3, 7])).toBe(3);
    expect(selectReminderMilestone(6, [1, 3, 7])).toBe(7);
  });
});
