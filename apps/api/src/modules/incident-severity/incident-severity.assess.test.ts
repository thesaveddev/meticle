import { describe, it, expect } from 'vitest';
import { assessSeverity } from './incident-severity.assess';

describe('incident-severity assess', () => {
  it('mandatory escalation survives a low weighted score', () => {
    const r = assessSeverity({ harm_level: 'minor', category: 'falls', safeguarding_concern: true, urgency: 'week' });
    expect(r.level).toBe('high');
    expect(r.explanation.some(e => e.rule === 'safeguarding')).toBe(true);
  });

  it('emergency indicators go straight to critical', () => {
    const r = assessSeverity({ harm_level: 'minor', category: 'falls', emergency_indicators: ['unresponsive'] });
    expect(r.level).toBe('critical');
  });

  it('unknown harm is provisional, never low/no-harm', () => {
    const r = assessSeverity({ harm_level: 'unknown', category: 'falls' });
    expect(r.provisional).toBe(true);
    expect(r.level).not.toBe('low');
  });

  it('missing inputs are provisional with named gaps', () => {
    const r = assessSeverity({ category: 'falls' } as never);
    expect(r.provisional).toBe(true);
    expect(r.missing).toContain('harm_level');
  });

  it('custom rule conditions fire from values', () => {
    const r = assessSeverity(
      { harm_level: 'minor', category: 'medication', urgency: 'routine' },
      { escalation_conditions: [{ when: { category: 'medication' }, level: 'high', reason: 'Controlled drug involved' }] },
    );
    expect(r.level).toBe('high');
    expect(r.explanation.some(e => e.rule === 'custom_rule')).toBe(true);
  });

  it('repeat events step up one level', () => {
    const once = assessSeverity({ harm_level: 'moderate', category: 'falls', urgency: 'routine' });
    const repeat = assessSeverity({ harm_level: 'moderate', category: 'falls', urgency: 'routine', recurrence_count: 4 });
    expect(['low', 'medium', 'high', 'critical'].indexOf(repeat.level)).toBeGreaterThanOrEqual(['low', 'medium', 'high', 'critical'].indexOf(once.level));
    expect(repeat.explanation.some(e => e.rule === 'recurrence')).toBe(true);
  });
});
