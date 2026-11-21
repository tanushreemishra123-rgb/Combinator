import { describe, expect, it } from 'vitest';
import type { EstimationConfig } from '../../domain';
import { createDefaultEstimationConfig } from '../../seed/estimationDefaults';
import { firstOrThrow } from '../testFixtures.data';
import { describeCommercialChanges } from './commercialChanges';

function config(overrides: Partial<EstimationConfig> = {}): EstimationConfig {
  return { ...createDefaultEstimationConfig(), ...overrides };
}

describe('describeCommercialChanges', () => {
  it('reports one rate-card change naming every role whose day rate changed', () => {
    const before = config();
    const after = config({
      rates: before.rates.map((rate) => (rate.roleId === 'backend-engineer' ? { ...rate, dayRate: 900 } : rate.roleId === 'qa-engineer' ? { ...rate, dayRate: null } : rate)),
    });
    const changes = describeCommercialChanges(before, after);
    const rateCard = changes.find((change) => change.kind === 'rate-card');
    expect(rateCard).toBeDefined();
    expect(rateCard?.targetId).toBe('rate-card');
    expect(rateCard?.label).toContain('Backend Engineer');
    expect(rateCard?.label).toContain('QA Engineer');
    expect(rateCard?.to).toContain('no rate');
  });

  it('reports an added day rate for a role that previously had none', () => {
    const before = config({ rates: createDefaultEstimationConfig().rates.map((rate) => (rate.roleId === 'security-engineer' ? { ...rate, dayRate: null } : rate)) });
    const after = config();
    const change = firstOrThrow(describeCommercialChanges(before, after));
    expect(change.kind).toBe('rate-card');
    expect(change.from).toContain('no rate');
  });

  it('reports no rate-card change when the rates are unchanged', () => {
    const before = config();
    const after = config();
    expect(describeCommercialChanges(before, after).some((change) => change.kind === 'rate-card')).toBe(false);
  });

  it('reports a contingency percentage change', () => {
    const before = config({ contingencyPct: 15 });
    const after = config({ contingencyPct: 20 });
    const change = firstOrThrow(describeCommercialChanges(before, after));
    expect(change).toMatchObject({ kind: 'contingency', targetId: 'contingencyPct', from: '15%', to: '20%' });
  });

  it('reports a currency change', () => {
    const before = config({ currency: 'USD' });
    const after = config({ currency: 'EUR' });
    const change = firstOrThrow(describeCommercialChanges(before, after));
    expect(change).toMatchObject({ kind: 'currency', targetId: 'currency', from: 'USD', to: 'EUR' });
  });

  it('reports productivity-factor, team-size and working-days changes under the "productivity" kind', () => {
    const before = config({ productivityFactor: 1, teamSize: 6, workingDaysPerWeek: 5 });
    const after = config({ productivityFactor: 0.9, teamSize: 8, workingDaysPerWeek: 4 });
    const changes = describeCommercialChanges(before, after);
    const kinds = changes.map((change) => change.targetId);
    expect(kinds).toEqual(expect.arrayContaining(['productivityFactor', 'teamSize', 'workingDaysPerWeek']));
    expect(changes.every((change) => change.kind === 'productivity')).toBe(true);
  });

  it('reports a single baseline-table change when the base-effort table is edited', () => {
    const before = config();
    const after = config({ baseEffort: before.baseEffort.map((row) => (row.driverType === 'capability' ? { ...row, days: row.days.map((day) => ({ ...day, value: day.value + 5 })) } : row)) });
    const changes = describeCommercialChanges(before, after);
    const baseline = changes.find((change) => change.targetId === 'estimation-baseline');
    expect(baseline).toBeDefined();
    expect(baseline?.kind).toBe('productivity');
    expect(baseline?.label).toContain('base effort table');
  });

  it('reports every edited baseline table together in one change', () => {
    const before = config();
    const after = config({ roundingUnit: 500, phaseOverheads: before.phaseOverheads.map((overhead) => ({ ...overhead, pctOfBuild: overhead.pctOfBuild + 1 })) });
    const baseline = firstOrThrow(describeCommercialChanges(before, after).filter((change) => change.targetId === 'estimation-baseline'));
    expect(baseline.label).toContain('rounding unit');
    expect(baseline.label).toContain('phase overheads');
  });

  it('reports nothing when the estimation configuration is unchanged', () => {
    const same = config();
    expect(describeCommercialChanges(same, config())).toEqual([]);
  });
});
