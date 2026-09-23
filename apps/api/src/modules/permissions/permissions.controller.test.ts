import { describe, expect, it } from 'vitest';
import { getAvailableModules, MODULES, ROLE_DEFAULTS } from './permissions.controller';

describe('organisation module permissions', () => {
  it('uses the primary service model when legacy service_types include another model', () => {
    const domiciliary = getAvailableModules(['domiciliary', 'supported_living'], 'domiciliary');
    expect(domiciliary).toContain('homecare');
    expect(domiciliary).toContain('call_scheduling');
    expect(domiciliary).not.toContain('scheduling');
    expect(domiciliary).not.toContain('emedication');
    expect(domiciliary).not.toContain('agencies');

    const supportedLiving = getAvailableModules(['supported_living', 'domiciliary'], 'supported_living');
    expect(supportedLiving).toContain('scheduling');
    expect(supportedLiving).toContain('emedication');
    expect(supportedLiving).not.toContain('homecare');
    expect(supportedLiving).not.toContain('call_scheduling');
  });

  it('keeps shared modules available to either recognised care model', () => {
    for (const service of ['domiciliary', 'supported_living']) {
      const available = getAvailableModules([service]);
      expect(available).toContain('dashboard');
      expect(available).toContain('people');
      expect(available).toContain('leave');
    }
  });

  it('has an explicit role default for every module available to each service model', () => {
    for (const service of ['domiciliary', 'supported_living']) {
      const available = getAvailableModules([service]);
      for (const [role, defaults] of Object.entries(ROLE_DEFAULTS)) {
        for (const module of available) {
          expect(['none', 'view', 'edit'], `${role}.${module}`).toContain(defaults[module]);
        }
      }
    }
    expect(MODULES).toHaveLength(26);
  });
});
