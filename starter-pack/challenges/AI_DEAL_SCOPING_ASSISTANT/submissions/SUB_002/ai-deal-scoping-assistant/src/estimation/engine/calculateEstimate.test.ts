import { createDefaultEstimationConfig, createDefaultSolutionConfig } from '../../seed/estimationDefaults';
import { fixtureScope } from '../../test/fixtures';
import type { EstimateResult, EstimationConfig, RoleId, WorkstreamEstimate } from '../../domain';
import {
  calculationInput,
  completeConfig,
  driver,
  platformSuggestion,
  resolveItems,
  suggestionOf,
  workstream,
} from '../testing/estimateFixtures';
import { calculateEstimate } from './calculateEstimate';
import { CALCULATION_RULES } from './rules';

function workstreamById(result: EstimateResult, id: string): WorkstreamEstimate {
  const found = result.workstreams.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`Workstream ${id} is missing from the result`);
  }
  return found;
}

function withRate(config: EstimationConfig, roleId: RoleId, dayRate: number | null): EstimationConfig {
  return { ...config, rates: config.rates.map((rate) => (rate.roleId === roleId ? { ...rate, dayRate } : rate)) };
}

describe('calculateEstimate - hand-computed tiny estimate', () => {
  const result = calculateEstimate(calculationInput());
  const build = workstreamById(result, 'WS_01');

  it('sizes drivers from the base-effort table and sums them', () => {
    expect(build.drivers.map((entry) => entry.unitDays)).toEqual([22, 12]);
    expect(build.baseDays).toBe(34);
    expect(build.effortDays).toEqual({ low: 31, likely: 34, high: 39 });
    expect(build.confidence).toBe('High');
    expect(build.complexity).toBe('High');
  });

  it('splits likely effort across roles so that role days add up exactly', () => {
    const days = new Map(build.roles.map((role) => [role.roleId, role.days]));
    expect(days.get('backend-engineer')).toBe(13.9);
    expect(days.get('data-engineer')).toBe(10.5);
    expect(days.get('qa-engineer')).toBe(4.5);
    expect(days.get('solution-architect')).toBe(3.4);
    expect(days.get('devops-engineer')).toBe(1.1);
    expect(days.get('security-engineer')).toBe(0.6);
    expect(build.roles.reduce((total, role) => total + role.days * 10, 0)).toBeCloseTo(340, 6);
  });

  it('prices the workstream as role days x day rate with the confidence spread', () => {
    expect(build.cost).toEqual({ low: 24161, likely: 26846, high: 30873, currency: 'USD' });
    expect(build.commercialBasis).toBe('Effort x role day rates (USD) + 15% contingency, rounded to 1,000');
  });

  it('adds the overhead phases as percentages of build effort', () => {
    expect(workstreamById(result, 'WS_PH_1').effortDays.likely).toBe(4);
    expect(workstreamById(result, 'WS_PH_5').effortDays.likely).toBe(7);
    expect(workstreamById(result, 'WS_PH_6').effortDays.likely).toBe(3);
    expect(workstreamById(result, 'WS_PH_5').cost?.likely).toBe(6139);
    expect(workstreamById(result, 'WS_PH_1').drivers).toEqual([]);
  });

  it('totals effort, person-weeks and ROM commercials rounded to the unit', () => {
    expect(result.totals.effortDays).toEqual({ low: 44, likely: 48, high: 55 });
    expect(result.totals.effortPersonWeeks).toEqual({ low: 8.8, likely: 9.6, high: 11 });
    expect(result.totals.subtotal).toEqual({ low: 35000, likely: 39000, high: 45000, currency: 'USD' });
    expect(result.totals.contingency).toEqual({ low: 5000, likely: 6000, high: 7000, currency: 'USD' });
    expect(result.totals.rom).toEqual({ low: 40000, likely: 45000, high: 52000, currency: 'USD' });
  });

  it('schedules the phases on team capacity', () => {
    expect(result.phases.map((phase) => [phase.id, phase.startWeek, phase.durationWeeks.likely])).toEqual([
      ['PH_1', 1, 1],
      ['PH_3', 2, 2],
      ['PH_5', 4, 1],
      ['PH_6', 5, 1],
    ]);
    expect(result.totals.timelineWeeks).toEqual({ low: 5, likely: 5, high: 6 });
    expect(result.phases.every((phase) => phase.milestone.length > 0)).toBe(true);
    // A build phase shares the concurrent build window, so its milestone says so instead of
    // reading like a phase with its own dedicated schedule; the lead/overlap/closing phases do not.
    const build = result.phases.find((phase) => phase.id === 'PH_3');
    expect(build?.milestone).toContain('runs concurrently with the other build-phase workstreams');
    const closing = result.phases.find((phase) => phase.id === 'PH_6');
    expect(closing?.milestone).not.toContain('runs concurrently');
  });

  it('writes a calculation trace a reviewer can follow', () => {
    expect(build.calculation).toContain('DRV_01 integration driver DRV_01: High integration = 22 days');
    expect(build.calculation).toContain('Base effort = 22 + 12 = 34 days');
    expect(build.calculation).toContain('Range (High confidence -10% / +15%) = 31 to 39 days');
    expect(build.calculation).toContain('Roles: Backend Engineer 13.9 d x 760 = 10,564 USD');
    expect(build.calculation.at(-1)).toContain('26,846 USD');
  });

  it('attaches rules, config snapshot, timestamp and a high overall confidence', () => {
    expect(result.rules).toEqual([...CALCULATION_RULES]);
    expect(result.configSnapshot).toEqual(createDefaultEstimationConfig());
    expect(result.computedAt).toBe(calculationInput().computedAt);
    expect(result.confidence).toBe('High');
    expect(result.missingInputs).toEqual([]);
    expect(result.explanation).toContain('45,000 USD');
    expect(result.explanation).not.toMatch(/undefined|NaN|null/);
  });
});

describe('calculateEstimate - configurable commercial assumptions', () => {
  const baseline = calculateEstimate(calculationInput());

  it('changes cost but not effort when a day rate changes', () => {
    const estimationConfig = withRate(createDefaultEstimationConfig(), 'backend-engineer', 1000);
    const result = calculateEstimate(calculationInput({ estimationConfig }));
    expect(result.totals.effortDays).toEqual(baseline.totals.effortDays);
    expect(workstreamById(result, 'WS_01').cost?.likely).toBe(26846 + Math.round(13.9 * 240));
    expect(result.totals.timelineWeeks).toEqual(baseline.totals.timelineWeeks);
  });

  it('applies 0% and 100% contingency to the subtotal', () => {
    const none = calculateEstimate(calculationInput({ estimationConfig: { ...createDefaultEstimationConfig(), contingencyPct: 0 } }));
    expect(none.totals.contingency?.likely).toBe(0);
    expect(none.totals.rom).toEqual(none.totals.subtotal);
    const full = calculateEstimate(calculationInput({ estimationConfig: { ...createDefaultEstimationConfig(), contingencyPct: 100 } }));
    expect(full.totals.contingency).toEqual(full.totals.subtotal);
    expect(full.totals.rom?.likely).toBe(78000);
  });

  it('reports every money value in the configured currency', () => {
    const result = calculateEstimate(calculationInput({ estimationConfig: { ...createDefaultEstimationConfig(), currency: 'EUR' } }));
    expect(result.totals.rom?.currency).toBe('EUR');
    expect(result.totals.rom?.likely).toBe(baseline.totals.rom?.likely);
    expect(workstreamById(result, 'WS_01').cost?.currency).toBe('EUR');
    expect(workstreamById(result, 'WS_01').commercialBasis).toContain('(EUR)');
    expect(workstreamById(result, 'WS_01').calculation.join(' ')).not.toContain('USD');
  });

  it('scales build effort and the overheads with the productivity factor', () => {
    const result = calculateEstimate(calculationInput({ estimationConfig: { ...createDefaultEstimationConfig(), productivityFactor: 0.8 } }));
    expect(workstreamById(result, 'WS_01').effortDays.likely).toBe(27);
    expect(workstreamById(result, 'WS_PH_1').effortDays.likely).toBe(3);
    expect(workstreamById(result, 'WS_01').calculation).toContain('Base 34 days x productivity 0.80 = 27 days (likely effort, rounded to whole days)');
  });

  it('rounds ROM values to the configured rounding unit', () => {
    const coarse = calculateEstimate(calculationInput({ estimationConfig: { ...createDefaultEstimationConfig(), roundingUnit: 5000 } }));
    expect(coarse.totals.subtotal?.likely).toBe(40000);
    const exact = calculateEstimate(calculationInput({ estimationConfig: { ...createDefaultEstimationConfig(), roundingUnit: 1 } }));
    expect(exact.totals.subtotal?.likely).toBe(39124);
    expect(exact.totals.rom?.likely).toBe(39124 + Math.round(39124 * 0.15));
  });

  it('applies the extra-environment uplift to infrastructure drivers only', () => {
    const atBaseline = calculateEstimate(calculationInput({ suggestion: platformSuggestion(), config: completeConfig({ environments: 3 }) }));
    const extra = calculateEstimate(calculationInput({ suggestion: platformSuggestion(), config: completeConfig({ environments: 5 }) }));
    expect(workstreamById(atBaseline, 'WS_01').effortDays.likely).toBe(25);
    expect(workstreamById(extra, 'WS_01').effortDays.likely).toBe(26);
    expect(workstreamById(extra, 'WS_02').effortDays.likely).toBe(workstreamById(atBaseline, 'WS_02').effortDays.likely);
    const uplift = workstreamById(extra, 'WS_01').adjustments.find((adjustment) => adjustment.label.startsWith('Extra environments'));
    expect(uplift?.factor).toBe(1.1);
    expect(workstreamById(extra, 'WS_02').adjustments.some((adjustment) => adjustment.label.startsWith('Extra environments'))).toBe(false);
  });
});

describe('calculateEstimate - missing inputs', () => {
  it('blocks cost and ROM when a role with allocated days has no rate', () => {
    const estimationConfig = withRate(createDefaultEstimationConfig(), 'security-engineer', null);
    const result = calculateEstimate(calculationInput({ estimationConfig }));
    const build = workstreamById(result, 'WS_01');
    expect(build.cost).toBeNull();
    expect(build.effortDays.likely).toBe(34);
    expect(build.confidence).toBe('Low');
    expect(build.commercialBasis).toContain('Cost blocked: no day rate is configured for Security Engineer');
    expect(result.totals.subtotal).toBeNull();
    expect(result.totals.contingency).toBeNull();
    expect(result.totals.rom).toBeNull();
    const missing = result.missingInputs.find((entry) => entry.key === 'roleRate');
    expect(missing?.effect).toBe('calculation-blocked');
    expect(missing?.affected).toEqual(['WS_01']);
    expect(workstreamById(result, 'WS_PH_1').cost).not.toBeNull();
    expect(result.roleSummary.find((role) => role.roleId === 'security-engineer')?.cost).toBeNull();
    expect(result.confidence).toBe('Low');
    expect(result.explanation).toContain('blocked');
  });

  it('reduces confidence and lists null users, environments, regions and deadline', () => {
    const result = calculateEstimate(calculationInput({ suggestion: platformSuggestion(), config: createDefaultSolutionConfig() }));
    const keys = result.missingInputs.map((entry) => entry.key);
    expect(keys).toEqual(expect.arrayContaining(['expectedUsers', 'environments', 'targetRegions', 'deliveryDeadline']));
    expect(result.missingInputs.every((entry) => entry.effect === 'confidence-reduced')).toBe(true);
    expect(result.missingInputs.find((entry) => entry.key === 'environments')?.affected).toEqual(['WS_01']);
    expect(result.missingInputs.find((entry) => entry.key === 'deliveryDeadline')?.affected).toEqual(['Timeline']);
    expect(workstreamById(result, 'WS_01').confidence).toBe('Medium');
    expect(workstreamById(result, 'WS_02').confidence).toBe('High');
    expect(result.confidence).toBe('Low');
    expect(result.deadlineAssessment).toContain('No delivery deadline was provided');
    expect(workstreamById(result, 'WS_01').adjustments.some((adjustment) => adjustment.label.startsWith('Extra environments'))).toBe(false);
  });

  it('keeps the overall level at Medium while fewer than four distinct inputs are missing', () => {
    const config = { ...createDefaultSolutionConfig(), expectedUsers: 20_000, environments: 3 };
    const result = calculateEstimate(calculationInput({ suggestion: platformSuggestion(), config }));
    expect(new Set(result.missingInputs.map((entry) => entry.key))).toEqual(new Set(['targetRegions', 'deliveryDeadline']));
    expect(result.confidence).toBe('Medium');
  });

  it('lowers the right workstream to Low for a critical gap and restores it when resolved', () => {
    const open = calculateEstimate(calculationInput({ suggestion: platformSuggestion(), scope: fixtureScope() }));
    const integration = workstreamById(open, 'WS_02');
    expect(integration.confidence).toBe('Low');
    expect(integration.confidenceLimitations.join(' ')).toContain('External API readiness has not been confirmed.');
    expect(integration.confidenceLimitations.join(' ')).toContain('GAP_01 "CRM API readiness unknown"');
    expect(workstreamById(open, 'WS_01').confidence).toBe('High');
    expect(open.missingInputs.find((entry) => entry.key === 'integrationReadiness')?.relatedScopeIds).toEqual(['GAP_01']);
    expect(open.confidence).toBe('Low');

    const resolved = calculateEstimate(calculationInput({ suggestion: platformSuggestion(), scope: resolveItems(fixtureScope(), ['GAP_01', 'DEP_01']) }));
    expect(workstreamById(resolved, 'WS_02').confidence).toBe('High');
    expect(workstreamById(resolved, 'WS_02').effortDays.high).toBeLessThan(integration.effortDays.high);
    expect(resolved.confidence).toBe('High');
  });

  it('holds a workstream at Medium while a delivery dependency of its requirements is outstanding', () => {
    const gapClosed = calculateEstimate(calculationInput({ suggestion: platformSuggestion(), scope: resolveItems(fixtureScope(), ['GAP_01']) }));
    const integration = workstreamById(gapClosed, 'WS_02');
    expect(integration.confidence).toBe('Medium');
    expect(integration.confidenceLimitations).toEqual([expect.stringContaining('Salesforce API access (DEP_01) is an outstanding delivery dependency')]);
    expect(integration.effortDays.likely).toBe(workstreamById(calculateEstimate(calculationInput({ suggestion: platformSuggestion(), scope: resolveItems(fixtureScope(), ['GAP_01', 'DEP_01']) })), 'WS_02').effortDays.likely);
    expect(workstreamById(gapClosed, 'WS_01').confidence).toBe('High');
  });

  it('reports a driver without a base-effort value as a blocked scope driver', () => {
    const config = createDefaultEstimationConfig();
    const estimationConfig = { ...config, baseEffort: config.baseEffort.filter((row) => row.driverType !== 'data') };
    const result = calculateEstimate(calculationInput({ estimationConfig }));
    const missing = result.missingInputs.find((entry) => entry.key === 'scopeDrivers');
    expect(missing?.effect).toBe('calculation-blocked');
    expect(missing?.affected).toEqual(['WS_01']);
    expect(workstreamById(result, 'WS_01').baseDays).toBe(22);
    expect(workstreamById(result, 'WS_01').cost).toBeNull();
    expect(result.totals.rom).toBeNull();
  });

  it('returns a well-formed, blocked result for an empty suggestion', () => {
    const result = calculateEstimate(calculationInput({ suggestion: suggestionOf([]) }));
    expect(result.totals.effortDays).toEqual({ low: 0, likely: 0, high: 0 });
    expect(result.totals.timelineWeeks.likely).toBe(0);
    expect(result.totals.rom).toBeNull();
    expect(result.confidence).toBe('Low');
    expect(result.missingInputs.find((entry) => entry.key === 'scopeDrivers')?.effect).toBe('calculation-blocked');
    expect(JSON.stringify(result)).not.toMatch(/NaN|undefined/);
  });
});

describe('calculateEstimate - overrides, confidence and determinism', () => {
  it('applies a reviewer override and marks the driver as user-set', () => {
    const result = calculateEstimate(calculationInput({ overrides: [{ driverId: 'DRV_01', complexity: 'Low' }] }));
    const [first, second] = workstreamById(result, 'WS_01').drivers;
    expect(first?.complexity).toBe('Low');
    expect(first?.unitDays).toBe(6);
    expect(first?.complexitySource).toBe('user-set');
    expect(second?.complexitySource).toBe('ai-suggested');
    expect(workstreamById(result, 'WS_01').calculation.at(0)).toContain('set by the reviewer; the AI suggested High');
  });

  it('drops to Medium confidence for a Very High driver and for related open questions', () => {
    const veryHigh = calculateEstimate(calculationInput({ suggestion: suggestionOf([workstream('WS_01', 'PH_4', [driver('DRV_01', 'ai', 'Very High')])]) }));
    expect(workstreamById(veryHigh, 'WS_01').confidence).toBe('Medium');
    expect(workstreamById(veryHigh, 'WS_01').effortDays).toEqual({ low: 38, likely: 45, high: 59 });
    // The driver id is a parenthetical reference, not the sentence's bare subject.
    expect(workstreamById(veryHigh, 'WS_01').confidenceLimitations.join(' ')).toContain('(DRV_01) is rated Very High complexity');

    const related = calculateEstimate(
      calculationInput({ scope: fixtureScope(), suggestion: suggestionOf([workstream('WS_01', 'PH_2', [driver('DRV_01', 'capability', 'Low', ['FR_01'])], ['FR_01'])]) }),
    );
    expect(workstreamById(related, 'WS_01').confidenceLimitations.join(' ')).toContain('Q_01');
    expect(workstreamById(related, 'WS_01').confidence).toBe('Medium');
    expect(workstreamById(related, 'WS_PH_5').confidence).toBe('Medium');
  });

  it('keeps overall confidence Medium when a small share of effort is Low', () => {
    const suggestion = suggestionOf([
      workstream('WS_01', 'PH_2', [driver('DRV_01', 'capability', 'Very High'), driver('DRV_02', 'capability', 'High'), driver('DRV_03', 'capability', 'High')]),
      workstream('WS_02', 'PH_3', [driver('DRV_04', 'integration', 'Low', ['INT_01'])], ['INT_01']),
    ]);
    const result = calculateEstimate(calculationInput({ suggestion, scope: fixtureScope() }));
    expect(workstreamById(result, 'WS_02').confidence).toBe('Low');
    expect(result.confidence).toBe('Medium');
  });

  it('is deterministic and does not mutate its input', () => {
    const input = calculationInput({ suggestion: platformSuggestion(), scope: fixtureScope() });
    const before = JSON.stringify(input);
    expect(calculateEstimate(input)).toEqual(calculateEstimate(input));
    expect(JSON.stringify(input)).toBe(before);
  });

  it('snapshots the configuration instead of sharing it', () => {
    const input = calculationInput();
    const result = calculateEstimate(input);
    expect(result.configSnapshot).not.toBe(input.estimationConfig);
    expect(result.configSnapshot.rates).not.toBe(input.estimationConfig.rates);
  });

  it('appends the commercial assumptions after the suggested ones', () => {
    const suggestion = { ...platformSuggestion(), assumptions: [{ id: 'EA_01', text: 'Policy documents are digitised.', refs: ['ASM_01'] }] };
    const result = calculateEstimate(calculationInput({ suggestion }));
    expect(result.assumptions.map((note) => note.id)).toEqual(['EA_01', 'EA_02', 'EA_03', 'EA_04']);
    expect(result.assumptions.at(1)?.text).toContain('team of 6 people');
  });
});

describe('calculateEstimate - deadline assessment', () => {
  it('confirms a comfortable deadline and the smallest sufficient team', () => {
    const result = calculateEstimate(calculationInput());
    expect(result.deadlineAssessment).toContain('30-week deadline is achievable');
    expect(result.deadlineAssessment).toContain('smallest average team that still meets the deadline at the likely effort is 1');
  });

  it('flags a deadline at risk and states the team size needed', () => {
    const result = calculateEstimate(calculationInput({ config: completeConfig({ deliveryDeadlineWeeks: 4 }) }));
    expect(result.deadlineAssessment).toContain('4-week deadline is at risk');
    expect(result.deadlineAssessment).toContain('An average team of about 7 (currently 6)');
  });

  it('says when adding people cannot meet the deadline', () => {
    const result = calculateEstimate(calculationInput({ config: completeConfig({ deliveryDeadlineWeeks: 2 }) }));
    expect(result.deadlineAssessment).toContain('Adding people alone cannot meet it');
  });
});
