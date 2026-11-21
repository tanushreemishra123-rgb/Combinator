import type { AiStrategyOutput, DataIntegrationOutput, GenerationMeta } from '../domain';
import { fixtureConfig, fixtureCustomer, fixtureScope } from '../test/fixtures';
import { fixtureArchitectureDesign } from './testFixtures';
import { generateAiStrategy, generateDataIntegration } from './stage';

// Vitest hoists vi.mock calls above every import in this file, so './stage' below already
// resolves '../ai' to this mock when it runs.
const runTaskMock = vi.fn();
vi.mock('../ai', () => ({ runTask: (...args: unknown[]) => runTaskMock(...args) }));

function meta(): GenerationMeta {
  return { providerId: 'mock', providerLabel: 'Mock Provider', mode: 'mock', usedFallback: false, generatedAt: '2026-09-19T00:00:00.000Z', durationMs: 5, scopeVersion: 1, issues: [] };
}

function strategyInput() {
  return { scope: fixtureScope(), customer: fixtureCustomer(), config: fixtureConfig(), design: fixtureArchitectureDesign() };
}

const runOptions = { provider: { id: 'mock', label: 'Mock', mode: 'mock' as const, complete: vi.fn() }, fallback: null, scopeVersion: 1 };

describe('generateDataIntegration', () => {
  it('runs the task then folds semantic validation issues into meta', async () => {
    const value: DataIntegrationOutput = {
      domains: [{ id: 'DD_01', name: 'Member Data', description: 'x', sources: [], owner: 'To be confirmed with customer', classification: 'internal', requirementIds: ['FR_99'] }],
      topics: [{ topic: 'ownership', approach: 'x', services: [], requirementIds: [] }],
      integrations: [],
      flows: [],
    };
    runTaskMock.mockResolvedValueOnce({ value, meta: meta() });

    const result = await generateDataIntegration(strategyInput(), runOptions);

    expect(runTaskMock).toHaveBeenCalledOnce();
    expect(result.plan.domains.at(0)?.requirementIds).toEqual([]);
    expect(result.meta.issues.some((issue) => issue.code === 'unknown-requirement-id')).toBe(true);
    expect(result.meta.issues.some((issue) => issue.code === 'missing-data-topic')).toBe(true);
  });
});

describe('generateAiStrategy', () => {
  it('runs the task then folds semantic validation issues into meta', async () => {
    const value: AiStrategyOutput = {
      applicable: true,
      summary: [{ text: 'x', refs: [], label: 'ai-interpretation' }],
      useCases: [
        {
          id: 'AIUC_01',
          name: 'Policy Assistant',
          description: 'x',
          requirementIds: ['FR_03'],
          pattern: 'Retrieval-augmented generation (RAG) assistant',
          modelOptions: [],
          retrieval: '',
          orchestration: '',
          evaluation: '',
          safety: '',
          privacy: 'x',
          humanReview: 'x',
          monitoring: '',
          complexity: 'High',
        },
      ],
      boundaries: [],
      architecturePattern: '',
      frameworks: [],
      promptManagement: '',
      evaluationApproach: '',
      responsibleAi: [],
      monitoringAndFeedback: '',
      dataPrivacy: '',
    };
    runTaskMock.mockResolvedValueOnce({ value, meta: meta() });

    const result = await generateAiStrategy(strategyInput(), runOptions);

    expect(runTaskMock).toHaveBeenCalledOnce();
    const issue = result.meta.issues.find((candidate) => candidate.code === 'ai-safeguard-missing');
    expect(issue?.message).toContain('evaluation');
    expect(issue?.message).toContain('safety');
  });
});
