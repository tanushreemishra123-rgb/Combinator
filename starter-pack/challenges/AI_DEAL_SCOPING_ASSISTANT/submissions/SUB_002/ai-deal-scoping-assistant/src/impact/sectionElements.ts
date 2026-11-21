/**
 * Flattens every generated deliverable into `SectionElement`s - one per PRD section, journey,
 * capability, architecture component, environment, data domain/topic, integration, AI use case,
 * framework, workstream, estimate driver, estimate note and missing input - with the ids each one
 * cites. Impact selectors only ever filter this list, which keeps the analysis rule-based and
 * explainable: an element is affected because of a citation or a facet that can be shown.
 */
import { STAGES } from '../domain';
import type {
  AiStrategyOutput,
  ArchitectureDesign,
  DataIntegrationOutput,
  EstimateBundle,
  EstimateNote,
  OutputSectionId,
  PrdBundle,
  SectionState,
  SessionOutputs,
  WorkstreamEstimate,
} from '../domain';
import { dataTopicLabel } from '../traceability';
import { unique } from './format';
import type { ElementFacet, SectionElement } from './types';

function element(section: OutputSectionId, id: string, refs: readonly string[], facets: readonly ElementFacet[] = [], display: string = id): SectionElement {
  return { section, id, display, refs: unique(refs), facets };
}

function prdElements(data: PrdBundle | null): SectionElement[] {
  if (data === null) {
    return [];
  }
  const sections = data.prd.sections.map((section) =>
    element('prd', section.id, section.statements.flatMap((statement) => statement.refs), [], `the "${section.title}" section`),
  );
  const journeys = data.prd.journeys.map((journey) => element('prd', journey.id, journey.requirementIds));
  const capabilities = [...data.functionalScope.capabilities, ...data.functionalScope.recommendedEnhancements].map((capability) =>
    element('functionalScope', capability.id, capability.requirementIds),
  );
  return [...sections, ...journeys, ...capabilities];
}

function architectureElements(data: ArchitectureDesign | null): SectionElement[] {
  if (data === null) {
    return [];
  }
  const components = data.components.map((component) =>
    element('architecture', component.id, [...component.requirementIds, ...component.assumptionIds], [
      `area:${component.area}`,
      `logical:${component.logicalComponent}`,
    ]),
  );
  const environments = data.environments.map((environment) =>
    element('architecture', environment.name, [], ['area:environments'], `the "${environment.name}" environment`),
  );
  return [...components, ...environments];
}

function dataIntegrationElements(data: DataIntegrationOutput | null): SectionElement[] {
  if (data === null) {
    return [];
  }
  const domains = data.domains.map((domain) => element('dataIntegration', domain.id, domain.requirementIds));
  const topics = data.topics.map((plan) =>
    element('dataIntegration', plan.topic, plan.requirementIds, [`topic:${plan.topic}`], `the "${dataTopicLabel(plan.topic)}" data topic`),
  );
  const integrations = data.integrations.map((integration) => element('dataIntegration', integration.id, integration.requirementIds));
  return [...domains, ...topics, ...integrations];
}

function aiStrategyElements(data: AiStrategyOutput | null): SectionElement[] {
  if (data === null) {
    return [];
  }
  const useCases = data.useCases.map((useCase) => element('aiStrategy', useCase.id, useCase.requirementIds));
  const frameworks = data.frameworks.map((framework) =>
    element('aiStrategy', framework.name, framework.requirementIds, [], `the ${framework.name} recommendation`),
  );
  return [...useCases, ...frameworks];
}

function driverFacets(workstream: WorkstreamEstimate): ElementFacet[] {
  return unique(workstream.drivers.map((driver): ElementFacet => `driver:${driver.type}`));
}

/**
 * A workstream also lists its driver ids as refs, so a change that reaches a driver reaches the
 * workstream (and its priced line in the ROM) through the same one-hop citation walk.
 */
function workstreamElements(workstream: WorkstreamEstimate): SectionElement[] {
  const driverIds = workstream.drivers.map((driver) => driver.id);
  const driverRefs = workstream.drivers.flatMap((driver) => driver.refIds);
  const facets: ElementFacet[] = [`phase:${workstream.phaseId}`, ...driverFacets(workstream)];
  return [
    element('estimate', workstream.id, [...workstream.requirementIds, ...driverIds], facets),
    ...workstream.drivers.map((driver) => element('estimate', driver.id, driver.refIds, [`driver:${driver.type}`])),
    element('commercials', workstream.id, [...workstream.requirementIds, ...driverIds, ...driverRefs], facets),
  ];
}

function noteElements(notes: readonly EstimateNote[]): SectionElement[] {
  return notes.map((note) => element('estimate', note.id, note.refs));
}

function estimateElements(data: EstimateBundle | null): SectionElement[] {
  if (data === null) {
    return [];
  }
  const { result } = data;
  const missingInputs = result.missingInputs.map((input) =>
    element('estimate', input.key, input.relatedScopeIds, [], `the missing input "${input.label}"`),
  );
  return [
    ...result.workstreams.flatMap(workstreamElements),
    ...noteElements([...result.risks, ...result.dependencies, ...result.assumptions, ...result.exclusions]),
    ...missingInputs,
  ];
}

export function collectSectionElements(outputs: SessionOutputs): SectionElement[] {
  return [
    ...prdElements(outputs.prd.data),
    ...architectureElements(outputs.architecture.data),
    ...dataIntegrationElements(outputs.dataIntegration.data),
    ...aiStrategyElements(outputs.aiStrategy.data),
    ...estimateElements(outputs.estimate.data),
  ];
}

/** Typed replacement for `outputs[stageId]` (dynamic member access is banned by the lint rules). */
export function stageState(outputs: SessionOutputs, stageId: keyof SessionOutputs): SectionState<unknown> {
  switch (stageId) {
    case 'prd':
      return outputs.prd;
    case 'architecture':
      return outputs.architecture;
    case 'dataIntegration':
      return outputs.dataIntegration;
    case 'aiStrategy':
      return outputs.aiStrategy;
    case 'estimate':
      return outputs.estimate;
  }
}

/** Sections whose owning stage has produced data; everything else is reported as 'Not generated yet'. */
export function generatedSections(outputs: SessionOutputs): Set<OutputSectionId> {
  return new Set(STAGES.filter((stage) => stageState(outputs, stage.id).data !== null).flatMap((stage) => stage.sections));
}
