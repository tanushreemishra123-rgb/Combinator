import { describe, expect, it, vi } from 'vitest';
import type { AiProvider } from '../ai/types';
import { fixtureConfig, fixtureCustomer, fixtureScope } from '../test/fixtures';

// vi.mock factories are hoisted above every import, so the mock's own state must be built with
// vi.hoisted rather than referencing a plain top-level const.
const { runTaskMock } = vi.hoisted(() => {
  const mockOutput = {
    overview: [{ text: 'Overview.', refs: ['BR_01'], label: 'customer-requested' }],
    businessProblem: [{ text: 'Problem.', refs: ['BR_01'], label: 'customer-requested' }],
    journeys: [],
    capabilities: [
      {
        id: 'CAP_01',
        name: 'Identity, Sign-In and Profile Management',
        scope: 'Provide identity.',
        requirementIds: ['FR_01', 'FR_99'],
        priority: 'High',
        dependencies: [],
        label: 'customer-requested',
        module: 'Platform Foundation',
        workstream: 'Identity and Access',
        deliveryPackage: 'Package 1 - Foundation',
        acceptance: [],
      },
    ],
    recommendedEnhancements: [],
    outOfScope: [],
  };
  const mockMeta = {
    providerId: 'mock',
    providerLabel: 'Mock',
    mode: 'mock',
    usedFallback: false,
    generatedAt: '2026-09-19T00:00:00.000Z',
    durationMs: 1,
    scopeVersion: 1,
    issues: [],
  };
  return { runTaskMock: vi.fn(async () => ({ value: mockOutput, meta: mockMeta })) };
});

vi.mock('../ai', () => ({ runTask: runTaskMock }));

import { generatePrd } from './stage';

const DUMMY_PROVIDER: AiProvider = { id: 'mock', label: 'Mock', mode: 'mock', complete: async () => '{}' };

describe('generatePrd', () => {
  it('runs the PRD task, validates the result and assembles a 14-section bundle', async () => {
    const { bundle, meta } = await generatePrd(
      { scope: fixtureScope(), customer: fixtureCustomer(), config: fixtureConfig() },
      { provider: DUMMY_PROVIDER, fallback: null, scopeVersion: 1 },
    );

    expect(runTaskMock).toHaveBeenCalledTimes(1);
    expect(bundle.prd.sections).toHaveLength(14);
    // FR_99 is not a known id in the fixture scope, so validation should have stripped it.
    expect(bundle.functionalScope.capabilities.at(0)?.requirementIds).toEqual(['FR_01']);
    expect(meta.issues.some((issue) => issue.code === 'unknown-reference')).toBe(true);
  });

  it('passes a generate-prd task context built from the input to runTask', async () => {
    const scope = fixtureScope();
    const customer = fixtureCustomer();
    await generatePrd({ scope, customer, config: fixtureConfig() }, { provider: DUMMY_PROVIDER, fallback: null, scopeVersion: 1 });

    const lastCall = runTaskMock.mock.calls.at(-1);
    const context = lastCall?.at(1);
    expect(context).toEqual({ task: 'generate-prd', scope, customer, config: fixtureConfig() });
  });
});
