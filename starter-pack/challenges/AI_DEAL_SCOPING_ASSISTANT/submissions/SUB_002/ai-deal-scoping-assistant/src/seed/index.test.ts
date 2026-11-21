import {
  createDefaultEstimationConfig,
  createDefaultSolutionConfig,
  DEFAULT_ROLE_RATES,
  getRecordedAnalysis,
  getScenario,
  SEED_SCENARIOS,
} from '.';

describe('seed module public API', () => {
  it('re-exports the estimation defaults from the original stub', () => {
    expect(DEFAULT_ROLE_RATES.length).toBeGreaterThan(0);
    expect(createDefaultEstimationConfig().rates.length).toBe(DEFAULT_ROLE_RATES.length);
    expect(createDefaultSolutionConfig().cloudPlatform).toBeNull();
  });

  it('looks up a seed scenario by id', () => {
    const first = SEED_SCENARIOS.at(0);
    expect(first).toBeDefined();
    if (first === undefined) return;
    expect(getScenario(first.id)).toBe(first);
  });

  it('returns undefined for an id that does not exist', () => {
    expect(getScenario('does-not-exist')).toBeUndefined();
  });

  it('resolves a recorded analysis end to end through the public getRecordedAnalysis', () => {
    for (const scenario of SEED_SCENARIOS) {
      const recording = getRecordedAnalysis(scenario.id, scenario.requirementsText);
      expect(recording).toBeDefined();
      expect(recording?.items.length).toBeGreaterThan(0);
    }
  });
});
