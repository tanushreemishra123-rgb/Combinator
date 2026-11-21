/**
 * Hand-built, richly populated session used only by this folder's own tests. Every generated
 * section cites ids from `fixtureScope()` (src/test/fixtures.ts) so the rule-based analysis has
 * real trace links to walk. Not exported via index.ts - test-support only.
 */
import { createSession, emptySection } from '../domain';
import type {
  AiStrategyOutput,
  ArchitectureComponent,
  ArchitectureDesign,
  Complexity,
  DataIntegrationOutput,
  DriverSuggestion,
  DriverType,
  EstimateBundle,
  EstimateDriver,
  EstimateResult,
  MoneyRange,
  NumericRange,
  PrdBundle,
  ScopingSession,
  SectionState,
  SessionOutputs,
  TracedStatement,
  WorkstreamEstimate,
  WorkstreamSuggestion,
} from '../domain';
import { createDefaultEstimationConfig } from '../seed/estimationDefaults';
import { fixtureConfig, fixtureScope, FIXTURE_NOW } from '../test/fixtures';

function traced(text: string, refs: readonly string[] = [], label: TracedStatement['label'] = 'ai-interpretation'): TracedStatement {
  return { text, refs: [...refs], label };
}

/** `noUncheckedIndexedAccess`-safe replacement for `const [first] = array` in tests that expect exactly one result. */
export function firstOrThrow<T>(items: readonly T[]): T {
  const [item] = items;
  if (item === undefined) {
    throw new Error('Expected at least one item, found none.');
  }
  return item;
}

function current<T>(data: T): SectionState<T> {
  return { data, status: 'current', reviewed: true, meta: null, staleReasons: [] };
}

function buildPrdBundle(): PrdBundle {
  return {
    prd: {
      title: 'Member Portal Modernisation - PRD',
      sections: [
        {
          id: 'functionalRequirements',
          title: 'Functional Requirements',
          statements: [
            traced('Members register and sign in with SSO.', ['FR_01'], 'customer-requested'),
            traced('Members search and download policy documents.', ['FR_02'], 'customer-requested'),
            traced('An AI assistant answers policy questions from the document library.', ['FR_03']),
          ],
        },
        {
          id: 'nonFunctionalRequirements',
          title: 'Non-Functional Requirements',
          statements: [traced('The portal is available 99.9% of the time.', ['NFR_01'], 'customer-requested'), traced('The portal supports 50,000 registered members.', ['NFR_02'], 'customer-requested')],
        },
      ],
      journeys: [{ id: 'JNY_01', name: 'Member self-service', persona: 'Member', steps: ['Register', 'Sign in with SSO', 'Search policy documents'], requirementIds: ['FR_01', 'FR_02'] }],
    },
    functionalScope: {
      capabilities: [
        { id: 'CAP_01', name: 'Registration & SSO', scope: 'Member registration and SSO sign-in.', requirementIds: ['FR_01'], priority: 'High', dependencies: [], label: 'customer-requested', module: 'Core Platform', workstream: 'Core Platform', deliveryPackage: 'Package 1', acceptance: ['Member can sign in with SSO.'] },
        { id: 'CAP_02', name: 'Policy Document Search', scope: 'Search and download of policy documents.', requirementIds: ['FR_02'], priority: 'Medium', dependencies: [], label: 'customer-requested', module: 'Core Platform', workstream: 'Core Platform', deliveryPackage: 'Package 1', acceptance: ['Member can search policy documents.'] },
      ],
      recommendedEnhancements: [],
      modules: [{ name: 'Core Platform', capabilityIds: ['CAP_01', 'CAP_02'], requirementIds: ['FR_01', 'FR_02'] }],
      workstreams: [{ name: 'Core Platform', capabilityIds: ['CAP_01', 'CAP_02'], requirementIds: ['FR_01', 'FR_02'] }],
      deliveryPackages: [{ name: 'Package 1', capabilityIds: ['CAP_01', 'CAP_02'], requirementIds: ['FR_01', 'FR_02'], engagementModel: 'dedicated-team', suggestedChallengeTypes: [] }],
      outOfScope: [],
    },
  };
}

function architectureComponent(id: string, name: string, area: ArchitectureComponent['area'], logicalComponent: string, service: string, requirementIds: readonly string[]): ArchitectureComponent {
  return { id, name, area, logicalComponent, service, requirementIds: [...requirementIds], assumptionIds: [], purpose: `${name} for the Member Portal.`, rationale: `${name} was selected for its fit with the reviewed requirements.`, tradeOffs: [], dependencies: [], securityConsiderations: [] };
}

export const RICH_ARCHITECTURE_COMPONENTS: readonly ArchitectureComponent[] = [
  architectureComponent('ARC_01', 'Customer Identity', 'identity', 'identity-customer', 'Microsoft Entra External ID', ['FR_01']),
  architectureComponent('ARC_02', 'Session Cache', 'data-storage', 'cache', 'Azure Cache for Redis', ['NFR_02']),
  architectureComponent('ARC_03', 'Member & Policy Database', 'data-storage', 'managed-relational-db', 'Azure Database for PostgreSQL - Flexible Server', ['SEC_01', 'DATA_01']),
  architectureComponent('ARC_04', 'AI Foundation Model', 'ai-ml', 'foundation-models', 'Azure OpenAI in Azure AI Foundry', ['FR_03']),
  architectureComponent('ARC_05', 'Deployment Pipeline', 'deployment', 'ci-cd-pipeline', 'Azure DevOps Pipelines', ['NFR_01']),
  architectureComponent('ARC_06', 'Availability & Autoscaling', 'availability', 'availability-scaling', 'Azure Load Balancer with Virtual Machine Scale Sets across Availability Zones', ['NFR_01']),
  architectureComponent('ARC_07', 'Disaster Recovery', 'backup-dr', 'disaster-recovery', 'Azure Site Recovery with paired-region failover', ['SEC_01']),
];

export function buildArchitecture(components: readonly ArchitectureComponent[] = RICH_ARCHITECTURE_COMPONENTS): ArchitectureDesign {
  return {
    platform: 'azure',
    selection: 'user-selected',
    recommendation: { recommended: 'azure', scores: [], explanation: 'Azure recommended given the customer already standardises on Microsoft identity and productivity tooling.' },
    summary: [traced('Azure-based architecture for the Member Portal Modernisation.', ['FR_01'])],
    components: [...components],
    flows: [],
    environments: [
      { name: 'Production', purpose: 'Serves live member traffic.', sizing: 'Standard' },
      { name: 'Staging', purpose: 'Pre-production validation.', sizing: 'Standard' },
      { name: 'Development', purpose: 'Engineering sandbox.', sizing: 'Basic' },
    ],
    deployment: [traced('Deployed through a CI/CD pipeline into Azure App Service.', ['NFR_01'])],
    availability: [traced('Zone-redundant deployment sustains 99.9% availability.', ['NFR_01'])],
    backupDr: [traced('Cross-region failover is configured for disaster recovery.', ['SEC_01'])],
    securityControls: [traced('Data is encrypted at rest and in transit; GDPR controls are applied.', ['SEC_01'])],
  };
}

export function buildDataIntegration(): DataIntegrationOutput {
  return {
    domains: [{ id: 'DD_01', name: 'Member & Policy Data', description: 'Member profiles and policy documents.', sources: ['Salesforce CRM'], owner: 'Data team', classification: 'confidential', requirementIds: ['DATA_01'] }],
    topics: [
      { topic: 'privacy-security', approach: 'Encrypt personal data at rest and in transit.', services: ['Azure Key Vault'], requirementIds: ['SEC_01'] },
      { topic: 'ingestion', approach: 'Near real-time synchronisation from Salesforce.', services: ['Azure Service Bus (queues)'], requirementIds: ['INT_01'] },
    ],
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

export function buildAiStrategy(): AiStrategyOutput {
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

const UNIT_DAYS: ReadonlyMap<DriverType, number> = new Map([
  ['capability', 15],
  ['integration', 22],
  ['data', 12],
  ['ai', 18],
  ['security', 9],
  ['infrastructure', 5],
  ['nonFunctional', 9],
]);

function makeDriver(id: string, type: DriverType, label: string, complexity: Complexity, refIds: readonly string[]): DriverSuggestion {
  return { id, type, label, complexity, rationale: `${label} sized from the reviewed requirements and cited elements.`, refIds: [...refIds] };
}

function toEstimateDriver(suggestion: DriverSuggestion): EstimateDriver {
  return { ...suggestion, complexitySource: 'ai-suggested', unitDays: UNIT_DAYS.get(suggestion.type) ?? 10 };
}

interface WorkstreamSpec {
  id: string;
  name: string;
  phaseId: string;
  requirementIds: readonly string[];
  drivers: readonly DriverSuggestion[];
  effortDays: NumericRange;
  role: { roleId: WorkstreamEstimate['roles'][number]['roleId']; label: string; dayRate: number };
}

const WORKSTREAM_SPECS: readonly WorkstreamSpec[] = [
  { id: 'WS_01', name: 'Core Platform', phaseId: 'PH_2', requirementIds: ['FR_01', 'FR_02'], drivers: [makeDriver('DRV_01', 'capability', 'Registration & SSO', 'Medium', ['CAP_01']), makeDriver('DRV_02', 'capability', 'Policy document search', 'Medium', ['CAP_02'])], effortDays: { low: 24, likely: 30, high: 38 }, role: { roleId: 'backend-engineer', label: 'Backend Engineer', dayRate: 760 } },
  { id: 'WS_02', name: 'Integration & Data', phaseId: 'PH_3', requirementIds: ['INT_01', 'DATA_01'], drivers: [makeDriver('DRV_03', 'integration', 'Salesforce CRM sync', 'High', ['IF_01']), makeDriver('DRV_04', 'data', 'Member & policy data model', 'Medium', ['DD_01'])], effortDays: { low: 27, likely: 34, high: 42 }, role: { roleId: 'backend-engineer', label: 'Backend Engineer', dayRate: 760 } },
  { id: 'WS_03', name: 'AI Assistant', phaseId: 'PH_4', requirementIds: ['FR_03'], drivers: [makeDriver('DRV_05', 'ai', 'AI policy assistant', 'Medium', ['AIUC_01'])], effortDays: { low: 14, likely: 18, high: 23 }, role: { roleId: 'ai-engineer', label: 'AI/ML Engineer', dayRate: 980 } },
  { id: 'WS_04', name: 'Non-Functional & Security', phaseId: 'PH_5', requirementIds: ['NFR_01', 'NFR_02', 'SEC_01'], drivers: [makeDriver('DRV_06', 'nonFunctional', 'Availability & scalability hardening', 'Medium', ['ARC_02']), makeDriver('DRV_07', 'security', 'Encryption & GDPR controls', 'Medium', ['ARC_03'])], effortDays: { low: 7, likely: 9, high: 12 }, role: { roleId: 'security-engineer', label: 'Security Engineer', dayRate: 900 } },
  { id: 'WS_05', name: 'Cloud Infrastructure', phaseId: 'PH_1', requirementIds: [], drivers: [makeDriver('DRV_08', 'infrastructure', 'Azure landing zone & environments', 'Medium', [])], effortDays: { low: 4, likely: 5, high: 7 }, role: { roleId: 'devops-engineer', label: 'Cloud/DevOps Engineer', dayRate: 820 } },
];

function money(days: NumericRange, dayRate: number, currency: string): MoneyRange {
  return { low: days.low * dayRate, likely: days.likely * dayRate, high: days.high * dayRate, currency };
}

function toWorkstreamSuggestion(spec: WorkstreamSpec): WorkstreamSuggestion {
  return { id: spec.id, name: spec.name, phaseId: spec.phaseId, requirementIds: [...spec.requirementIds], drivers: [...spec.drivers], skills: [] };
}

function toWorkstreamEstimate(spec: WorkstreamSpec, currency: string): WorkstreamEstimate {
  const drivers = spec.drivers.map(toEstimateDriver);
  const cost = money(spec.effortDays, spec.role.dayRate, currency);
  return {
    id: spec.id,
    name: spec.name,
    phaseId: spec.phaseId,
    requirementIds: [...spec.requirementIds],
    skills: [],
    drivers,
    complexity: 'Medium',
    baseDays: spec.effortDays.likely,
    adjustments: [],
    effortDays: spec.effortDays,
    roles: [{ roleId: spec.role.roleId, label: spec.role.label, days: spec.effortDays.likely, dayRate: spec.role.dayRate, cost: cost.likely }],
    cost,
    commercialBasis: `${spec.effortDays.likely} person-days at the ${spec.role.label} day rate.`,
    confidence: 'Medium',
    confidenceLimitations: [],
    calculation: [`${spec.name}: ${spec.effortDays.likely} likely person-days x ${spec.role.dayRate} = ${cost.likely}.`],
  };
}

function sumDays(ranges: readonly NumericRange[]): NumericRange {
  return ranges.reduce((total, range) => ({ low: total.low + range.low, likely: total.likely + range.likely, high: total.high + range.high }), { low: 0, likely: 0, high: 0 });
}

function sumMoney(ranges: readonly MoneyRange[], currency: string): MoneyRange {
  return ranges.reduce((total, range) => ({ low: total.low + range.low, likely: total.likely + range.likely, high: total.high + range.high, currency }), { low: 0, likely: 0, high: 0, currency });
}

function scaleMoney(range: MoneyRange, factor: number): MoneyRange {
  return { low: range.low * factor, likely: range.likely * factor, high: range.high * factor, currency: range.currency };
}

/** Builds a self-consistent `EstimateBundle` (totals equal the sum of workstreams) so the estimate-consistency check passes by default. */
export function buildEstimateBundle(overrides: Partial<EstimateResult> = {}): EstimateBundle {
  const config = createDefaultEstimationConfig();
  const currency = config.currency;
  const workstreams = WORKSTREAM_SPECS.map((spec) => toWorkstreamEstimate(spec, currency));
  const effortDays = sumDays(workstreams.map((workstream) => workstream.effortDays));
  const subtotal = sumMoney(workstreams.map((workstream) => workstream.cost).filter((cost): cost is MoneyRange => cost !== null), currency);
  const contingency = scaleMoney(subtotal, config.contingencyPct / 100);
  const rom = sumMoney([subtotal, contingency], currency);
  const result: EstimateResult = {
    workstreams,
    phases: WORKSTREAM_SPECS.map((spec, index) => ({ id: spec.phaseId, name: spec.name, workstreamIds: [spec.id], effortDays: spec.effortDays, durationWeeks: { low: 2, likely: 3, high: 4 }, startWeek: index * 3 + 1, milestone: `${spec.name} complete`, calculation: [`${spec.name} scheduled from ${spec.effortDays.likely} likely person-days.`] })),
    totals: { effortDays, effortPersonWeeks: { low: effortDays.low / config.workingDaysPerWeek, likely: effortDays.likely / config.workingDaysPerWeek, high: effortDays.high / config.workingDaysPerWeek }, timelineWeeks: { low: 10, likely: 14, high: 18 }, subtotal, contingency, rom },
    roleSummary: [
      { roleId: 'backend-engineer', label: 'Backend Engineer', days: 64, dayRate: 760, cost: 48640 },
      { roleId: 'ai-engineer', label: 'AI/ML Engineer', days: 18, dayRate: 980, cost: 17640 },
      { roleId: 'security-engineer', label: 'Security Engineer', days: 9, dayRate: 900, cost: 8100 },
      { roleId: 'devops-engineer', label: 'Cloud/DevOps Engineer', days: 5, dayRate: 820, cost: 4100 },
    ],
    confidence: 'Medium',
    missingInputs: [],
    risks: [{ id: 'RISK_01', text: 'Document library quality may reduce AI answer accuracy.', refs: ['RSK_01'] }],
    dependencies: [{ id: 'DEP_NOTE_01', text: 'Salesforce API sandbox access is required before integration build starts.', refs: ['DEP_01'] }],
    assumptions: [{ id: 'ASM_NOTE_01', text: 'Policy documents are available as text-searchable files.', refs: ['ASM_01'] }],
    exclusions: [{ id: 'EXCL_01', text: 'Native mobile applications are out of scope for this phase.', refs: [] }],
    explanation: 'Effort is derived from five workstreams covering the core platform, integration, AI assistant, non-functional hardening and cloud infrastructure.',
    rules: [{ id: 'RULE_EFFORT', name: 'Driver effort', formula: 'unitDays x complexity multiplier', description: 'Person-days per driver, read from the base-effort table at the suggested or overridden complexity.' }],
    deadlineAssessment: 'No delivery deadline has been set, so no feasibility constraint applies yet.',
    configSnapshot: config,
    computedAt: FIXTURE_NOW,
    ...overrides,
  };
  return { suggestion: { workstreams: WORKSTREAM_SPECS.map(toWorkstreamSuggestion), risks: result.risks, dependencies: result.dependencies, assumptions: result.assumptions, exclusions: result.exclusions, explanation: result.explanation }, overrides: [], result };
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

/** All sections generated, nothing null - the baseline used by most analysis tests. */
export function buildRichSession(overrides: Partial<ScopingSession> = {}): ScopingSession {
  const base = createSession({ id: 'impact-fixture', name: 'Impact fixture session', now: FIXTURE_NOW, config: fixtureConfig(), estimationConfig: createDefaultEstimationConfig() });
  return { ...base, scope: fixtureScope(), outputs: buildOutputs(), ...overrides };
}

/** Nothing generated yet - every section must report 'Not generated yet'. */
export function buildEmptyOutputsSession(overrides: Partial<ScopingSession> = {}): ScopingSession {
  const base = createSession({ id: 'impact-fixture-empty', name: 'Impact fixture (no outputs)', now: FIXTURE_NOW, config: fixtureConfig(), estimationConfig: createDefaultEstimationConfig() });
  return {
    ...base,
    scope: fixtureScope(),
    outputs: { prd: emptySection(), architecture: emptySection(), dataIntegration: emptySection(), aiStrategy: emptySection(), estimate: emptySection() },
    ...overrides,
  };
}
