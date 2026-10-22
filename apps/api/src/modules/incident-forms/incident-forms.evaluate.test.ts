import { describe, it, expect } from 'vitest';
import { evaluateForm, evaluateCondition } from './incident-forms.evaluate';

describe('incident-forms evaluate — conditions', () => {
  it('branches on category: safeguarding shows its follow-up, falls does not', () => {
    const fields = [
      { field_key: 'category', required: true, type: 'select' },
      { field_key: 'safeguarding_ref', required: true, visibility: { field: 'category', op: 'equals', value: 'safeguarding' } },
    ];
    const safe = evaluateForm(fields, { category: 'safeguarding' });
    expect(safe.visible.safeguarding_ref).toBe(true);
    expect(safe.invalid.safeguarding_ref).toBe('Required');

    const falls = evaluateForm(fields, { category: 'falls' });
    expect(falls.visible.safeguarding_ref).toBe(false);
    expect(falls.invalid.safeguarding_ref).toBeUndefined();
  });

  it('treats unknown as unknown: a missing parent never hides a field', () => {
    expect(evaluateCondition({ field: 'category', op: 'equals', value: 'falls' }, {})).toBe(true);
  });

  it('supports AND/OR/NOT on values, never labels', () => {
    const cond = { all: [{ field: 'a', op: 'equals', value: 'x' }, { not: { field: 'b', op: 'empty' } }] };
    expect(evaluateCondition(cond as never, { a: 'x', b: 'something' })).toBe(true);
    expect(evaluateCondition(cond as never, { a: 'x', b: '' })).toBe(false);
    const any = { any: [{ field: 'a', op: 'equals', value: 'x' }, { field: 'a', op: 'equals', value: 'y' }] };
    expect(evaluateCondition(any as never, { a: 'y' })).toBe(true);
  });

  it('applies hidden-answer policy: clear drops, retain keeps for audit', () => {
    const fields = [
      { field_key: 'category', type: 'select' },
      { field_key: 'med_dose', type: 'text', hidden_policy: 'clear', visibility: { field: 'category', op: 'equals', value: 'medication' } },
      { field_key: 'notes', type: 'textarea', hidden_policy: 'retain_excluded', visibility: { field: 'category', op: 'equals', value: 'medication' } },
    ];
    const r = evaluateForm(fields, { category: 'falls', med_dose: '10mg', notes: 'kept' });
    expect(r.cleared).toContain('med_dose');
    expect(r.retainedExcluded).toContain('notes');
    expect(r.invalid.med_dose).toBeUndefined();
  });

  it('rejects contradictory/out-of-range answers', () => {
    const fields = [
      { field_key: 'dose', type: 'number', required: true, validation: { min: 1, max: 10 } },
      { field_key: 'category', type: 'select', options: ['falls', 'medication'] },
    ];
    expect(evaluateForm(fields, { dose: 99, category: 'falls' }).invalid.dose).toBeTruthy();
    expect(evaluateForm(fields, { dose: 5, category: 'nope' }).invalid.category).toBe('Invalid option');
    expect(evaluateForm(fields, { category: 'falls' }).invalid.dose).toBe('Required');
  });
});
