/** Hand-built estimation inputs for the unit tests of this module (no other module's runtime is used). */
import type { EstimateContext } from '../../ai/types';
import type {
  AiUseCase,
  ArchitectureComponent,
  Capability,
  Complexity,
  DriverSuggestion,
  DriverType,
  EstimateSuggestion,
  IntegrationSpec,
  ScopeModel,
  SolutionConfig,
  WorkstreamSuggestion,
} from '../../domain';
import { createDefaultEstimationConfig } from '../../seed/estimationDefaults';
import { fixtureConfig, fixtureCustomer, fixtureScope, FIXTURE_NOW } from '../../test/fixtures';
import type { CalculationInput } from '../types';

export function driver(id: string, type: DriverType, complexity: Complexity, refIds: string[] = []): DriverSuggestion {
  return { id, type, label: `${type} driver ${id}`, complexity, rationale: `${complexity} complexity for the test.`, refIds };
}

export function workstream(id: string, phaseId: string, drivers: DriverSuggestion[], requirementIds: string[] = []): WorkstreamSuggestion {
  return { id, name: `Workstream ${id}`, phaseId, requirementIds, drivers, skills: ['Engineering'] };
}

export function suggestionOf(workstreams: WorkstreamSuggestion[]): EstimateSuggestion {
  return { workstreams, risks: [], dependencies: [], assumptions: [], exclusions: [], explanation: 'Inputs derived from the reviewed scope.' };
}

/** One PH_3 workstream: High integration (22 days) + Medium data (12 days) = 34 base days. */
export function tinySuggestion(): EstimateSuggestion {
  return suggestionOf([workstream('WS_01', 'PH_3', [driver('DRV_01', 'integration', 'High'), driver('DRV_02', 'data', 'Medium')])]);
}

/** PH_2 workstream with a capability and an infrastructure driver, plus a PH_3 integration workstream. */
export function platformSuggestion(): EstimateSuggestion {
  return suggestionOf([
    workstream('WS_01', 'PH_2', [driver('DRV_01', 'capability', 'Medium', ['FR_02']), driver('DRV_02', 'infrastructure', 'Medium')], ['FR_02']),
    workstream('WS_02', 'PH_3', [driver('DRV_03', 'integration', 'High', ['INT_01'])], ['INT_01']),
  ]);
}

export function emptyScope(): ScopeModel {
  return { summary: 'Empty scope', items: [], version: 1, approvedAt: FIXTURE_NOW, approvedVersion: 1, issues: [] };
}

/** Every planning input provided, so confidence is only reduced by what a test sets up. */
export function completeConfig(overrides: Partial<SolutionConfig> = {}): SolutionConfig {
  return fixtureConfig({ deliveryDeadlineWeeks: 30, targetRegions: ['EU'], ...overrides });
}

export function calculationInput(overrides: Partial<CalculationInput> = {}): CalculationInput {
  return {
    suggestion: tinySuggestion(),
    scope: emptyScope(),
    config: completeConfig(),
    estimationConfig: createDefaultEstimationConfig(),
    overrides: [],
    computedAt: FIXTURE_NOW,
    ...overrides,
  };
}

/** Marks scope items as resolved (answered question / closed gap). */
export function resolveItems(scope: ScopeModel, ids: readonly string[]): ScopeModel {
  return { ...scope, items: scope.items.map((item) => (ids.includes(item.id) ? { ...item, resolved: true, resolution: 'Confirmed by the customer.' } : item)) };
}

function capability(id: string, name: string, requirementIds: string[], extra: Partial<Capability> = {}): Capability {
  return {
    id,
    name,
    scope: `${name} for members.`,
    requirementIds,
    priority: 'Medium',
    dependencies: [],
    label: 'customer-requested',
    module: 'Member Portal',
    workstream: 'Member Experience',
    deliveryPackage: 'Package 1',
    acceptance: [],
    ...extra,
  };
}

function component(id: string, name: string, area: ArchitectureComponent['area']): ArchitectureComponent {
  return {
    id,
    name,
    area,
    logicalComponent: name.toLowerCase().split(' ').join('-'),
    service: `Azure ${name}`,
    requirementIds: [],
    assumptionIds: [],
    purpose: `${name} for the portal.`,
    rationale: 'Managed service preferred by the customer.',
    tradeOffs: [],
    dependencies: [],
    securityConsiderations: [],
  };
}

export function fixtureIntegration(extra: Partial<IntegrationSpec> = {}): IntegrationSpec {
  return {
    id: 'IS_01',
    name: 'Salesforce CRM profile sync',
    system: 'Salesforce CRM',
    systemType: 'external',
    direction: 'bidirectional',
    pattern: 'event',
    protocol: 'REST/JSON over HTTPS',
    authentication: 'OAuth 2.0 client credentials',
    errorHandling: 'Dead-letter queue with replay',
    retry: 'Exponential backoff',
    monitoring: 'Integration dashboard and alerts',
    dataSync: 'Near real time',
    requirementIds: ['INT_01'],
    componentIds: ['ARC_03'],
    complexity: 'High',
    readiness: 'unknown',
    ...extra,
  };
}

export function fixtureUseCase(extra: Partial<AiUseCase> = {}): AiUseCase {
  return {
    id: 'AIUC_01',
    name: 'Policy question answering',
    description: 'Answers member questions from the policy library.',
    requirementIds: ['FR_03'],
    pattern: 'Retrieval-augmented generation',
    modelOptions: [],
    retrieval: 'Vector index over policy documents',
    orchestration: '',
    evaluation: 'Golden question set',
    safety: 'Grounding checks',
    privacy: '',
    humanReview: 'Escalation to an agent',
    monitoring: '',
    complexity: 'High',
    ...extra,
  };
}

/** Context over fixtureScope(): three capabilities, five components, one integration, one AI use case. */
export function estimateContext(overrides: Partial<EstimateContext> = {}): EstimateContext {
  return {
    task: 'suggest-estimate-inputs',
    scope: fixtureScope(),
    customer: fixtureCustomer(),
    config: fixtureConfig(),
    capabilities: [
      capability('CAP_01', 'Registration and profile', ['FR_01'], { priority: 'High' }),
      capability('CAP_02', 'Policy document search', ['FR_02']),
      capability('CAP_03', 'AI policy assistant', ['FR_03'], { workstream: 'AI Capabilities', priority: 'Low' }),
    ],
    components: [
      component('ARC_01', 'Web application', 'user-apps'),
      component('ARC_02', 'API backend', 'backend'),
      component('ARC_03', 'Integration bus', 'integration'),
      component('ARC_04', 'Deployment pipeline', 'deployment'),
      component('ARC_05', 'Monitoring workspace', 'observability'),
    ],
    integrations: [fixtureIntegration()],
    aiUseCases: [fixtureUseCase()],
    ...overrides,
  };
}
