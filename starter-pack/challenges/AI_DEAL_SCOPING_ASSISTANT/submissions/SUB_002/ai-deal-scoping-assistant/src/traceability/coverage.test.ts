import { describe, expect, it } from 'vitest';
import { emptyOutputs } from '../domain';
import type {
  AiStrategyOutput,
  AiUseCase,
  ArchitectureComponent,
  ArchitectureDesign,
  Capability,
  DataDomain,
  DataIntegrationOutput,
  DataTopicPlan,
  DriverSuggestion,
  EstimateBundle,
  FrameworkRecommendation,
  IntegrationSpec,
  NumericRange,
  PrdBundle,
  ScopingSession,
  SectionState,
  TracedStatement,
  UserJourney,
  WorkstreamSuggestion,
} from '../domain';
import { createScopeModel, updateScopeItem } from '../scope';
import { createDefaultEstimationConfig } from '../seed/estimationDefaults';
import { fixtureScope, fixtureSession, FIXTURE_NOW } from '../test/fixtures';
import { buildCoverageReport, buildTraceLinks } from './index';

// --- small, hand-built builders for the generated-output shapes traceability reads -------------

function statement(text: string): TracedStatement {
  return { text, refs: [], label: 'ai-interpretation' };
}

function capability(overrides: Partial<Capability> & Pick<Capability, 'id' | 'name' | 'requirementIds'>): Capability {
  return {
    scope: 'Scope description.',
    priority: 'Medium',
    dependencies: [],
    label: 'customer-requested',
    module: 'Core Platform',
    workstream: 'Core Platform',
    deliveryPackage: 'Package 1',
    acceptance: [],
    ...overrides,
  };
}

function journey(overrides: Partial<UserJourney> & Pick<UserJourney, 'id' | 'name' | 'requirementIds'>): UserJourney {
  return { persona: 'Member', steps: ['Step 1'], ...overrides };
}

function archComponent(
  overrides: Partial<ArchitectureComponent> & Pick<ArchitectureComponent, 'id' | 'name' | 'requirementIds' | 'assumptionIds'>,
): ArchitectureComponent {
  return {
    area: 'backend',
    logicalComponent: 'compute',
    service: 'App Service',
    purpose: 'Hosts the API.',
    rationale: 'Matches the platform-native compute service.',
    tradeOffs: [],
    dependencies: [],
    securityConsiderations: [],
    ...overrides,
  };
}

function architectureDesign(components: ArchitectureComponent[]): ArchitectureDesign {
  return {
    platform: 'azure',
    summary: [statement('Solution summary.')],
    components,
    flows: [],
    environments: [],
    deployment: [],
    availability: [],
    backupDr: [],
    securityControls: [],
    selection: 'user-selected',
    recommendation: { recommended: 'azure', scores: [], explanation: 'Matches the customer-stated Azure preference.' },
  };
}

function dataDomain(overrides: Partial<DataDomain> & Pick<DataDomain, 'id' | 'name' | 'requirementIds'>): DataDomain {
  return { description: 'Domain description.', sources: [], owner: 'To be confirmed with customer', classification: 'internal', ...overrides };
}

function dataTopicPlan(overrides: Partial<DataTopicPlan> & Pick<DataTopicPlan, 'topic' | 'requirementIds'>): DataTopicPlan {
  return { approach: 'Approach description.', services: [], ...overrides };
}

function integrationSpec(overrides: Partial<IntegrationSpec> & Pick<IntegrationSpec, 'id' | 'name' | 'requirementIds'>): IntegrationSpec {
  return {
    system: 'Salesforce CRM',
    systemType: 'external',
    direction: 'bidirectional',
    pattern: 'api',
    protocol: 'REST/JSON over HTTPS',
    authentication: 'OAuth 2.0 client credentials',
    errorHandling: 'Retries with exponential backoff and a dead-letter queue.',
    retry: 'Up to 3 attempts.',
    monitoring: 'Cloud-native alerting on failure rate.',
    dataSync: '',
    componentIds: [],
    complexity: 'Medium',
    readiness: 'unknown',
    ...overrides,
  };
}

function aiUseCase(overrides: Partial<AiUseCase> & Pick<AiUseCase, 'id' | 'name' | 'requirementIds'>): AiUseCase {
  return {
    description: 'Use case description.',
    pattern: 'Retrieval-augmented generation',
    modelOptions: [],
    retrieval: '',
    orchestration: '',
    evaluation: '',
    safety: '',
    privacy: '',
    humanReview: '',
    monitoring: '',
    complexity: 'Medium',
    ...overrides,
  };
}

function framework(overrides: Partial<FrameworkRecommendation> & Pick<FrameworkRecommendation, 'name' | 'requirementIds'>): FrameworkRecommendation {
  return { category: 'orchestration', rationale: 'Rationale.', alternatives: [], ...overrides };
}

function driverSuggestion(refIds: string[]): DriverSuggestion {
  return { id: 'DRV_01', type: 'capability', label: 'Core build effort', complexity: 'Medium', rationale: 'Matches the cited requirements.', refIds };
}

function workstreamSuggestion(
  overrides: Partial<WorkstreamSuggestion> & Pick<WorkstreamSuggestion, 'id' | 'name' | 'requirementIds'>,
): WorkstreamSuggestion {
  return { phaseId: 'PH_2', drivers: [driverSuggestion(overrides.requirementIds)], skills: [], ...overrides };
}

function estimateBundle(workstreams: WorkstreamSuggestion[]): EstimateBundle {
  const zeroRange: NumericRange = { low: 0, likely: 0, high: 0 };
  return {
    suggestion: { workstreams, risks: [], dependencies: [], assumptions: [], exclusions: [], explanation: '' },
    overrides: [],
    result: {
      workstreams: [],
      phases: [],
      totals: { effortDays: zeroRange, effortPersonWeeks: zeroRange, timelineWeeks: zeroRange, subtotal: null, contingency: null, rom: null },
      roleSummary: [],
      confidence: 'Medium',
      missingInputs: [],
      risks: [],
      dependencies: [],
      assumptions: [],
      exclusions: [],
      explanation: '',
      rules: [],
      deadlineAssessment: '',
      configSnapshot: createDefaultEstimationConfig(),
      computedAt: FIXTURE_NOW,
    },
  };
}

function section<T>(data: T): SectionState<T> {
  return { data, status: 'current', reviewed: false, meta: null, staleReasons: [] };
}

/**
 * A session over `fixtureScope()` with a deliberate mix of coverage: some requirements covered by
 * a capability, a component or a strategy element, one covered only by a workstream (which must
 * NOT count), two requirements cited nowhere, and two capabilities that fail the unsupported checks.
 */
function buildScenarioSession(): ScopingSession {
  const prdBundle: PrdBundle = {
    prd: {
      title: 'Member Portal Modernisation PRD',
      sections: [],
      journeys: [journey({ id: 'JRN_01', name: 'Member self-service journey', requirementIds: ['FR_01'] })],
    },
    functionalScope: {
      capabilities: [
        capability({ id: 'CAP_01', name: 'Member Registration', requirementIds: ['FR_01'] }),
        capability({ id: 'CAP_03', name: 'Unsupported Capability', requirementIds: [] }),
        capability({ id: 'CAP_04', name: 'Ghost Capability', requirementIds: ['FR_99'] }),
      ],
      recommendedEnhancements: [
        capability({ id: 'CAP_02', name: 'Proactive Renewal Reminders', requirementIds: ['BR_01'], label: 'recommended-enhancement' }),
      ],
      modules: [],
      workstreams: [],
      deliveryPackages: [],
      outOfScope: [],
    },
  };

  const architecture = architectureDesign([archComponent({ id: 'ARC_01', name: 'Identity Service', requirementIds: ['NFR_01'], assumptionIds: ['ASM_01'] })]);

  const dataIntegration: DataIntegrationOutput = {
    domains: [dataDomain({ id: 'DOM_01', name: 'Member and Policy Data', requirementIds: ['DATA_01'] })],
    topics: [dataTopicPlan({ topic: 'ingestion', requirementIds: ['DATA_01'] })],
    integrations: [integrationSpec({ id: 'ITG_01', name: 'Salesforce Sync', requirementIds: ['INT_01'] })],
    flows: [],
  };

  const aiStrategy: AiStrategyOutput = {
    applicable: true,
    summary: [statement('AI assistant answers policy questions from the document library.')],
    useCases: [aiUseCase({ id: 'AI_01', name: 'Policy Q&A Assistant', requirementIds: ['FR_03'] })],
    boundaries: [],
    architecturePattern: 'Retrieval-augmented generation over the policy document library.',
    frameworks: [framework({ name: 'LangChain', requirementIds: ['FR_03'] })],
    promptManagement: '',
    evaluationApproach: '',
    responsibleAi: [],
    monitoringAndFeedback: '',
    dataPrivacy: '',
  };

  const estimate = estimateBundle([workstreamSuggestion({ id: 'WS_01', name: 'Core Platform Build', requirementIds: ['FR_02'] })]);

  return {
    ...fixtureSession(),
    outputs: {
      prd: section(prdBundle),
      architecture: section(architecture),
      dataIntegration: section(dataIntegration),
      aiStrategy: section(aiStrategy),
      estimate: section(estimate),
    },
  };
}

describe('buildTraceLinks', () => {
  it('returns no links when no stage has generated anything', () => {
    expect(buildTraceLinks(fixtureSession())).toEqual([]);
  });

  it('skips sections whose data is still null', () => {
    const prdData = buildScenarioSession().outputs.prd.data;
    if (prdData === null) {
      throw new Error('test fixture is missing its PRD bundle');
    }
    const session: ScopingSession = { ...fixtureSession(), outputs: { ...emptyOutputs(), prd: section(prdData) } };
    const links = buildTraceLinks(session);
    expect(links.every((link) => link.targetType === 'capability' || link.targetType === 'journey')).toBe(true);
    expect(links.length).toBeGreaterThan(0);
  });

  it('links a capability to every requirement id it cites', () => {
    const links = buildTraceLinks(buildScenarioSession());
    expect(links).toContainEqual({ requirementId: 'FR_01', targetType: 'capability', targetId: 'CAP_01', targetLabel: 'Member Registration' });
  });

  it('links an architecture component through both requirementIds and assumptionIds', () => {
    const links = buildTraceLinks(buildScenarioSession());
    expect(links).toContainEqual({ requirementId: 'NFR_01', targetType: 'component', targetId: 'ARC_01', targetLabel: 'Identity Service' });
    expect(links).toContainEqual({ requirementId: 'ASM_01', targetType: 'component', targetId: 'ARC_01', targetLabel: 'Identity Service' });
  });

  it('identifies a framework recommendation by its name, having no id of its own', () => {
    const links = buildTraceLinks(buildScenarioSession());
    expect(links).toContainEqual({ requirementId: 'FR_03', targetType: 'framework', targetId: 'LangChain', targetLabel: 'LangChain' });
  });

  it('links a data-strategy topic under a readable label', () => {
    const links = buildTraceLinks(buildScenarioSession());
    expect(links).toContainEqual({ requirementId: 'DATA_01', targetType: 'dataTopic', targetId: 'ingestion', targetLabel: 'Data ingestion' });
  });
});

describe('buildCoverageReport', () => {
  it('returns an empty report when there is no scope model yet', () => {
    const session: ScopingSession = { ...buildScenarioSession(), scope: null };
    expect(buildCoverageReport(session)).toEqual({
      rows: [],
      links: [],
      totalRequirements: 0,
      coveredRequirements: 0,
      coveragePct: 0,
      highPriorityCoveragePct: 0,
      uncoveredIds: [],
      unsupportedAdditions: [],
    });
  });

  it('sorts rows by kind then id, matching the reviewed requirement order', () => {
    const report = buildCoverageReport(buildScenarioSession());
    expect(report.rows.map((row) => row.requirementId)).toEqual(['BR_01', 'FR_01', 'FR_02', 'FR_03', 'NFR_01', 'NFR_02', 'INT_01', 'DATA_01', 'SEC_01']);
  });

  it('marks a requirement covered by a capability, a component or a strategy element', () => {
    const report = buildCoverageReport(buildScenarioSession());
    const byId = new Map(report.rows.map((row) => [row.requirementId, row]));
    expect(byId.get('FR_01')?.covered).toBe(true); // capability
    expect(byId.get('NFR_01')?.covered).toBe(true); // architecture component
    expect(byId.get('DATA_01')?.covered).toBe(true); // data domain + topic (strategy)
    expect(byId.get('DATA_01')?.strategyIds.sort()).toEqual(['DOM_01', 'Data ingestion']);
    expect(byId.get('INT_01')?.covered).toBe(true); // integration (strategy)
    expect(byId.get('FR_03')?.covered).toBe(true); // AI use case + framework (strategy)
  });

  it('does not count a workstream citation alone as coverage', () => {
    const report = buildCoverageReport(buildScenarioSession());
    const row = report.rows.find((candidate) => candidate.requirementId === 'FR_02');
    expect(row?.workstreamIds).toEqual(['WS_01']);
    expect(row?.covered).toBe(false);
  });

  it('lists every uncovered requirement, in row order', () => {
    const report = buildCoverageReport(buildScenarioSession());
    expect(report.uncoveredIds).toEqual(['FR_02', 'NFR_02', 'SEC_01']);
  });

  it('rounds coveragePct and highPriorityCoveragePct to whole numbers', () => {
    const report = buildCoverageReport(buildScenarioSession());
    expect(report.totalRequirements).toBe(9);
    expect(report.coveredRequirements).toBe(6);
    expect(report.coveragePct).toBe(67); // 6 / 9
    expect(report.highPriorityCoveragePct).toBe(80); // 4 of 5 High-priority requirements covered
  });

  it('reports 0% (not 100%) when there are no requirements of that class yet', () => {
    const scope = createScopeModel('Early-stage discovery.', [
      { id: 'ASM_01', kind: 'assumption', title: 'Assumption', description: 'D', priority: 'Medium', provenance: 'assumed', source: null, relatedIds: [], affectsInputs: [], critical: false },
    ]);
    const session: ScopingSession = { ...fixtureSession(), scope, outputs: emptyOutputs() };
    const report = buildCoverageReport(session);
    expect(report.totalRequirements).toBe(0);
    expect(report.coveragePct).toBe(0);
    expect(report.highPriorityCoveragePct).toBe(0);
  });

  it('does not count a requirement excluded from scope as uncovered', () => {
    const scenario = buildScenarioSession();
    const excludedScope = updateScopeItem(fixtureScope(), 'FR_02', { inScope: false });
    const report = buildCoverageReport({ ...scenario, scope: excludedScope });
    expect(report.totalRequirements).toBe(8);
    expect(report.rows.some((row) => row.requirementId === 'FR_02')).toBe(false);
    expect(report.uncoveredIds).not.toContain('FR_02');
  });

  it('flags a capability that cites nothing', () => {
    const report = buildCoverageReport(buildScenarioSession());
    const addition = report.unsupportedAdditions.find((candidate) => candidate.targetId === 'CAP_03');
    expect(addition).toBeDefined();
    expect(addition?.unknownRefs).toEqual([]);
    expect(addition?.reason).toContain('CAP_03');
  });

  it('flags a capability that cites an id outside the approved scope, listing it in unknownRefs', () => {
    const report = buildCoverageReport(buildScenarioSession());
    const addition = report.unsupportedAdditions.find((candidate) => candidate.targetId === 'CAP_04');
    expect(addition).toBeDefined();
    expect(addition?.unknownRefs).toEqual(['FR_99']);
    expect(addition?.reason).toContain('FR_99');
  });

  it('does not flag a recommended-enhancement capability that cites a valid requirement', () => {
    const report = buildCoverageReport(buildScenarioSession());
    expect(report.unsupportedAdditions.some((candidate) => candidate.targetId === 'CAP_02')).toBe(false);
  });

  it('flags exactly the two unsupported capabilities and nothing else', () => {
    const report = buildCoverageReport(buildScenarioSession());
    expect(report.unsupportedAdditions.map((addition) => addition.targetId).sort()).toEqual(['CAP_03', 'CAP_04']);
  });
});
