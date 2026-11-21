/**
 * Collects every generated element that can cite scope-item ids - one entry per capability,
 * journey, architecture component, data domain/topic, integration, AI use case, framework and
 * estimate workstream - together with the refs it cites. `buildTraceLinks` (index.ts) flattens
 * this into one `TraceLink` per (requirementId, element); `coverage.ts` reduces it into coverage
 * rows and unsupported-addition flags. Keeping both derived from the same list keeps them in sync
 * by construction instead of by convention.
 */
import type {
  AiStrategyOutput,
  ArchitectureDesign,
  ContentLabel,
  DataIntegrationOutput,
  EstimateBundle,
  PrdBundle,
  ScopingSession,
  TraceLink,
  TraceTargetType,
} from '../domain';
import { dataTopicLabel } from './labels';

export interface TraceableElement {
  targetType: TraceTargetType;
  targetId: string;
  targetLabel: string;
  /** Present only for PRD capabilities/enhancements, which carry a grounding label of their own. */
  contentLabel: ContentLabel | undefined;
  /** Scope-item ids (requirements and, for architecture components, assumptions) this element cites. */
  refs: string[];
}

function element(targetType: TraceTargetType, targetId: string, targetLabel: string, refs: readonly string[], contentLabel?: ContentLabel): TraceableElement {
  return { targetType, targetId, targetLabel, contentLabel, refs: [...refs] };
}

function elementsFromPrd(data: PrdBundle | null): TraceableElement[] {
  if (data === null) {
    return [];
  }
  const capabilities = [...data.functionalScope.capabilities, ...data.functionalScope.recommendedEnhancements].map((capability) =>
    element('capability', capability.id, capability.name, capability.requirementIds, capability.label),
  );
  const journeys = data.prd.journeys.map((journey) => element('journey', journey.id, journey.name, journey.requirementIds));
  return [...capabilities, ...journeys];
}

function elementsFromArchitecture(data: ArchitectureDesign | null): TraceableElement[] {
  if (data === null) {
    return [];
  }
  return data.components.map((component) =>
    element('component', component.id, component.name, [...component.requirementIds, ...component.assumptionIds]),
  );
}

function elementsFromDataIntegration(data: DataIntegrationOutput | null): TraceableElement[] {
  if (data === null) {
    return [];
  }
  const domains = data.domains.map((domain) => element('dataDomain', domain.id, domain.name, domain.requirementIds));
  const topics = data.topics.map((topic) => element('dataTopic', topic.topic, dataTopicLabel(topic.topic), topic.requirementIds));
  const integrations = data.integrations.map((integration) => element('integration', integration.id, integration.name, integration.requirementIds));
  return [...domains, ...topics, ...integrations];
}

function elementsFromAiStrategy(data: AiStrategyOutput | null): TraceableElement[] {
  if (data === null) {
    return [];
  }
  const useCases = data.useCases.map((useCase) => element('aiUseCase', useCase.id, useCase.name, useCase.requirementIds));
  // Frameworks carry no id of their own; the recommendation is identified by its name.
  const frameworks = data.frameworks.map((framework) => element('framework', framework.name, framework.name, framework.requirementIds));
  return [...useCases, ...frameworks];
}

function elementsFromEstimate(data: EstimateBundle | null): TraceableElement[] {
  if (data === null) {
    return [];
  }
  // The AI-suggested workstreams carry the requirementIds; the computed WorkstreamEstimate mirrors
  // them but adds only pure-calculation fields, so the suggestion is the source of truth for links.
  return data.suggestion.workstreams.map((workstream) => element('workstream', workstream.id, workstream.name, workstream.requirementIds));
}

/** Every generation stage's session output, flattened into one traceable-element list. Skips sections whose data is null. */
export function collectElements(session: ScopingSession): TraceableElement[] {
  return [
    ...elementsFromPrd(session.outputs.prd.data),
    ...elementsFromArchitecture(session.outputs.architecture.data),
    ...elementsFromDataIntegration(session.outputs.dataIntegration.data),
    ...elementsFromAiStrategy(session.outputs.aiStrategy.data),
    ...elementsFromEstimate(session.outputs.estimate.data),
  ];
}

/** One `TraceLink` per (requirementId, element) - the flattened, per-reference view of `collectElements`. */
export function elementsToLinks(elements: readonly TraceableElement[]): TraceLink[] {
  return elements.flatMap((item) =>
    item.refs.map((requirementId) => ({ requirementId, targetType: item.targetType, targetId: item.targetId, targetLabel: item.targetLabel })),
  );
}
