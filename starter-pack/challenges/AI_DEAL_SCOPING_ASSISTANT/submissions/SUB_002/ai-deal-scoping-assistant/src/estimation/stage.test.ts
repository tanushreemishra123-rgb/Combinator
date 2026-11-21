import type { AiProvider, EstimateContext, TaskRunOptions } from '../ai/types';
import type {
  AiStrategyOutput,
  ArchitectureDesign,
  DataIntegrationOutput,
  EstimateSuggestion,
  GenerationMeta,
  PrdBundle,
} from '../domain';
import { createDefaultEstimationConfig } from '../seed/estimationDefaults';
import { fixtureCustomer, fixtureScope, FIXTURE_NOW } from '../test/fixtures';
import { planEstimateInputs } from './inputPlanner';
import { buildEstimateContext, generateEstimate, recalculate } from './stage';
import { completeConfig, estimateContext } from './testing/estimateFixtures';
import type { EstimateInput } from './types';

const aiMock = vi.hoisted(() => ({ suggest: (_context: unknown): unknown => null }));

vi.mock('../ai', () => ({
  buildSystemPrompt: (role: string) => `You are ${role}.`,
  describeScopeForPrompt: () => 'scope',
  describeCustomerForPrompt: () => 'customer',
  describeConfigForPrompt: () => 'config',
  jsonContract: () => 'contract',
  runTask: async (_task: unknown, context: unknown) => ({ value: aiMock.suggest(context), meta: mockMeta() }),
}));

function mockMeta(): GenerationMeta {
  return {
    providerId: 'mock',
    providerLabel: 'Mock AI',
    mode: 'mock',
    usedFallback: false,
    generatedAt: FIXTURE_NOW,
    durationMs: 1,
    scopeVersion: 1,
    issues: [{ severity: 'info', code: 'ai.mock', message: 'Mock provider used.', refs: [] }],
  };
}

const provider: AiProvider = { id: 'mock', label: 'Mock AI', mode: 'mock', complete: async () => '' };
const RUN: TaskRunOptions = { provider, fallback: null, scopeVersion: 1 };

function estimateInput(overrides: Partial<EstimateInput> = {}): EstimateInput {
  const context = estimateContext();
  const enhancement = context.capabilities.slice(0, 1).map((capability) => ({ ...capability, id: 'CAP_09', label: 'recommended-enhancement' as const }));
  return {
    scope: fixtureScope(),
    customer: fixtureCustomer(),
    config: completeConfig(),
    estimationConfig: createDefaultEstimationConfig(),
    prd: { functionalScope: { capabilities: context.capabilities, recommendedEnhancements: enhancement } } as PrdBundle,
    design: { components: context.components } as ArchitectureDesign,
    dataIntegration: { integrations: context.integrations } as DataIntegrationOutput,
    aiStrategy: { applicable: true, useCases: context.aiUseCases } as AiStrategyOutput,
    overrides: [],
    ...overrides,
  };
}

describe('buildEstimateContext', () => {
  it('collects capabilities, components, integrations and AI use cases from the deliverables', () => {
    const context = buildEstimateContext(estimateInput());
    expect(context.task).toBe('suggest-estimate-inputs');
    expect(context.capabilities.map((capability) => capability.id)).toEqual(['CAP_01', 'CAP_02', 'CAP_03', 'CAP_09']);
    expect(context.components).toHaveLength(5);
    expect(context.integrations.map((spec) => spec.id)).toEqual(['IS_01']);
    expect(context.aiUseCases.map((useCase) => useCase.id)).toEqual(['AIUC_01']);
  });

  it('ignores AI use cases when the AI strategy is not applicable', () => {
    const input = estimateInput();
    const context = buildEstimateContext({ ...input, aiStrategy: { ...input.aiStrategy, applicable: false } });
    expect(context.aiUseCases).toEqual([]);
  });
});

describe('generateEstimate', () => {
  beforeEach(() => {
    aiMock.suggest = (context) => planEstimateInputs(context as EstimateContext);
  });

  it('runs the task, validates the suggestion and calculates the numbers', async () => {
    const { bundle, meta } = await generateEstimate(estimateInput(), RUN);
    expect(bundle.suggestion.workstreams.length).toBeGreaterThan(3);
    expect(bundle.result.workstreams.length).toBe(bundle.suggestion.workstreams.length + 3);
    expect(bundle.result.totals.effortDays.likely).toBeGreaterThan(0);
    expect(bundle.result.totals.rom).not.toBeNull();
    expect(bundle.result.computedAt).toBe(FIXTURE_NOW);
    expect(meta.issues.map((issue) => issue.code)).toEqual(['ai.mock']);
    expect(bundle.result.exclusions.map((note) => note.text).join(' ')).toContain('Recommended enhancement CAP_09');
  });

  it('appends semantic validation issues to the generation meta', async () => {
    aiMock.suggest = (context) => {
      const planned = planEstimateInputs(context as EstimateContext);
      const tampered: EstimateSuggestion = {
        ...planned,
        workstreams: planned.workstreams.map((workstream) => ({ ...workstream, phaseId: 'PH_6', requirementIds: [...workstream.requirementIds, 'FR_404'] })),
        explanation: 'The work takes 40 weeks.',
      };
      return tampered;
    };
    const { bundle, meta } = await generateEstimate(estimateInput(), RUN);
    const issueCodes = meta.issues.map((issue) => issue.code);
    expect(issueCodes).toEqual(expect.arrayContaining(['ai.mock', 'estimate.invalid-phase', 'estimate.unknown-reference', 'estimate.figure-removed']));
    expect(bundle.suggestion.workstreams.every((workstream) => ['PH_2', 'PH_3', 'PH_4'].includes(workstream.phaseId))).toBe(true);
    expect(bundle.result.explanation).not.toContain('40 weeks');
  });

  it('keeps applicable complexity overrides and reports dropped ones', async () => {
    const overrides = [{ driverId: 'DRV_01', complexity: 'Very High' as const }, { driverId: 'DRV_99', complexity: 'Low' as const }];
    const { bundle, meta } = await generateEstimate(estimateInput({ overrides }), RUN);
    expect(bundle.overrides).toEqual([{ driverId: 'DRV_01', complexity: 'Very High' }]);
    expect(meta.issues.at(-1)?.code).toBe('estimate.override-dropped');
    const overridden = bundle.result.workstreams.flatMap((workstream) => workstream.drivers).find((driver) => driver.id === 'DRV_01');
    expect(overridden).toEqual(expect.objectContaining({ complexity: 'Very High', complexitySource: 'user-set', unitDays: 40 }));
  });
});

describe('recalculate', () => {
  it('recomputes the numbers from the stored suggestion without an AI call', async () => {
    aiMock.suggest = (context) => planEstimateInputs(context as EstimateContext);
    const input = estimateInput();
    const { bundle } = await generateEstimate(input, RUN);
    aiMock.suggest = () => {
      throw new Error('recalculate must not call the AI');
    };
    const pricier = { ...input.estimationConfig, contingencyPct: 30, currency: 'GBP' };
    const next = recalculate(bundle, input.scope, input.config, pricier, [{ driverId: 'DRV_02', complexity: 'Low' }], '2026-10-01T00:00:00.000Z');
    expect(next.suggestion).toBe(bundle.suggestion);
    expect(next.overrides).toEqual([{ driverId: 'DRV_02', complexity: 'Low' }]);
    expect(next.result.computedAt).toBe('2026-10-01T00:00:00.000Z');
    expect(next.result.totals.rom?.currency).toBe('GBP');
    expect(next.result.totals.effortDays.likely).toBeLessThan(bundle.result.totals.effortDays.likely);
    expect(next.result.configSnapshot.contingencyPct).toBe(30);
  });
});
