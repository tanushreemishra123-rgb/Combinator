/**
 * Drivers taken from the data / integration strategy and the AI solution approach. Integration and
 * AI drivers reuse the complexity already reviewed in those deliverables; data drivers are scored
 * from the signals of each data requirement.
 */
import { signalLabel } from '../../domain';
import type { AiUseCase, Complexity, IntegrationSpec, ScopeItem } from '../../domain';
import { raiseComplexity } from '../complexity';
import { itemsOfKind } from '../scopeFacts';
import { activeIds, citeIds } from './facts';
import type { DriverSeed, PlannerFacts } from './facts';

/** Data work that goes beyond storing records: each signal adds one complexity level. */
const HEAVY_DATA_SIGNALS: readonly string[] = [
  'data:migration',
  'data:etl',
  'data:streaming',
  'data:warehouse',
  'data:quality',
  'data:master-data',
];
const SENSITIVE_DATA_SIGNAL = 'data:pii';
const DEMANDING_INTEGRATION_SIGNALS: readonly string[] = ['integration:realtime', 'integration:legacy'];

const DATA_LEVELS: readonly { min: number; complexity: Complexity }[] = [
  { min: 3, complexity: 'Very High' },
  { min: 2, complexity: 'High' },
  { min: 1, complexity: 'Medium' },
  { min: 0, complexity: 'Low' },
];

function requirementNote(ids: readonly string[]): string {
  return ids.length > 0 ? ` Requirements: ${citeIds(ids)}.` : '';
}

function integrationDriver(spec: IntegrationSpec, facts: PlannerFacts): DriverSeed {
  const requirementIds = activeIds(spec.requirementIds, facts);
  const componentIds = spec.componentIds.filter((id) => facts.context.components.some((component) => component.id === id));
  const readiness = spec.readiness === 'confirmed' ? 'interface readiness is confirmed' : 'interface readiness is not yet confirmed';
  return {
    type: 'integration',
    label: spec.name,
    complexity: spec.complexity,
    rationale: `${spec.complexity} complexity (from the integration strategy): ${spec.direction} ${spec.pattern} exchange with ${spec.system} (${spec.systemType} system) over ${spec.protocol}; ${readiness}.${requirementNote(requirementIds)}`,
    refIds: [spec.id, ...requirementIds, ...componentIds],
  };
}

/** Integration requirements that the strategy has not detailed yet are still estimated. */
function uncoveredIntegrationDriver(item: ScopeItem): DriverSeed {
  const demanding = item.signals.filter((signal) => DEMANDING_INTEGRATION_SIGNALS.includes(signal));
  const complexity: Complexity = demanding.length > 0 ? 'High' : 'Medium';
  const reason = demanding.length > 0 ? `it requires ${demanding.map(signalLabel).join(' and ').toLowerCase()}` : 'no demanding exchange pattern is stated';
  return {
    type: 'integration',
    label: item.title,
    complexity,
    rationale: `${complexity} complexity: ${item.id} is not yet detailed in the integration strategy and ${reason}.`,
    refIds: [item.id],
  };
}

export function integrationDrivers(facts: PlannerFacts): DriverSeed[] {
  const { integrations } = facts.context;
  const covered = new Set(integrations.flatMap((spec) => spec.requirementIds));
  const uncovered = itemsOfKind(facts.active, 'integration').filter((item) => !covered.has(item.id));
  return [...integrations.map((spec) => integrationDriver(spec, facts)), ...uncovered.map(uncoveredIntegrationDriver)];
}

function dataDriver(item: ScopeItem): DriverSeed {
  const heavy = item.signals.filter((signal) => HEAVY_DATA_SIGNALS.includes(signal));
  const sensitive = item.signals.includes(SENSITIVE_DATA_SIGNAL);
  const base = DATA_LEVELS.find((level) => heavy.length >= level.min)?.complexity ?? 'Low';
  const complexity = raiseComplexity(base, sensitive ? 1 : 0);
  const work = heavy.length > 0 ? `involves ${heavy.map(signalLabel).join('; ')}` : 'is limited to modelling and storing the data';
  const privacy = sensitive ? '; raised one level because personal or sensitive data needs privacy controls' : '';
  return {
    type: 'data',
    label: item.title,
    complexity,
    rationale: `${complexity} complexity: ${item.id} ${work}${privacy}.`,
    refIds: [item.id],
  };
}

export function dataDrivers(facts: PlannerFacts): DriverSeed[] {
  return itemsOfKind(facts.active, 'data').map(dataDriver);
}

function aiDriver(useCase: AiUseCase, facts: PlannerFacts): DriverSeed {
  const requirementIds = activeIds(useCase.requirementIds, facts);
  const extras = [
    useCase.retrieval.trim() === '' ? null : 'retrieval over customer content',
    useCase.humanReview.trim() === '' ? null : 'a human review step',
    'evaluation and safety guardrails',
  ].filter((entry): entry is string => entry !== null);
  return {
    type: 'ai',
    label: useCase.name,
    complexity: useCase.complexity,
    rationale: `${useCase.complexity} complexity (from the AI solution approach): ${useCase.pattern}, including ${extras.join(', ')}.${requirementNote(requirementIds)}`,
    refIds: [useCase.id, ...requirementIds],
  };
}

export function aiDrivers(facts: PlannerFacts): DriverSeed[] {
  return facts.context.aiUseCases.map((useCase) => aiDriver(useCase, facts));
}
