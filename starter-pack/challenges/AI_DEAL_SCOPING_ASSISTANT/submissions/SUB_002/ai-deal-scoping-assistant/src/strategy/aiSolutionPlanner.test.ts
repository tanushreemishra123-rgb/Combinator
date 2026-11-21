import type { AiSolutionContext } from '../ai/types';
import type { ScopeItem } from '../domain';
import { fixtureConfig, fixtureCustomer, fixtureScope } from '../test/fixtures';
import { planAiSolution } from './aiSolutionPlanner';
import { fixtureArchitectureDesign } from './testFixtures';

function context(overrides: Partial<AiSolutionContext> = {}): AiSolutionContext {
  const design = fixtureArchitectureDesign();
  return {
    task: 'plan-ai-solution',
    scope: fixtureScope(),
    customer: fixtureCustomer(),
    config: fixtureConfig(),
    platform: design.platform,
    components: design.components,
    ...overrides,
  };
}

/** Clones the fixture's one `ai:*` item into a second, unrelated use case (a different AI pattern group), so a test can exercise plural-use-case wording. */
function secondUseCaseScope(): AiSolutionContext['scope'] {
  const scope = fixtureScope();
  const base = scope.items.find((item) => item.id === 'FR_03');
  if (base === undefined) {
    throw new Error('fixture scope no longer contains FR_03');
  }
  const extraction: ScopeItem = { ...base, id: 'FR_20', title: 'Document extraction', description: 'Extract structured fields from uploaded documents.', signals: ['ai:extraction'], relatedIds: [] };
  scope.items = [...scope.items, extraction];
  return scope;
}

/** Clones the fixture's SEC_01 item so a test can restate it with a compliance signal and its own wording, e.g. one that puts an obligation on the AI/model provider itself. */
function complianceScope(overrides: Partial<ScopeItem>): AiSolutionContext['scope'] {
  const scope = fixtureScope();
  const base = scope.items.find((item) => item.id === 'SEC_01');
  if (base === undefined) {
    throw new Error('fixture scope no longer contains SEC_01');
  }
  scope.items = [...scope.items, { ...base, ...overrides }];
  return scope;
}

describe('planAiSolution', () => {
  it('is not applicable, and invents no use case, when no requirement carries an ai:* signal', () => {
    const scope = fixtureScope();
    scope.items = scope.items.filter((item) => !item.signals.some((signal) => signal.startsWith('ai:')));
    const output = planAiSolution(context({ scope }));
    expect(output.applicable).toBe(false);
    expect(output.useCases).toEqual([]);
    expect(output.frameworks).toEqual([]);
    expect(output.summary.length).toBeGreaterThan(0);
    // Deterministic activities are still reported so the boundary table is not empty.
    expect(output.boundaries.every((row) => row.type === 'deterministic')).toBe(true);
    expect(output.boundaries.length).toBeGreaterThan(0);
  });

  it('builds one use case per ai signal group, merging co-occurring signals into one pattern', () => {
    const output = planAiSolution(context());
    expect(output.applicable).toBe(true);
    expect(output.useCases).toHaveLength(1);
    const useCase = output.useCases.at(0);
    expect(useCase?.pattern).toBe('Retrieval-augmented generation (RAG) assistant');
    expect(useCase?.requirementIds).toEqual(['FR_03']);
    expect(useCase?.evaluation.length).toBeGreaterThan(0);
    expect(useCase?.safety.length).toBeGreaterThan(0);
    expect(useCase?.privacy.length).toBeGreaterThan(0);
    expect(useCase?.humanReview.length).toBeGreaterThan(0);
    expect(useCase?.retrieval.length).toBeGreaterThan(0);
  });

  it('separates AI, deterministic and human-decision activities in the boundary table', () => {
    const output = planAiSolution(context());
    const types = new Set(output.boundaries.map((row) => row.type));
    expect(types.has('ai')).toBe(true);
    expect(types.has('deterministic')).toBe(true);
    expect(types.has('human-decision')).toBe(true);
  });

  it('gives every framework recommendation a rationale citing a reviewed requirement id, plus alternatives', () => {
    const output = planAiSolution(context());
    expect(output.frameworks.length).toBeGreaterThan(0);
    for (const framework of output.frameworks) {
      expect(framework.rationale).toContain('FR_03');
      expect(framework.rationale.length).toBeGreaterThan(40);
      expect(framework.alternatives.length).toBeGreaterThan(0);
    }
  });

  it('recommends LangGraph for the multi-step RAG assistant workflow', () => {
    const output = planAiSolution(context());
    const orchestration = output.frameworks.find((framework) => framework.category === 'orchestration');
    expect(orchestration?.name).toBe('LangGraph');
  });

  it('honours an explicit anthropic model preference', () => {
    const output = planAiSolution(context({ config: fixtureConfig({ aiProviderPreference: 'anthropic' }) }));
    const useCase = output.useCases.at(0);
    expect(useCase?.modelOptions.join(' ')).toContain('Anthropic Claude');
  });

  it('is deterministic for the same input', () => {
    const first = planAiSolution(context());
    const second = planAiSolution(context());
    expect(second).toEqual(first);
  });

  it('never names this tool\'s own mock provider in customer-facing prompt-management text', () => {
    const output = planAiSolution(context());
    expect(output.promptManagement.toLowerCase()).not.toContain('mock provider');
  });

  it('cross-references responsible-AI text to the boundaries section by its real, exported heading', () => {
    const output = planAiSolution(context());
    const humanDecisionStatement = output.responsibleAi.find((statement) => statement.includes('mandatory human decision'));
    expect(humanDecisionStatement).toContain('AI vs deterministic vs human-decision boundaries');
    expect(humanDecisionStatement).not.toContain('Processing Boundaries');
  });

  it('agrees the monitoring verb with a single use case ("is monitored")', () => {
    const output = planAiSolution(context());
    expect(output.useCases).toHaveLength(1);
    expect(output.monitoringAndFeedback).toContain('is monitored for request volume');
  });

  it('agrees the monitoring verb with several use cases ("are monitored")', () => {
    const output = planAiSolution(context({ scope: secondUseCaseScope() }));
    expect(output.useCases.length).toBeGreaterThan(1);
    expect(output.monitoringAndFeedback).toContain('are monitored for request volume');
  });

  it('names the required business-associate agreement, and its regulation and requirement id, when a compliance item puts the obligation on the AI provider itself', () => {
    const scope = complianceScope({
      id: 'SEC_02',
      title: 'HIPAA business associate agreement',
      description: 'The solution must comply with HIPAA, including a signed business associate agreement with any AI provider or subprocessor involved.',
      signals: ['compliance:hipaa'],
    });
    const output = planAiSolution(context({ scope }));
    expect(output.responsibleAi.some((statement) => statement.includes('business associate agreement') && statement.includes('SEC_02'))).toBe(true);
    expect(output.dataPrivacy).toContain('business associate agreement');
    expect(output.dataPrivacy).toContain('SEC_02');
  });

  it('states the business-associate-agreement obligation once, not once per related item, when a customer-stated requirement and a related assumption both name the AI provider', () => {
    const scope = complianceScope({
      id: 'SEC_02',
      title: 'HIPAA business associate agreement',
      description: 'The solution must comply with HIPAA, including a signed business associate agreement with any AI provider or subprocessor involved.',
      signals: ['compliance:hipaa'],
      relatedIds: ['ASM_02'],
    });
    const sec02 = scope.items.find((item) => item.id === 'SEC_02');
    if (sec02 === undefined) {
      throw new Error('expected SEC_02 in the compliance scope');
    }
    const asm02: ScopeItem = { ...sec02, id: 'ASM_02', kind: 'assumption', title: 'AI provider must support a HIPAA BAA', description: 'Assumed the selected AI provider can execute a HIPAA business associate agreement.', provenance: 'assumed', relatedIds: ['SEC_02'] };
    scope.items = [...scope.items, asm02];
    const output = planAiSolution(context({ scope }));
    const statements = output.responsibleAi.filter((statement) => statement.includes('business associate agreement'));
    expect(statements).toHaveLength(1);
    expect(statements.at(0)).toContain('SEC_02');
    expect(statements.at(0)).toContain('ASM_02');
  });

  it('never asserts a business-associate agreement obligation when no reviewed item puts one on the AI provider', () => {
    const output = planAiSolution(context());
    expect(output.responsibleAi.some((statement) => statement.includes('business associate agreement'))).toBe(false);
  });

  it('excludes a specific requirement\'s content from training, citing its id, when its own wording refuses AI retraining', () => {
    const scope = complianceScope({
      id: 'DATA_02',
      kind: 'data',
      title: 'No retraining without approval',
      description: 'Conversation logs must not be used to retrain or fine-tune any model without a separate, explicit approval process.',
      signals: [],
    });
    const output = planAiSolution(context({ scope }));
    expect(output.responsibleAi.some((statement) => statement.includes('DATA_02') && statement.includes('training'))).toBe(true);
  });
});
