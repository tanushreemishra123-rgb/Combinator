import type { AiStrategyOutput, DataIntegrationOutput, IntegrationSpec } from '../domain';
import { fixtureScope } from '../test/fixtures';
import { fixtureArchitectureDesign } from './testFixtures';
import { validateAiSolution, validateDataIntegration } from './validate';

function integration(overrides: Partial<IntegrationSpec> = {}): IntegrationSpec {
  return {
    id: 'IF_01',
    name: 'Salesforce CRM profile sync',
    system: 'Salesforce CRM',
    systemType: 'internal',
    direction: 'bidirectional',
    pattern: 'event',
    protocol: 'Event stream (publish/subscribe) carrying JSON payloads',
    authentication: 'OAuth 2.0 client credentials grant',
    errorHandling: 'Idempotency keys and a dead-letter queue protect every retried call.',
    retry: 'Exponential backoff up to 5 attempts.',
    monitoring: 'Tracked in Azure Monitor.',
    dataSync: 'Salesforce CRM is the system of record.',
    requirementIds: ['INT_01'],
    componentIds: ['ARC_06'],
    complexity: 'Medium',
    readiness: 'unknown',
    ...overrides,
  };
}

function baseDataOutput(): DataIntegrationOutput {
  return {
    domains: [{ id: 'DD_01', name: 'Member and Policy Document Data', description: 'x', sources: [], owner: 'To be confirmed with customer', classification: 'regulated', requirementIds: ['DATA_01'] }],
    topics: [{ topic: 'ownership', approach: 'x', services: [], requirementIds: ['DATA_01'] }],
    integrations: [integration()],
    flows: [],
  };
}

describe('validateDataIntegration', () => {
  it('drops an unknown requirement id and reports it', () => {
    const scope = fixtureScope();
    const design = fixtureArchitectureDesign();
    const output = baseDataOutput();
    output.domains = output.domains.map((domain) => ({ ...domain, requirementIds: [...domain.requirementIds, 'FR_99'] }));
    const { value, issues } = validateDataIntegration(output, scope, design);
    expect(value.domains.at(0)?.requirementIds).toEqual(['DATA_01']);
    expect(issues.some((issue) => issue.code === 'unknown-requirement-id' && issue.refs.includes('FR_99'))).toBe(true);
  });

  it('flags an integration that cites no reviewed requirement as an unsupported recommendation', () => {
    const scope = fixtureScope();
    const design = fixtureArchitectureDesign();
    const output = baseDataOutput();
    output.integrations = [integration({ requirementIds: [] })];
    const { issues } = validateDataIntegration(output, scope, design);
    expect(issues.some((issue) => issue.code === 'unsupported-recommendation')).toBe(true);
  });

  it('drops a componentId that does not exist in the design and reports it', () => {
    const scope = fixtureScope();
    const design = fixtureArchitectureDesign();
    const output = baseDataOutput();
    output.integrations = [integration({ componentIds: ['ARC_99'] })];
    const { value, issues } = validateDataIntegration(output, scope, design);
    expect(value.integrations.at(0)?.componentIds).toEqual([]);
    expect(issues.some((issue) => issue.code === 'unknown-component-id')).toBe(true);
  });

  it('flags a missing data topic', () => {
    const scope = fixtureScope();
    const design = fixtureArchitectureDesign();
    const output = baseDataOutput();
    const { issues } = validateDataIntegration(output, scope, design);
    const missing = issues.find((issue) => issue.code === 'missing-data-topic');
    expect(missing).toBeDefined();
    expect(missing?.message).toContain('backup-recovery');
  });

  it('reports no issues for a fully grounded, complete output', () => {
    const scope = fixtureScope();
    const design = fixtureArchitectureDesign();
    const output = baseDataOutput();
    output.topics = [
      'ownership', 'ingestion', 'transactional-storage', 'analytical-storage', 'data-quality',
      'metadata-governance', 'retention', 'privacy-security', 'reporting-analytics', 'backup-recovery',
    ].map((topic) => ({ topic: topic as DataIntegrationOutput['topics'][number]['topic'], approach: 'x', services: [], requirementIds: ['DATA_01'] }));
    const { issues } = validateDataIntegration(output, scope, design);
    expect(issues).toEqual([]);
  });
});

function useCase(overrides: Partial<AiStrategyOutput['useCases'][number]> = {}): AiStrategyOutput['useCases'][number] {
  return {
    id: 'AIUC_01',
    name: 'Policy Question Assistant',
    description: 'x',
    requirementIds: ['FR_03'],
    pattern: 'Retrieval-augmented generation (RAG) assistant',
    modelOptions: ['Azure OpenAI Service in Azure AI Foundry'],
    retrieval: 'Retrieves passages first.',
    orchestration: 'Multi-step graph.',
    evaluation: 'Golden set.',
    safety: 'Prompt-injection defence.',
    privacy: 'PII minimised.',
    humanReview: 'Human confirms binding decisions.',
    monitoring: 'Tracked in Azure Monitor.',
    complexity: 'High',
    ...overrides,
  };
}

describe('validateAiSolution', () => {
  it('drops an unknown requirement id from a use case', () => {
    const scope = fixtureScope();
    const output: AiStrategyOutput = { applicable: true, summary: [{ text: 'x', refs: [], label: 'ai-interpretation' }], useCases: [useCase({ requirementIds: ['FR_03', 'FR_99'] })], boundaries: [], architecturePattern: '', frameworks: [], promptManagement: '', evaluationApproach: '', responsibleAi: [], monitoringAndFeedback: '', dataPrivacy: '' };
    const { value, issues } = validateAiSolution(output, scope);
    expect(value.useCases.at(0)?.requirementIds).toEqual(['FR_03']);
    expect(issues.some((issue) => issue.code === 'unknown-requirement-id')).toBe(true);
  });

  it('flags a use case with no reviewed requirement as unsupported', () => {
    const scope = fixtureScope();
    const output: AiStrategyOutput = { applicable: true, summary: [{ text: 'x', refs: [], label: 'ai-interpretation' }], useCases: [useCase({ requirementIds: [] })], boundaries: [], architecturePattern: '', frameworks: [], promptManagement: '', evaluationApproach: '', responsibleAi: [], monitoringAndFeedback: '', dataPrivacy: '' };
    const { issues } = validateAiSolution(output, scope);
    expect(issues.some((issue) => issue.code === 'unsupported-recommendation')).toBe(true);
  });

  it('flags a use case missing a safeguard field without filling it in', () => {
    const scope = fixtureScope();
    const output: AiStrategyOutput = { applicable: true, summary: [{ text: 'x', refs: [], label: 'ai-interpretation' }], useCases: [useCase({ safety: '', humanReview: '' })], boundaries: [], architecturePattern: '', frameworks: [], promptManagement: '', evaluationApproach: '', responsibleAi: [], monitoringAndFeedback: '', dataPrivacy: '' };
    const { value, issues } = validateAiSolution(output, scope);
    expect(value.useCases.at(0)?.safety).toBe('');
    const issue = issues.find((candidate) => candidate.code === 'ai-safeguard-missing');
    expect(issue?.message).toContain('safety');
    expect(issue?.message).toContain('humanReview');
  });

  it('does not demand safeguards when the strategy is not applicable', () => {
    const scope = fixtureScope();
    const output: AiStrategyOutput = { applicable: false, summary: [{ text: 'x', refs: [], label: 'ai-interpretation' }], useCases: [], boundaries: [], architecturePattern: '', frameworks: [], promptManagement: '', evaluationApproach: '', responsibleAi: [], monitoringAndFeedback: '', dataPrivacy: '' };
    const { issues } = validateAiSolution(output, scope);
    expect(issues).toEqual([]);
  });

  it('flags a framework recommendation with too short a rationale', () => {
    const scope = fixtureScope();
    const output: AiStrategyOutput = {
      applicable: true,
      summary: [{ text: 'x', refs: [], label: 'ai-interpretation' }],
      useCases: [useCase()],
      boundaries: [],
      architecturePattern: '',
      frameworks: [{ name: 'LangGraph', category: 'orchestration', rationale: 'Because it is popular.', requirementIds: ['FR_03'], alternatives: [] }],
      promptManagement: '',
      evaluationApproach: '',
      responsibleAi: [],
      monitoringAndFeedback: '',
      dataPrivacy: '',
    };
    const { issues } = validateAiSolution(output, scope);
    expect(issues.some((issue) => issue.code === 'weak-framework-rationale')).toBe(true);
  });
});
