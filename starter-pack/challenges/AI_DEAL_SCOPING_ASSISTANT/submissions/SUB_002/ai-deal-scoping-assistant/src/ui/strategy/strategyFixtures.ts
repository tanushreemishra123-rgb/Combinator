/**
 * Hand-built strategy-domain fixtures for this workspace's tests, independent of the strategy
 * engine module's own output shape, so these unit tests never depend on another module's runtime
 * behaviour. Every builder takes an optional partial override.
 */
import type {
  AiStrategyOutput,
  AiUseCase,
  ArchitectureComponent,
  ArchitectureDesign,
  DataDomain,
  DataFlow,
  DataIntegrationOutput,
  DataTopicPlan,
  FrameworkRecommendation,
  GenerationMeta,
  IntegrationSpec,
  ProcessingBoundary,
  TracedStatement,
} from '../../domain';

export function fixtureGenerationMeta(overrides: Partial<GenerationMeta> = {}): GenerationMeta {
  return {
    providerId: 'mock-heuristic',
    providerLabel: 'Mock Heuristic Engine',
    mode: 'mock',
    usedFallback: false,
    generatedAt: '2026-09-19T00:00:00.000Z',
    durationMs: 90,
    scopeVersion: 1,
    issues: [],
    ...overrides,
  };
}

export function fixtureDataDomain(overrides: Partial<DataDomain> = {}): DataDomain {
  return {
    id: 'DOM_01',
    name: 'Member profile data',
    description: 'Member identity, contact and profile attributes.',
    sources: ['Member Portal Web App', 'Salesforce CRM'],
    owner: 'Member Services',
    classification: 'confidential',
    requirementIds: ['FR_01'],
    ...overrides,
  };
}

export function fixtureDataTopicPlan(overrides: Partial<DataTopicPlan> = {}): DataTopicPlan {
  return {
    topic: 'ownership',
    approach: 'Member Services owns member profile data; Policy Operations owns policy documents.',
    services: ['Azure SQL Database'],
    requirementIds: ['FR_01'],
    ...overrides,
  };
}

export function fixtureIntegrationSpec(overrides: Partial<IntegrationSpec> = {}): IntegrationSpec {
  return {
    id: 'INTEG_01',
    name: 'Salesforce CRM profile sync',
    system: 'Salesforce CRM',
    systemType: 'external',
    direction: 'bidirectional',
    pattern: 'api',
    protocol: 'REST/JSON over HTTPS',
    authentication: 'OAuth 2.0 client credentials',
    errorHandling: 'Failed records go to a dead-letter queue with alerting.',
    retry: 'Exponential backoff, up to 3 attempts.',
    monitoring: 'Azure Monitor integration dashboard with failure alerts.',
    dataSync: 'Near real-time via the integration event bus.',
    requirementIds: ['INT_01'],
    componentIds: ['ARC_07'],
    complexity: 'Medium',
    readiness: 'unknown',
    ...overrides,
  };
}

export function fixtureDataFlow(overrides: Partial<DataFlow> = {}): DataFlow {
  return {
    from: 'Salesforce CRM',
    to: 'Integration Platform',
    payload: 'Member profile updates',
    mechanism: 'REST API over HTTPS',
    ...overrides,
  };
}

export function fixtureDataIntegrationOutput(overrides: Partial<DataIntegrationOutput> = {}): DataIntegrationOutput {
  return {
    domains: [fixtureDataDomain()],
    topics: [fixtureDataTopicPlan()],
    integrations: [fixtureIntegrationSpec()],
    flows: [fixtureDataFlow()],
    ...overrides,
  };
}

export function fixtureAiUseCase(overrides: Partial<AiUseCase> = {}): AiUseCase {
  return {
    id: 'AI_01',
    name: 'Policy question assistant',
    description: 'Answers member policy questions from the document library.',
    requirementIds: ['FR_03'],
    pattern: 'Retrieval-augmented generation',
    modelOptions: ['Azure OpenAI GPT-4o', 'Anthropic Claude'],
    retrieval: 'Vector search over indexed policy documents.',
    orchestration: 'Single-turn RAG pipeline.',
    evaluation: 'Answer relevance scored against a held-out question set.',
    safety: 'Content filtering on both the prompt and the response.',
    privacy: 'No personal data beyond the member question is sent to the model.',
    humanReview: 'Escalates to a human agent when confidence is low.',
    monitoring: 'Logs prompts, responses and confidence scores.',
    complexity: 'Medium',
    ...overrides,
  };
}

export function fixtureProcessingBoundary(overrides: Partial<ProcessingBoundary> = {}): ProcessingBoundary {
  return {
    activity: 'Answering free-text policy questions',
    type: 'ai',
    reason: 'Requires natural-language understanding over unstructured documents.',
    requirementIds: ['FR_03'],
    ...overrides,
  };
}

export function fixtureFrameworkRecommendation(overrides: Partial<FrameworkRecommendation> = {}): FrameworkRecommendation {
  return {
    name: 'LangChain',
    category: 'orchestration',
    rationale: 'Coordinates retrieval and generation for the policy assistant use case (FR_03).',
    requirementIds: ['FR_03'],
    alternatives: ['LangGraph', 'Custom orchestration'],
    ...overrides,
  };
}

export function fixtureAiStrategyOutput(overrides: Partial<AiStrategyOutput> = {}): AiStrategyOutput {
  return {
    applicable: true,
    summary: [{ text: 'One AI-driven capability was identified: a policy question assistant (FR_03).', refs: ['FR_03'], label: 'ai-interpretation' }],
    useCases: [fixtureAiUseCase()],
    boundaries: [fixtureProcessingBoundary()],
    architecturePattern: 'Retrieval-augmented generation sits behind the API gateway; the orchestration layer calls the model service.',
    frameworks: [fixtureFrameworkRecommendation()],
    promptManagement: 'Prompts are versioned templates with structured JSON output validated against a schema.',
    evaluationApproach: 'A held-out set of policy questions is scored for relevance and groundedness before release.',
    responsibleAi: ['Responses cite the source document section.', 'Low-confidence answers are routed to a human agent.'],
    monitoringAndFeedback: 'Every response is logged with a thumbs up or down for continuous evaluation.',
    dataPrivacy: 'No personal data is sent to the model beyond the member question text.',
    ...overrides,
  };
}

function architectureComponent(overrides: Partial<ArchitectureComponent> & Pick<ArchitectureComponent, 'id' | 'name' | 'service'>): ArchitectureComponent {
  return {
    area: 'integration',
    logicalComponent: 'integration-platform',
    requirementIds: [],
    assumptionIds: [],
    purpose: `${overrides.name} implements an area of the solution.`,
    rationale: `${overrides.service} is the managed service selected for this component.`,
    tradeOffs: [],
    dependencies: [],
    securityConsiderations: [],
    ...overrides,
  };
}

/** Minimal architecture design with just the component the integration inventory fixture cites. */
export function fixtureArchitectureDesign(overrides: Partial<ArchitectureDesign> = {}): ArchitectureDesign {
  const summary: TracedStatement[] = [{ text: 'Azure landing zone sized for 50,000 members.', refs: ['NFR_02'], label: 'ai-interpretation' }];
  return {
    platform: 'azure',
    summary,
    components: [architectureComponent({ id: 'ARC_07', name: 'Integration Platform', service: 'Azure Logic Apps' })],
    flows: [],
    environments: [],
    deployment: [],
    availability: [],
    backupDr: [],
    securityControls: [],
    selection: 'ai-recommended',
    recommendation: {
      recommended: 'azure',
      scores: [{ platform: 'azure', score: 10, reasons: [{ text: 'Customer team prefers Microsoft Azure.', refs: ['TECH_01'], points: 10 }] }],
      explanation: 'Azure scores highest because the customer team prefers it.',
    },
    ...overrides,
  };
}
