import { CALCULATION_RULES } from './rules';

describe('CALCULATION_RULES', () => {
  it('documents every calculation step with a unique id, a formula and a description', () => {
    const ids = CALCULATION_RULES.map((rule) => rule.id);
    expect(ids).toEqual(ids.map((_, index) => `CR_${String(index + 1).padStart(2, '0')}`));
    expect(ids).toHaveLength(15);
    expect(CALCULATION_RULES.every((rule) => rule.name !== '' && rule.formula !== '' && rule.description.length > 40)).toBe(true);
  });

  it('covers effort, confidence, commercials, timeline, missing inputs and historical data', () => {
    const names = CALCULATION_RULES.map((rule) => rule.name);
    expect(names).toEqual(
      expect.arrayContaining(['Driver effort', 'Environment uplift', 'Productivity factor', 'Overhead phases', 'Workstream confidence', 'Effort range', 'Role allocation', 'ROM commercials', 'Timeline', 'Deadline assessment', 'Missing inputs', 'Historical references']),
    );
  });

  it('states the documented thresholds from the engine constants', () => {
    expect(CALCULATION_RULES.find((rule) => rule.id === 'CR_07')?.formula).toContain('>= 30% of build effort');
    expect(CALCULATION_RULES.find((rule) => rule.id === 'CR_12')?.description).toContain('last 25% of the build window');
  });
});
