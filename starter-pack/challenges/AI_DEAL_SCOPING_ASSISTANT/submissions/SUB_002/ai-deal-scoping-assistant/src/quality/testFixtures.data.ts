/**
 * Hand-built session used only by this folder's own tests: every quality check passes against it,
 * so each test file only has to describe the one mutation that makes its check warn or fail.
 * Not exported via index.ts - test-support only.
 */
import { createSession, emptySection } from '../domain';
import type {
  AiStrategyOutput,
  ArchitectureComponent,
  ArchitectureDesign,
  DataIntegrationOutput,
  EstimateBundle,
  EstimateResult,
  PrdBundle,
  ScopeItem,
  ScopeModel,
  ScopingSession,
  SectionState,
  SessionOutputs,
  TracedStatement,
} from '../domain';
import { createDefaultEstimationConfig } from '../seed/estimationDefaults';
import { knownIds } from '../scope';
import { fixtureConfig, fixtureScope, FIXTURE_NOW } from '../test/fixtures';
import { buildCoverageReport } from '../traceability';
import type { QualityContext } from './types';

function traced(text: string, refs: readonly string[]): TracedStatement {
  return { text, refs: [...refs], label: 'ai-interpretation' };
}

function current<T>(data: T): SectionState<T> {
  return { data, status: 'current', reviewed: true, meta: null, staleReasons: [] };
}

/** `fixtureScope()` with every question, gap and assumption resolved, so unresolved-item checks start clean. */
export function buildResolvedScope(): ScopeModel {
  const resolvable: readonly ScopeItem['kind'][] = ['question', 'gap', 'assumption'];
  return { ...fixtureScope(), items: fixtureScope().items.map((item) => (resolvable.includes(item.kind) ? { ...item, resolved: true, resolution: 'Confirmed with the customer.' } : item)) };
}

function architectureComponent(id: string, name: string, area: ArchitectureComponent['area'], logicalComponent: string, service: string, requirementIds: readonly string[]): ArchitectureComponent {
  return { id, name, area, logicalComponent, service, requirementIds: [...requirementIds], assumptionIds: [], purpose: `${name} for the Member Portal.`, rationale: `${name} was selected for its fit with the reviewed requirements.`, tradeOffs: [], dependencies: [], securityConsiderations: [] };
}

/** Every requirement-kind fixture item (BR_01, FR_01-03, NFR_01-02, INT_01, DATA_01, SEC_01) is cited somewhere below. */
export const HEALTHY_ARCHITECTURE_COMPONENTS: readonly ArchitectureComponent[] = [
  architectureComponent('ARC_01', 'Customer Identity', 'identity', 'identity-customer', 'Microsoft Entra External ID', ['FR_01']),
  architectureComponent('ARC_02', 'Session Cache', 'data-storage', 'cache', 'Azure Cache for Redis', ['NFR_02']),
  architectureComponent('ARC_03', 'Member Database', 'data-storage', 'managed-relational-db', 'Azure Database for PostgreSQL - Flexible Server', ['SEC_01']),
  architectureComponent('ARC_04', 'AI Foundation Model', 'ai-ml', 'foundation-models', 'Azure OpenAI in Azure AI Foundry', ['FR_03']),
  architectureComponent('ARC_05', 'Availability & Autoscaling', 'availability', 'availability-scaling', 'Azure Load Balancer with Virtual Machine Scale Sets across Availability Zones', ['NFR_01']),
];

export function buildArchitecture(components: readonly ArchitectureComponent[] = HEALTHY_ARCHITECTURE_COMPONENTS): ArchitectureDesign {
  return {
    platform: 'azure',
    selection: 'user-selected',
    recommendation: { recommended: 'azure', scores: [], explanation: 'Azure recommended given the customer already standardises on Microsoft identity and productivity tooling.' },
    summary: [traced('Azure-based architecture for the Member Portal Modernisation.', ['FR_01'])],
    components: [...components],
    flows: [],
    environments: [{ name: 'Production', purpose: 'Serves live member traffic.', sizing: 'Standard' }],
    deployment: [traced('Deployed through a CI/CD pipeline into Azure App Service.', ['NFR_01'])],
    availability: [traced('Zone-redundant deployment sustains 99.9% availability.', ['NFR_01'])],
    backupDr: [traced('Cross-region failover is configured for disaster recovery.', ['SEC_01'])],
    securityControls: [traced('Data is encrypted at rest and in transit; GDPR controls are applied.', ['SEC_01'])],
  };
}

export function buildDataIntegration(): DataIntegrationOutput {
  return {
    domains: [{ id: 'DD_01', name: 'Member & Policy Data', description: 'Member profiles and policy documents.', sources: ['Salesforce CRM'], owner: 'Data team', classification: 'confidential', requirementIds: ['DATA_01'] }],
    topics: [{ topic: 'privacy-security', approach: 'Encrypt personal data at rest and in transit.', services: ['Azure Key Vault'], requirementIds: ['SEC_01'] }],
    integrations: [
      {
        id: 'IF_01',
        name: 'Salesforce CRM Sync',
        system: 'Salesforce',
        systemType: 'external',
        direction: 'bidirectional',
        pattern: 'api',
        protocol: 'REST/JSON over HTTPS',
        authentication: 'OAuth 2.0 client credentials',
        errorHandling: 'Retry with backoff and a dead-letter queue.',
        retry: '3 attempts with exponential backoff.',
        monitoring: 'Azure Monitor alerts on sync failures.',
        dataSync: 'Near real-time',
        requirementIds: ['INT_01'],
        componentIds: ['ARC_03'],
        complexity: 'High',
        readiness: 'confirmed',
      },
    ],
    flows: [],
  };
}

export function buildAiStrategy(useCaseOverrides: Partial<AiStrategyOutput['useCases'][number]> = {}): AiStrategyOutput {
  return {
    applicable: true,
    summary: [traced('An AI assistant answers member policy questions using retrieval-augmented generation.', ['FR_03'])],
    useCases: [
      {
        id: 'AIUC_01',
        name: 'Policy Q&A Assistant',
        description: 'Answers member questions from the policy document library.',
        requirementIds: ['FR_03'],
        pattern: 'Retrieval-augmented generation',
        modelOptions: ['Azure OpenAI GPT-4o'],
        retrieval: 'Vector search over indexed policy documents.',
        orchestration: 'Prompt orchestration through Azure AI Foundry.',
        evaluation: 'Answer relevance is scored against a held-out question set before release.',
        safety: 'Content filtering blocks unsafe or off-topic responses.',
        privacy: 'No personal data is sent to the model beyond the member question.',
        humanReview: 'Low-confidence answers are routed to a human agent.',
        monitoring: 'Azure Monitor tracks latency and failure rate.',
        complexity: 'Medium',
        ...useCaseOverrides,
      },
    ],
    boundaries: [{ activity: 'Answering policy questions', type: 'ai', reason: 'Free-text question answering benefits from language understanding.', requirementIds: ['FR_03'] }],
    architecturePattern: 'Retrieval-augmented generation on Azure OpenAI.',
    frameworks: [{ name: 'LangChain', category: 'orchestration', rationale: 'Coordinates retrieval and prompt assembly.', requirementIds: ['FR_03'], alternatives: ['Semantic Kernel'] }],
    promptManagement: 'Prompts are version-controlled and reviewed before release.',
    evaluationApproach: 'Offline evaluation against a held-out question set before every release.',
    responsibleAi: ['Human review for low-confidence answers.'],
    monitoringAndFeedback: 'Azure Monitor dashboards track usage and failure rate.',
    dataPrivacy: 'No personal data beyond the member question is sent to the model.',
  };
}

function buildPrdBundle(): PrdBundle {
  return {
    prd: {
      title: 'Member Portal Modernisation - PRD',
      sections: [{ id: 'functionalRequirements', title: 'Functional Requirements', statements: [traced('Members register and sign in with SSO.', ['FR_01'])] }],
      journeys: [{ id: 'JNY_01', name: 'Member self-service', persona: 'Member', steps: ['Register', 'Search policy documents'], requirementIds: ['FR_01', 'FR_02'] }],
    },
    functionalScope: {
      capabilities: [
        { id: 'CAP_01', name: 'Registration & SSO', scope: 'Member registration and SSO sign-in.', requirementIds: ['FR_01', 'BR_01'], priority: 'High', dependencies: [], label: 'customer-requested', module: 'Core Platform', workstream: 'Core Platform', deliveryPackage: 'Package 1', acceptance: [] },
        { id: 'CAP_02', name: 'Policy Document Search', scope: 'Search and download of policy documents.', requirementIds: ['FR_02'], priority: 'Medium', dependencies: [], label: 'customer-requested', module: 'Core Platform', workstream: 'Core Platform', deliveryPackage: 'Package 1', acceptance: [] },
        { id: 'CAP_03', name: 'AI Policy Assistant', scope: 'AI assistant answering policy questions.', requirementIds: ['FR_03'], priority: 'Low', dependencies: [], label: 'ai-interpretation', module: 'Core Platform', workstream: 'Core Platform', deliveryPackage: 'Package 1', acceptance: [] },
      ],
      recommendedEnhancements: [],
      modules: [{ name: 'Core Platform', capabilityIds: ['CAP_01', 'CAP_02', 'CAP_03'], requirementIds: ['FR_01', 'FR_02', 'FR_03'] }],
      workstreams: [{ name: 'Core Platform', capabilityIds: ['CAP_01', 'CAP_02', 'CAP_03'], requirementIds: ['FR_01', 'FR_02', 'FR_03'] }],
      deliveryPackages: [{ name: 'Package 1', capabilityIds: ['CAP_01', 'CAP_02', 'CAP_03'], requirementIds: ['FR_01', 'FR_02', 'FR_03'], engagementModel: 'dedicated-team', suggestedChallengeTypes: [] }],
      outOfScope: [],
    },
  };
}

interface WorkstreamSpec {
  id: string;
  name: string;
  phaseId: string;
  requirementIds: readonly string[];
  driverId: string;
  driverType: 'capability' | 'integration' | 'data' | 'ai' | 'infrastructure';
  days: number;
  dayRate: number;
  roleId: 'backend-engineer' | 'ai-engineer' | 'devops-engineer';
  roleLabel: string;
}

const WORKSTREAM_SPECS: readonly WorkstreamSpec[] = [
  { id: 'WS_01', name: 'Core Platform', phaseId: 'PH_2', requirementIds: ['FR_01', 'FR_02'], driverId: 'DRV_01', driverType: 'capability', days: 30, dayRate: 760, roleId: 'backend-engineer', roleLabel: 'Backend Engineer' },
  { id: 'WS_02', name: 'Integration & Data', phaseId: 'PH_3', requirementIds: ['INT_01', 'DATA_01'], driverId: 'DRV_02', driverType: 'integration', days: 34, dayRate: 760, roleId: 'backend-engineer', roleLabel: 'Backend Engineer' },
  { id: 'WS_03', name: 'AI Assistant', phaseId: 'PH_4', requirementIds: ['FR_03'], driverId: 'DRV_03', driverType: 'ai', days: 18, dayRate: 980, roleId: 'ai-engineer', roleLabel: 'AI/ML Engineer' },
  { id: 'WS_04', name: 'Cloud Infrastructure', phaseId: 'PH_1', requirementIds: ['NFR_01'], driverId: 'DRV_04', driverType: 'infrastructure', days: 5, dayRate: 820, roleId: 'devops-engineer', roleLabel: 'Cloud/DevOps Engineer' },
];

/** Builds a self-consistent `EstimateBundle` (totals equal the sum of workstreams; the estimate-consistency check passes by default). */
export function buildEstimateBundle(overrides: Partial<EstimateResult> = {}): EstimateBundle {
  const config = createDefaultEstimationConfig();
  const currency = config.currency;
  const workstreams = WORKSTREAM_SPECS.map((spec) => {
    const cost = { low: spec.days * spec.dayRate * 0.8, likely: spec.days * spec.dayRate, high: spec.days * spec.dayRate * 1.2, currency };
    const effortDays = { low: spec.days * 0.8, likely: spec.days, high: spec.days * 1.2 };
    return {
      id: spec.id,
      name: spec.name,
      phaseId: spec.phaseId,
      requirementIds: [...spec.requirementIds],
      skills: [],
      drivers: [{ id: spec.driverId, type: spec.driverType, label: `${spec.name} driver`, complexity: 'Medium' as const, rationale: `${spec.name} sized from the reviewed requirements.`, refIds: [], complexitySource: 'ai-suggested' as const, unitDays: spec.days }],
      complexity: 'Medium' as const,
      baseDays: spec.days,
      adjustments: [],
      effortDays,
      roles: [{ roleId: spec.roleId, label: spec.roleLabel, days: spec.days, dayRate: spec.dayRate, cost: cost.likely }],
      cost,
      commercialBasis: `${spec.days} person-days at the ${spec.roleLabel} day rate.`,
      confidence: 'Medium' as const,
      confidenceLimitations: [],
      calculation: [`${spec.name}: ${spec.days} likely person-days x ${spec.dayRate}.`],
    };
  });
  const effortDays = { low: workstreams.reduce((sum, ws) => sum + ws.effortDays.low, 0), likely: workstreams.reduce((sum, ws) => sum + ws.effortDays.likely, 0), high: workstreams.reduce((sum, ws) => sum + ws.effortDays.high, 0) };
  const subtotal = { low: workstreams.reduce((sum, ws) => sum + ws.cost.low, 0), likely: workstreams.reduce((sum, ws) => sum + ws.cost.likely, 0), high: workstreams.reduce((sum, ws) => sum + ws.cost.high, 0), currency };
  const contingency = { low: subtotal.low * (config.contingencyPct / 100), likely: subtotal.likely * (config.contingencyPct / 100), high: subtotal.high * (config.contingencyPct / 100), currency };
  const rom = { low: subtotal.low + contingency.low, likely: subtotal.likely + contingency.likely, high: subtotal.high + contingency.high, currency };
  const result: EstimateResult = {
    workstreams,
    phases: WORKSTREAM_SPECS.map((spec, index) => ({ id: spec.phaseId, name: spec.name, workstreamIds: [spec.id], effortDays: { low: spec.days * 0.8, likely: spec.days, high: spec.days * 1.2 }, durationWeeks: { low: 2, likely: 3, high: 4 }, startWeek: index * 3 + 1, milestone: `${spec.name} complete`, calculation: [] })),
    totals: { effortDays, effortPersonWeeks: { low: effortDays.low / 5, likely: effortDays.likely / 5, high: effortDays.high / 5 }, timelineWeeks: { low: 8, likely: 10, high: 14 }, subtotal, contingency, rom },
    roleSummary: [{ roleId: 'backend-engineer', label: 'Backend Engineer', days: 64, dayRate: 760, cost: 48640 }],
    confidence: 'Medium',
    missingInputs: [],
    risks: [],
    dependencies: [],
    assumptions: [],
    exclusions: [],
    explanation: 'Effort is derived from four workstreams covering the core platform, integration, AI assistant and cloud infrastructure.',
    rules: [],
    deadlineAssessment: 'No delivery deadline has been set, so no feasibility constraint applies yet.',
    configSnapshot: config,
    computedAt: FIXTURE_NOW,
    ...overrides,
  };
  return {
    overrides: [],
    suggestion: {
      workstreams: WORKSTREAM_SPECS.map((spec) => ({ id: spec.id, name: spec.name, phaseId: spec.phaseId, requirementIds: [...spec.requirementIds], skills: [], drivers: [{ id: spec.driverId, type: spec.driverType, label: `${spec.name} driver`, complexity: 'Medium', rationale: 'x', refIds: [] }] })),
      risks: [],
      dependencies: [],
      assumptions: [],
      exclusions: [],
      explanation: result.explanation,
    },
    result,
  };
}

export function buildOutputs(overrides: Partial<SessionOutputs> = {}): SessionOutputs {
  return {
    prd: current(buildPrdBundle()),
    architecture: current(buildArchitecture()),
    dataIntegration: current(buildDataIntegration()),
    aiStrategy: current(buildAiStrategy()),
    estimate: current(buildEstimateBundle()),
    ...overrides,
  };
}

/** Every one of the 12 quality checks passes against this session. */
export function buildHealthySession(overrides: Partial<ScopingSession> = {}): ScopingSession {
  const base = createSession({ id: 'quality-fixture', name: 'Quality fixture session', now: FIXTURE_NOW, config: fixtureConfig(), estimationConfig: createDefaultEstimationConfig() });
  return { ...base, scope: buildResolvedScope(), outputs: buildOutputs(), ...overrides };
}

/** The same `QualityContext` `runQualityGate` builds internally - lets a check's `run()` be tested directly. */
export function buildQualityContext(session: ScopingSession): QualityContext {
  return { session, scope: session.scope, coverage: buildCoverageReport(session), knownIds: session.scope === null ? new Set<string>() : knownIds(session.scope) };
}

/** Nothing generated yet - every content-dependent check must report 'Not generated yet' rather than throw. */
export function buildEmptyOutputsSession(overrides: Partial<ScopingSession> = {}): ScopingSession {
  const base = createSession({ id: 'quality-fixture-empty', name: 'Quality fixture (no outputs)', now: FIXTURE_NOW, config: fixtureConfig(), estimationConfig: createDefaultEstimationConfig() });
  return {
    ...base,
    scope: null,
    outputs: { prd: emptySection(), architecture: emptySection(), dataIntegration: emptySection(), aiStrategy: emptySection(), estimate: emptySection() },
    ...overrides,
  };
}
