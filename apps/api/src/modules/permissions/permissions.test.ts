import { describe, it, expect } from 'vitest';
import { MODULES, ROLE_DEFAULTS } from './permissions.controller';
import { ROLE_DEFAULTS as MIDDLEWARE_ROLE_DEFAULTS } from '../../shared/middleware/requirePermission';

const ALL_ROLES = ['ORG_ADMIN', 'MANAGER', 'CARE_WORKER', 'COMPLIANCE_OFFICER'];

describe('Permissions module catalogue', () => {
  it('covers every navigation area with a label on the frontend matrix', () => {
    expect(MODULES).toEqual(expect.arrayContaining([
      'dashboard', 'people', 'emedication', 'staff_directory', 'scheduling', 'marketplace',
      'agencies', 'leave', 'compliance', 'training', 'policies', 'incidents', 'reporting',
      'outcomes', 'chat', 'tasks', 'appointments', 'expenses', 'room_checks', 'settings',
      'billing', 'learn',
    ]));
    expect(MODULES).toHaveLength(22);
    expect(new Set(MODULES).size).toBe(MODULES.length);
  });

  it('gives every role a default level for every module', () => {
    for (const role of ALL_ROLES) {
      const defaults = ROLE_DEFAULTS[role];
      expect(defaults, `${role} should have defaults`).toBeDefined();
      for (const module of MODULES) {
        expect(['none', 'view', 'edit'], `${role}.${module}`).toContain(defaults[module]);
      }
    }
  });

  it('keeps the enforcement middleware defaults in sync with the controller', () => {
    for (const role of ALL_ROLES) {
      for (const module of MODULES) {
        expect(
          MIDDLEWARE_ROLE_DEFAULTS[role]?.[module],
          `middleware default for ${role}.${module}`
        ).toBe(ROLE_DEFAULTS[role][module]);
      }
    }
  });
});
