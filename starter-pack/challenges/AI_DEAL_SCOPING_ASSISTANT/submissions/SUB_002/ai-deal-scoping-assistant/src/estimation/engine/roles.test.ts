import { createDefaultEstimationConfig } from '../../seed/estimationDefaults';
import { createConfigLookups } from './lookups';
import { roundToUnit, roundWhole, spreadRange, ceilWhole } from './numbers';
import { allocateRoles, apportion } from './roles';

describe('apportion (largest remainder)', () => {
  it('always distributes exactly the requested units', () => {
    expect(apportion(70, [30, 25, 15, 10, 20])).toEqual([21, 18, 10, 7, 14]);
    expect(apportion(10, [1, 1, 1]).reduce((total, value) => total + value, 0)).toBe(10);
  });

  it('gives ties to the earlier entry and handles empty weights', () => {
    expect(apportion(1, [1, 1])).toEqual([1, 0]);
    expect(apportion(5, [0, 0])).toEqual([0, 0]);
  });
});

describe('allocateRoles', () => {
  const lookups = createConfigLookups(createDefaultEstimationConfig());

  it('weights the role mix of each driver type by its days', () => {
    const { roles, unmixedTypes } = allocateRoles(34, [{ key: 'integration', days: 22 }, { key: 'data', days: 12 }], lookups);
    expect(unmixedTypes).toEqual([]);
    expect(roles.map((role) => role.roleId)).toEqual(['solution-architect', 'backend-engineer', 'data-engineer', 'devops-engineer', 'security-engineer', 'qa-engineer']);
    expect(roles.find((role) => role.roleId === 'backend-engineer')).toEqual({ roleId: 'backend-engineer', label: 'Backend Engineer', days: 13.9, dayRate: 760, cost: 10564 });
  });

  it('never prices a role without a configured rate', () => {
    const config = createDefaultEstimationConfig();
    const noQaRate = createConfigLookups({ ...config, rates: config.rates.filter((rate) => rate.roleId !== 'qa-engineer') });
    const qa = allocateRoles(10, [{ key: 'overhead', days: 10 }], noQaRate).roles.find((role) => role.roleId === 'qa-engineer');
    expect(qa).toEqual({ roleId: 'qa-engineer', label: 'Qa Engineer', days: 2, dayRate: null, cost: null });
  });

  it('reports driver types that have effort but no role mix', () => {
    const config = createDefaultEstimationConfig();
    const noAiMix = createConfigLookups({ ...config, roleMix: config.roleMix.filter((row) => row.driverType !== 'ai') });
    expect(allocateRoles(18, [{ key: 'ai', days: 18 }], noAiMix)).toEqual({ roles: [], unmixedTypes: ['ai'] });
  });
});

describe('config lookups', () => {
  it('treats negative or non-finite rates and effort values as not configured', () => {
    const config = createDefaultEstimationConfig();
    const lookups = createConfigLookups({
      ...config,
      rates: config.rates.map((rate) => (rate.roleId === 'ai-engineer' ? { ...rate, dayRate: -5 } : rate)),
      baseEffort: [{ driverType: 'ai', label: 'AI use case', days: [{ complexity: 'Low', value: Number.NaN }] }],
    });
    expect(lookups.rate('ai-engineer').dayRate).toBeNull();
    expect(lookups.unitDays('ai', 'Low')).toBeNull();
    expect(lookups.unitDays('capability', 'Low')).toBeNull();
  });

  it('falls back to the widest configured spread for a confidence level without a row', () => {
    const config = createDefaultEstimationConfig();
    const lookups = createConfigLookups({ ...config, confidenceSpreads: config.confidenceSpreads.filter((spread) => spread.confidence !== 'Medium') });
    expect(lookups.spread('Medium')).toEqual({ confidence: 'Medium', lowPct: 20, highPct: 50 });
  });
});

describe('number helpers', () => {
  it('rounds without floating-point surprises', () => {
    expect(roundWhole(10 * 1.15)).toBe(12);
    expect(ceilWhole(20 * 1.15)).toBe(23);
    expect(roundToUnit(39124, 1000)).toBe(39000);
    expect(roundToUnit(39124, 0)).toBe(39124);
  });

  it('builds ranges from a spread and never goes below zero', () => {
    expect(spreadRange(61, { lowPct: 15, highPct: 30 }, roundWhole)).toEqual({ low: 52, likely: 61, high: 79 });
    expect(spreadRange(10, { lowPct: 150, highPct: 0 }, roundWhole).low).toBe(0);
  });
});
