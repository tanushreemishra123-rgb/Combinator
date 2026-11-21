import { complexityFromLevel, complexityLevel, raiseComplexity, atLeast } from './complexity';
import { describeTimelineCalculation, describeTotalsCalculation } from './engine/narrative';
import { calculateEstimate } from './engine/calculateEstimate';
import { countOf, formatFactor, formatMoney, formatPct, formatTenths, joinList } from './format';
import { isBuildPhase, phaseForDriverType, phaseName } from './phases';
import { relatedOpenItems } from './scopeFacts';
import { fixtureScope } from '../test/fixtures';
import { calculationInput, resolveItems } from './testing/estimateFixtures';
import { createDefaultEstimationConfig } from '../seed/estimationDefaults';

describe('formatMoney', () => {
  it('formats whole amounts with separators and the currency code', () => {
    expect(formatMoney(25536, 'USD')).toBe('25,536 USD');
    expect(formatMoney(1234.56, 'eur')).toBe('1,235 EUR');
    expect(formatMoney(0, 'GBP')).toBe('0 GBP');
  });

  it('never prints NaN or an empty currency placeholder', () => {
    expect(formatMoney(Number.NaN, 'USD')).toBe('0 USD');
    expect(formatMoney(5000, '  ')).toBe('5,000');
  });
});

describe('text helpers', () => {
  it('formats factors, percentages, tenths, counts and lists', () => {
    expect(formatFactor(1)).toBe('1.00');
    expect(formatPct(12.5)).toBe('12.5%');
    expect(formatTenths(33.6)).toBe('33.6');
    expect(countOf(1, 'week')).toBe('1 week');
    expect(countOf(3, 'week')).toBe('3 weeks');
    expect(joinList([])).toBe('');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

describe('complexity and phase vocabulary', () => {
  it('moves along the four-level scale and clamps at the ends', () => {
    expect(complexityLevel('Very High')).toBe(4);
    expect(complexityFromLevel(0)).toBe('Low');
    expect(raiseComplexity('High', 3)).toBe('Very High');
    expect(atLeast('Low', 'High')).toBe('High');
  });

  it('knows the build phases and where each driver type is delivered', () => {
    expect(isBuildPhase('PH_3')).toBe(true);
    expect(isBuildPhase('PH_5')).toBe(false);
    expect(phaseForDriverType('ai')).toBe('PH_4');
    expect(phaseForDriverType('security')).toBe('PH_2');
    expect(phaseName('PH_6', 'fallback')).toBe('Deployment and Handover');
    expect(phaseName('PH_X', 'Custom phase')).toBe('Custom phase');
  });
});

describe('relatedOpenItems', () => {
  it('finds open gaps and questions linked from the referenced requirements only while unresolved', () => {
    expect(relatedOpenItems(fixtureScope(), ['FR_01', 'INT_01']).map((item) => item.id)).toEqual(['GAP_01', 'Q_01']);
    expect(relatedOpenItems(resolveItems(fixtureScope(), ['Q_01']), ['FR_01']).map((item) => item.id)).toEqual([]);
  });
});

describe('describeTotalsCalculation', () => {
  it('traces subtotal, contingency and ROM so they can be reproduced by hand', () => {
    const lines = describeTotalsCalculation(calculateEstimate(calculationInput()));
    expect(lines).toContain('Subtotal (likely) = sum of workstream costs 39,124 USD -> rounded to 1,000 = 39,000 USD');
    expect(lines).toContain('Contingency (likely) = 39,000 USD x 15% -> rounded = 6,000 USD');
    expect(lines).toContain('ROM (likely) = subtotal + contingency = 45,000 USD');
  });

  it('explains a blocked ROM instead of showing a partial number', () => {
    const config = createDefaultEstimationConfig();
    const estimationConfig = { ...config, rates: config.rates.map((rate) => ({ ...rate, dayRate: rate.roleId === 'qa-engineer' ? null : rate.dayRate })) };
    const lines = describeTotalsCalculation(calculateEstimate(calculationInput({ estimationConfig })));
    expect(lines.at(-1)).toBe('ROM blocked until the missing inputs are provided: Day rate for QA Engineer');
  });
});

describe('describeTimelineCalculation', () => {
  it('walks team capacity through every scheduled phase to the total weeks', () => {
    const input = calculationInput();
    const result = calculateEstimate(input);
    const lines = describeTimelineCalculation(result, input.estimationConfig);
    expect(lines).toHaveLength(result.phases.length + 2);
    expect(lines.at(0)).toContain('Team capacity =');
    expect(lines.at(0)).toContain('rule CR_12');
    for (const phase of result.phases) {
      const line = lines.find((entry) => entry.startsWith(`${phase.name} (${phase.id})`));
      expect(line, `expected a trace line for ${phase.id}`).toBeDefined();
    }
    const total = lines.at(-1);
    expect(total).toContain('Total timeline =');
    expect(total).toContain(`${result.totals.timelineWeeks.likely}`);
  });

  it('uses the same numbers the engine already computed, so it never contradicts the result', () => {
    const result = calculateEstimate(calculationInput({ config: { ...calculationInput().config, deliveryDeadlineWeeks: 4 } }));
    const lines = describeTimelineCalculation(result, createDefaultEstimationConfig());
    expect(lines.join(' ')).not.toMatch(/undefined|NaN|\[object/);
  });
});
