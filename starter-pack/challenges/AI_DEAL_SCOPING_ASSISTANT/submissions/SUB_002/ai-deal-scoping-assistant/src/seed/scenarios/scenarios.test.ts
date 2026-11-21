import { SEED_SCENARIOS } from '..';
import type { ScenarioCategory } from '..';
import { SCENARIOS } from '.';

const REQUIRED_CATEGORIES: readonly ScenarioCategory[] = [
  'application-modernization',
  'data-integration',
  'ai-enabled',
  'missing-information',
];

const FORBIDDEN_SUBSTRINGS = ['lorem', 'acme', 'tbd-placeholder'];

describe('seed scenarios', () => {
  it('ships exactly the four required scenarios', () => {
    expect(SCENARIOS).toHaveLength(4);
    expect(SEED_SCENARIOS).toHaveLength(4);
  });

  it('has exactly one scenario per required category', () => {
    for (const category of REQUIRED_CATEGORIES) {
      const matches = SCENARIOS.filter((scenario) => scenario.category === category);
      expect(matches).toHaveLength(1);
    }
  });

  it('gives every scenario a unique, non-empty id', () => {
    const ids = SCENARIOS.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.length).toBeGreaterThan(0);
  });

  it('writes each requirementsText as a realistic multi-section document without placeholder content', () => {
    for (const scenario of SCENARIOS) {
      const lineCount = scenario.requirementsText.split('\n').length;
      expect(lineCount).toBeGreaterThanOrEqual(50);
      expect(lineCount).toBeLessThanOrEqual(120);
      expect(scenario.requirementsText).toMatch(/##/);

      const lowerText = scenario.requirementsText.toLowerCase();
      for (const forbidden of FORBIDDEN_SUBSTRINGS) {
        expect(lowerText.includes(forbidden)).toBe(false);
      }
      expect(scenario.requirementsText).not.toMatch(/\{[^}]*\}/);
    }
  });

  it('never uses filler customer or company names', () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.customer.customerName.toLowerCase()).not.toBe('acme');
      expect(scenario.customer.customerName.length).toBeGreaterThan(3);
      expect(scenario.customer.industry.length).toBeGreaterThan(0);
      expect(scenario.customer.opportunityName.length).toBeGreaterThan(0);
    }
  });

  it('only sets a cloud platform and user-selected mode when the text states a preference', () => {
    const withPreference = SCENARIOS.filter((scenario) => scenario.config.cloudPlatform !== null);
    // application-modernization (Azure), data-integration (GCP) and ai-enabled (AWS) state a preference.
    expect(withPreference).toHaveLength(3);
    for (const scenario of withPreference) {
      expect(scenario.config.cloudSelectionMode).toBe('user-selected');
    }
    const recommend = SCENARIOS.filter((scenario) => scenario.config.cloudPlatform === null);
    for (const scenario of recommend) {
      expect(scenario.config.cloudSelectionMode).toBe('recommend');
    }
  });

  it('leaves every volume/deadline/environment input null for the missing-information scenario', () => {
    const missingInfo = SCENARIOS.find((scenario) => scenario.category === 'missing-information');
    expect(missingInfo).toBeDefined();
    expect(missingInfo?.config.expectedUsers).toBeNull();
    expect(missingInfo?.config.deliveryDeadlineWeeks).toBeNull();
    expect(missingInfo?.config.environments).toBeNull();
    expect(missingInfo?.config.cloudPlatform).toBeNull();
    expect(missingInfo?.config.targetRegions).toHaveLength(0);
  });

  it('states expected users, environments or a deadline only for the three fully-specified scenarios', () => {
    const specified = SCENARIOS.filter((scenario) => scenario.category !== 'missing-information');
    for (const scenario of specified) {
      expect(scenario.config.expectedUsers).not.toBeNull();
      expect(scenario.config.deliveryDeadlineWeeks).not.toBeNull();
      expect(scenario.config.environments).not.toBeNull();
    }
  });
});
