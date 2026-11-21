import { describe, expect, it } from 'vitest';
import type { Capability, PrdOutput } from '../domain';
import { fixtureScope } from '../test/fixtures';
import { validatePrdOutput } from './validate';

const BASE_CAPABILITY: Capability = {
  id: 'CAP_01',
  name: 'Identity, Sign-In and Profile Management',
  scope: 'Provide identity.',
  requirementIds: ['FR_01'],
  priority: 'High',
  dependencies: [],
  label: 'customer-requested',
  module: 'Platform Foundation',
  workstream: 'Identity and Access',
  deliveryPackage: 'Package 1 - Foundation',
  acceptance: [],
};

function baseOutput(overrides: Partial<PrdOutput> = {}): PrdOutput {
  return {
    overview: [{ text: 'Overview.', refs: ['BR_01'], label: 'customer-requested' }],
    businessProblem: [{ text: 'Problem.', refs: ['BR_01'], label: 'customer-requested' }],
    journeys: [],
    capabilities: [BASE_CAPABILITY],
    recommendedEnhancements: [],
    outOfScope: [],
    ...overrides,
  };
}

describe('validatePrdOutput', () => {
  it('removes an unknown requirement id from a capability and raises an unknown-reference warning', () => {
    const capability = { ...BASE_CAPABILITY, requirementIds: ['FR_01', 'FR_99'] };
    const { output, issues } = validatePrdOutput(baseOutput({ capabilities: [capability] }), fixtureScope());
    expect(output.capabilities.at(0)?.requirementIds).toEqual(['FR_01']);
    expect(issues.some((issue) => issue.code === 'unknown-reference')).toBe(true);
  });

  it('removes an unknown requirement id from a journey and raises an unknown-reference warning', () => {
    const journeys = [{ id: 'JNY_01', name: 'Member journey', persona: 'PER_01', steps: ['Step 1'], requirementIds: ['FR_01', 'FR_98'] }];
    const { output, issues } = validatePrdOutput(baseOutput({ journeys }), fixtureScope());
    expect(output.journeys.at(0)?.requirementIds).toEqual(['FR_01']);
    expect(issues.filter((issue) => issue.code === 'unknown-reference')).toHaveLength(1);
  });

  it('keeps but flags a capability that ends up citing no requirement', () => {
    const capability = { ...BASE_CAPABILITY, requirementIds: ['FR_97'] };
    const { output, issues } = validatePrdOutput(baseOutput({ capabilities: [capability] }), fixtureScope());
    expect(output.capabilities).toHaveLength(1);
    expect(output.capabilities.at(0)?.requirementIds).toEqual([]);
    expect(issues.some((issue) => issue.code === 'unsupported-scope-addition')).toBe(true);
  });

  it('renumbers capabilities so ids stay unique', () => {
    const capabilities = [
      { ...BASE_CAPABILITY, id: 'CAP_01', requirementIds: ['FR_01'] },
      { ...BASE_CAPABILITY, id: 'CAP_01', name: 'Search and Discovery', requirementIds: ['FR_02'] },
    ];
    const { output } = validatePrdOutput(baseOutput({ capabilities }), fixtureScope());
    expect(output.capabilities.map((capability) => capability.id)).toEqual(['CAP_01', 'CAP_02']);
  });

  it('adds an info issue for a High-priority requirement not cited by any capability', () => {
    const { issues } = validatePrdOutput(baseOutput({ capabilities: [BASE_CAPABILITY] }), fixtureScope());
    // NFR_01 is High priority in the fixture and is not cited by BASE_CAPABILITY.
    const uncovered = issues.find((issue) => issue.code === 'uncovered-high-priority' && issue.refs.includes('NFR_01'));
    expect(uncovered).toBeDefined();
    expect(uncovered?.severity).toBe('info');
  });

  it('raises no uncovered-high-priority issue once every High-priority requirement is cited', () => {
    const capabilities = [
      { ...BASE_CAPABILITY, id: 'CAP_01', requirementIds: ['BR_01', 'FR_01', 'NFR_01', 'INT_01', 'SEC_01'] },
    ];
    const { issues } = validatePrdOutput(baseOutput({ capabilities }), fixtureScope());
    expect(issues.some((issue) => issue.code === 'uncovered-high-priority')).toBe(false);
  });

  it('leaves a fully grounded output free of issues', () => {
    const capabilities = [{ ...BASE_CAPABILITY, requirementIds: ['FR_01', 'NFR_01', 'INT_01', 'SEC_01', 'BR_01', 'FR_02', 'FR_03', 'NFR_02', 'DATA_01'] }];
    const { issues } = validatePrdOutput(baseOutput({ capabilities }), fixtureScope());
    expect(issues).toEqual([]);
  });
});
