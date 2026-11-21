/**
 * A fully populated, hand-built `ScopingSession` - every generation stage has an output, the
 * quality gate has run, and a change has been recorded - used by the export tests that scan an
 * entire rendered package for leaked `undefined`/`null`/`NaN`/`[object Object]` text and for
 * end-to-end section-ordering checks. Reuses the shared scope fixture and the real, deterministic
 * estimation rules / quality gate (both fully implemented modules) instead of re-deriving them.
 */
import { CALCULATION_RULES } from '../estimation';
import type {
  AiStrategyOutput,
  ArchitectureDesign,
  Capability,
  DataIntegrationOutput,
  EstimateBundle,
  EstimateResult,
  FunctionalScope,
  GenerationMeta,
  ImpactReport,
  PrdBundle,
  PrdDocument,
  ScopingSession,
  SectionState,
} from '../domain';
import { PRD_SECTION_IDS } from '../domain';
import { runQualityGate } from '../quality';
import { createDefaultEstimationConfig } from '../seed';
import { fixtureConfig, fixtureSession, FIXTURE_NOW } from '../test/fixtures';

function meta(scopeVersion: number): GenerationMeta {
  return { providerId: 'mock', providerLabel: 'Mock AI (deterministic, offline)', mode: 'mock', usedFallback: false, generatedAt: FIXTURE_NOW, durationMs: 12, scopeVersion, issues: [] };
}

function current<T>(data: T, scopeVersion: number): SectionState<T> {
  return { data, status: 'current', reviewed: true, meta: meta(scopeVersion), staleReasons: [] };
}

function buildCapability(id: string, name: string, requirementIds: string[]): Capability {
  return { id, name, scope: `${name} for the reviewed requirements ${requirementIds.join(', ')}.`, requirementIds, priority: 'High', dependencies: [], label: 'customer-requested', module: 'Member Experience', workstream: 'Member Experience', deliveryPackage: 'Package 1', acceptance: [`${name} passes acceptance testing.`] };
}

function buildFunctionalScope(): FunctionalScope {
  const capabilities = [buildCapability('CAP_01', 'Member self-service portal', ['FR_01', 'FR_02']), buildCapability('CAP_02', 'CRM profile sync', ['INT_01'])];
  const enhancement = buildCapability('CAP_03', 'AI answer feedback loop', ['FR_03']);
  return {
    capabilities,
    recommendedEnhancements: [{ ...enhancement, label: 'recommended-enhancement' }],
    modules: [{ name: 'Member Experience', capabilityIds: ['CAP_01', 'CAP_02'], requirementIds: ['FR_01', 'FR_02', 'INT_01'] }],
    workstreams: [{ name: 'Member Experience', capabilityIds: ['CAP_01', 'CAP_02'], requirementIds: ['FR_01', 'FR_02', 'INT_01'] }],
    deliveryPackages: [{ name: 'Package 1', capabilityIds: ['CAP_01', 'CAP_02'], requirementIds: ['FR_01', 'FR_02', 'INT_01'], engagementModel: 'topcoder-challenge-series', suggestedChallengeTypes: ['Development challenge series', 'QA / bug hunt'] }],
    outOfScope: [{ text: 'Native mobile applications are out of scope for this phase.', refs: ['CON_01'], label: 'out-of-scope' }],
  };
}

function buildPrdDocument(): PrdDocument {
  const sections = PRD_SECTION_IDS.map((id) => ({
    id,
    title: id,
    statements: [{ text: `${id} narrative grounded in the reviewed scope.`, refs: ['FR_01'], label: 'customer-requested' as const }],
  }));
  return {
    title: 'Member Portal Modernisation - Product Requirements Document',
    sections,
    journeys: [{ id: 'JNY_01', name: 'Member self-service', persona: 'PER_01', steps: ['Sign in with SSO', 'Search policy documents'], requirementIds: ['FR_01', 'FR_02'] }],
  };
}

function buildPrdBundle(): PrdBundle {
  return { prd: buildPrdDocument(), functionalScope: buildFunctionalScope() };
}

function buildArchitectureDesign(): ArchitectureDesign {
  return {
    platform: 'azure',
    selection: 'user-selected',
    summary: [{ text: 'Azure-native architecture grounded in the reviewed member portal requirements.', refs: ['TECH_01'], label: 'customer-requested' }],
    components: [
      {
        id: 'ARC_01',
        name: 'Member Web Application',
        area: 'user-apps',
        logicalComponent: 'web-hosting-cdn',
        service: 'Azure Static Web Apps with Azure Front Door',
        requirementIds: ['FR_01'],
        assumptionIds: [],
        purpose: 'Serves the member self-service experience.',
        rationale: 'Matches the reviewed requirement for a self-service portal.',
        tradeOffs: ['Requires a build pipeline for static assets.'],
        dependencies: [],
        securityConsiderations: ['TLS termination at the front door.'],
      },
      {
        id: 'ARC_02',
        name: 'Member Profile Store',
        area: 'data-storage',
        logicalComponent: 'managed-relational-db',
        service: 'Azure SQL Database',
        requirementIds: ['DATA_01'],
        assumptionIds: ['ASM_01'],
        purpose: 'Stores member profile records synced from the CRM.',
        rationale: 'Relational storage fits the structured member profile data.',
        tradeOffs: [],
        dependencies: ['ARC_01'],
        securityConsiderations: ['Encryption at rest.'],
      },
    ],
    flows: [{ from: 'ARC_01', to: 'ARC_02', label: 'reads profile', kind: 'request' }],
    environments: [{ name: 'Production', purpose: 'Serves live member traffic.', sizing: 'Standard tier' }],
    deployment: [{ text: 'Deployed via a CI/CD pipeline with blue/green releases.', refs: ['CON_01'], label: 'ai-interpretation' }],
    availability: [{ text: 'Multi-zone deployment targets 99.9% availability.', refs: ['NFR_01'], label: 'customer-requested' }],
    backupDr: [{ text: 'Daily backups retained for 30 days.', refs: ['SEC_01'], label: 'assumption-to-confirm' }],
    securityControls: [{ text: 'Encryption in transit and at rest for all member data.', refs: ['SEC_01'], label: 'customer-requested' }],
    recommendation: {
      recommended: 'azure',
      scores: [
        { platform: 'aws', score: 10, reasons: [{ text: 'no strong signal found', refs: [], points: 10 }] },
        { platform: 'azure', score: 40, reasons: [{ text: 'mentions Microsoft', refs: ['TECH_01'], points: 30 }] },
        { platform: 'gcp', score: 5, reasons: [] },
      ],
      explanation: 'Azure scored highest because the customer explicitly prefers Microsoft technology.',
    },
  };
}

function buildDataIntegrationOutput(): DataIntegrationOutput {
  return {
    domains: [{ id: 'DOM_01', name: 'Member profile', description: 'Member identity and profile attributes.', sources: ['Salesforce CRM'], owner: 'Customer data team', classification: 'confidential', requirementIds: ['DATA_01'] }],
    topics: [
      'ownership',
      'ingestion',
      'transactional-storage',
      'analytical-storage',
      'data-quality',
      'metadata-governance',
      'retention',
      'privacy-security',
      'reporting-analytics',
      'backup-recovery',
    ].map((topic) => ({ topic, approach: `${topic} approach grounded in the reviewed requirements.`, services: ['Azure SQL Database'], requirementIds: ['DATA_01'] }) as DataIntegrationOutput['topics'][number]),
    integrations: [
      {
        id: 'INT_01',
        name: 'Salesforce CRM profile sync',
        system: 'Salesforce CRM',
        systemType: 'external',
        direction: 'bidirectional',
        pattern: 'api',
        protocol: 'REST/JSON over HTTPS',
        authentication: 'OAuth 2.0 client credentials',
        errorHandling: 'Dead-letter queue for failed syncs.',
        retry: 'Exponential backoff, 5 attempts.',
        monitoring: 'Sync lag dashboard and alerting.',
        dataSync: 'Near real-time.',
        requirementIds: ['INT_01'],
        componentIds: ['ARC_02'],
        complexity: 'Medium',
        readiness: 'unknown',
      },
    ],
    flows: [{ from: 'Salesforce CRM', to: 'Member Profile Store', payload: 'Member profile records', mechanism: 'REST API' }],
  };
}

function buildAiStrategyOutput(): AiStrategyOutput {
  return {
    applicable: true,
    summary: [{ text: 'An AI assistant answers policy questions grounded in the document library.', refs: ['FR_03'], label: 'customer-requested' }],
    useCases: [
      {
        id: 'AI_01',
        name: 'Policy question answering',
        description: 'Answers member questions from the policy document library.',
        requirementIds: ['FR_03'],
        pattern: 'Retrieval-augmented generation',
        modelOptions: ['Claude Haiku'],
        retrieval: 'Vector search over indexed policy documents.',
        orchestration: 'Single-turn retrieval then generation.',
        evaluation: 'Answer relevance scored against a labelled question set.',
        safety: 'Refuses questions outside the policy document scope.',
        privacy: 'No member PII is sent to the model.',
        humanReview: 'Low-confidence answers are routed to a human agent.',
        monitoring: 'Answer feedback and confidence dashboards.',
        complexity: 'Medium',
      },
    ],
    boundaries: [
      { activity: 'Draft a policy answer', type: 'ai', reason: 'Free-text generation grounded in retrieved documents.', requirementIds: ['FR_03'] },
      { activity: 'Calculate delivery effort', type: 'deterministic', reason: 'Effort is computed by the calculation engine, never by the AI.', requirementIds: [] },
      { activity: 'Approve the reviewed scope', type: 'human-decision', reason: 'A reviewer must approve scope before downstream generation.', requirementIds: [] },
    ],
    architecturePattern: 'Retrieval-augmented generation over an indexed policy document store.',
    frameworks: [{ name: 'LangChain', category: 'orchestration', rationale: 'Simplifies retrieval-augmented generation orchestration.', requirementIds: ['FR_03'], alternatives: ['LlamaIndex'] }],
    promptManagement: 'Prompt templates are version-controlled alongside the application code.',
    evaluationApproach: 'A labelled question set is scored weekly for answer relevance.',
    responsibleAi: ['Answers cite the source policy document.', 'Low-confidence answers are routed to a human.'],
    monitoringAndFeedback: 'Thumbs-up/down feedback is captured on every answer.',
    dataPrivacy: 'No member PII is included in prompts sent to the model provider.',
  };
}

function buildEstimateResult(): EstimateResult {
  const defaults = createDefaultEstimationConfig();
  const configSnapshot = { ...defaults, rates: defaults.rates.map((rate) => ({ ...rate, dayRate: rate.dayRate ?? 650 })) };
  const workstream = {
    id: 'WS_01',
    name: 'Member Experience',
    phaseId: 'PH_2',
    requirementIds: ['FR_01', 'FR_02'],
    skills: ['Frontend engineering'],
    drivers: [{ id: 'DRV_01', type: 'capability' as const, label: 'Member self-service portal', complexity: 'Medium' as const, rationale: 'Core self-service capability.', refIds: ['FR_01'], complexitySource: 'ai-suggested' as const, unitDays: 20 }],
    complexity: 'Medium' as const,
    baseDays: 20,
    adjustments: [{ label: 'Productivity factor', factor: 0.9, reason: 'AI-assisted delivery accelerates build effort.' }],
    effortDays: { low: 16, likely: 18, high: 22 },
    roles: [{ roleId: 'frontend-engineer' as const, label: 'Frontend Engineer', days: 18, dayRate: 650, cost: 11700 }],
    cost: { low: 10400, likely: 11700, high: 14300, currency: 'USD' },
    commercialBasis: 'Time and materials',
    confidence: 'High' as const,
    confidenceLimitations: [],
    calculation: ['Base effort = 20 person-days at Medium complexity.', 'Adjusted effort = 20 x 0.9 = 18 person-days.'],
  };
  const phase = { id: 'PH_2', name: 'Experience and Core Platform', workstreamIds: ['WS_01'], effortDays: workstream.effortDays, durationWeeks: { low: 3, likely: 4, high: 5 }, startWeek: 2, milestone: 'Member portal beta available for review.', calculation: ['Duration = effort / team size / working days per week.'] };
  return {
    workstreams: [workstream],
    phases: [phase],
    totals: { effortDays: workstream.effortDays, effortPersonWeeks: { low: 3.2, likely: 3.6, high: 4.4 }, timelineWeeks: phase.durationWeeks, subtotal: { low: 10400, likely: 11700, high: 14300, currency: 'USD' }, contingency: { low: 1040, likely: 1170, high: 1430, currency: 'USD' }, rom: { low: 11440, likely: 12870, high: 15730, currency: 'USD' } },
    roleSummary: [...workstream.roles],
    confidence: 'High',
    missingInputs: [],
    risks: [{ id: 'RSK_01', text: 'Document library quality may be inconsistent.', refs: ['RSK_01'] }],
    dependencies: [{ id: 'DEP_01', text: 'Salesforce API access must be confirmed.', refs: ['DEP_01'] }],
    assumptions: [{ id: 'EA_01', text: 'The customer team is available for weekly reviews.', refs: [] }],
    exclusions: [{ id: 'EXC_01', text: 'Native mobile applications are excluded from this estimate.', refs: ['CON_01'] }],
    explanation: 'Effort is driven primarily by the member self-service portal and the CRM integration.',
    rules: [...CALCULATION_RULES],
    deadlineAssessment: 'The proposed timeline comfortably meets the requested go-live date.',
    configSnapshot,
    computedAt: FIXTURE_NOW,
  };
}

function buildEstimateBundle(): EstimateBundle {
  const result = buildEstimateResult();
  return {
    suggestion: {
      workstreams: [{ id: 'WS_01', name: 'Member Experience', phaseId: 'PH_2', requirementIds: ['FR_01', 'FR_02'], drivers: [{ id: 'DRV_01', type: 'capability', label: 'Member self-service portal', complexity: 'Medium', rationale: 'Core self-service capability.', refIds: ['FR_01'] }], skills: ['Frontend engineering'] }],
      risks: [{ id: 'RSK_01', text: 'Document library quality may be inconsistent.', refs: ['RSK_01'] }],
      dependencies: [{ id: 'DEP_01', text: 'Salesforce API access must be confirmed.', refs: ['DEP_01'] }],
      assumptions: [],
      exclusions: [{ id: 'EXC_01', text: 'Native mobile applications are excluded from this estimate.', refs: ['CON_01'] }],
      explanation: 'Suggested workstreams reflect the reviewed functional and integration requirements.',
    },
    overrides: [],
    result,
  };
}

function buildChangeLog(): ImpactReport[] {
  return [
    {
      id: 'IMP_01',
      change: { kind: 'contingency', targetId: 'contingencyPct', label: 'Contingency', from: '15%', to: '20%' },
      affected: [{ section: 'commercials', area: 'ROM commercials', elementIds: [], reason: 'Contingency feeds directly into the ROM range.', action: 'recalculate' }],
      unaffected: [{ section: 'prd', area: 'PRD', reason: 'The PRD does not depend on commercial configuration.' }],
      explanation: 'Increasing contingency from 15% to 20% recalculates the ROM commercials only; every other deliverable is unaffected.',
      createdAt: FIXTURE_NOW,
      resolvedSections: ['commercials'],
    },
  ];
}

/** A session with every generation stage populated, the quality gate run, and one change recorded. */
export function buildFullyPopulatedSession(): ScopingSession {
  const base = fixtureSession();
  const scopeVersion = base.scope?.version ?? 1;
  const withOutputs: ScopingSession = {
    ...base,
    config: fixtureConfig({ cloudPlatform: 'azure' }),
    executiveSummary: '',
    changeLog: buildChangeLog(),
    outputs: {
      prd: current(buildPrdBundle(), scopeVersion),
      architecture: current(buildArchitectureDesign(), scopeVersion),
      dataIntegration: current(buildDataIntegrationOutput(), scopeVersion),
      aiStrategy: current(buildAiStrategyOutput(), scopeVersion),
      estimate: current(buildEstimateBundle(), scopeVersion),
    },
    quality: null,
  };
  return { ...withOutputs, quality: runQualityGate(withOutputs, FIXTURE_NOW) };
}
