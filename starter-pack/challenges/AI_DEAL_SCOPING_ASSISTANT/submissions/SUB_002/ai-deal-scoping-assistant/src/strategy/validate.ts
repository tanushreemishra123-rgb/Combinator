/**
 * Semantic validation the stage entry (stage.ts) runs after schema validation, on both mock and
 * live output: drops references a live model might invent, flags recommendations nothing in the
 * scope actually supports, and reports AI safeguards a live response left empty (never fills them -
 * the quality gate is the place that turns this into a blocking check).
 */
import { DATA_TOPICS, missingAiSafeguards } from '../domain';
import type { AiStrategyOutput, ArchitectureDesign, DataIntegrationOutput, ScopeModel, ValidationIssue } from '../domain';

const MIN_RATIONALE_LENGTH = 40;

function dropUnknown(ids: readonly string[], known: ReadonlySet<string>): { kept: string[]; dropped: string[] } {
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const id of ids) {
    if (known.has(id)) {
      kept.push(id);
    } else {
      dropped.push(id);
    }
  }
  return { kept, dropped };
}

function unknownIdIssue(dropped: readonly string[]): ValidationIssue | undefined {
  if (dropped.length === 0) {
    return undefined;
  }
  return {
    severity: 'warning',
    code: 'unknown-requirement-id',
    message: `Removed ${dropped.length} reference(s) to an id not present in the reviewed scope: ${dropped.join(', ')}.`,
    refs: [...dropped],
  };
}

/**
 * Cleans one output's requirement-id references against the reviewed scope and componentIds
 * against the design, reporting every id it had to drop instead of silently keeping it.
 */
function cleanDataIntegration(output: DataIntegrationOutput, knownRequirementIds: ReadonlySet<string>, knownComponentIds: ReadonlySet<string>) {
  const droppedRequirementIds: string[] = [];
  const droppedComponentIds: string[] = [];

  const domains = output.domains.map((domain) => {
    const result = dropUnknown(domain.requirementIds, knownRequirementIds);
    droppedRequirementIds.push(...result.dropped);
    return { ...domain, requirementIds: result.kept };
  });
  const topics = output.topics.map((topic) => {
    const result = dropUnknown(topic.requirementIds, knownRequirementIds);
    droppedRequirementIds.push(...result.dropped);
    return { ...topic, requirementIds: result.kept };
  });
  const integrations = output.integrations.map((integration) => {
    const requirements = dropUnknown(integration.requirementIds, knownRequirementIds);
    const componentIds = dropUnknown(integration.componentIds, knownComponentIds);
    droppedRequirementIds.push(...requirements.dropped);
    droppedComponentIds.push(...componentIds.dropped);
    return { ...integration, requirementIds: requirements.kept, componentIds: componentIds.kept };
  });

  return { value: { ...output, domains, topics, integrations }, droppedRequirementIds, droppedComponentIds };
}

function missingTopicsIssue(topics: DataIntegrationOutput['topics']): ValidationIssue | undefined {
  const present = new Set(topics.map((topic) => topic.topic));
  const missing = DATA_TOPICS.filter((topic) => !present.has(topic));
  if (missing.length === 0) {
    return undefined;
  }
  return {
    severity: 'warning',
    code: 'missing-data-topic',
    message: `The data strategy is missing the required topic(s): ${missing.join(', ')}.`,
    refs: [],
  };
}

function unsupportedIntegrationIssues(integrations: DataIntegrationOutput['integrations']): ValidationIssue[] {
  return integrations
    .filter((integration) => integration.requirementIds.length === 0)
    .map((integration) => ({
      severity: 'warning',
      code: 'unsupported-recommendation',
      message: `Integration "${integration.name}" (${integration.id}) cites no reviewed requirement.`,
      refs: [integration.id],
    }));
}

/** Validates a data-integration plan against the reviewed scope and the selected architecture design. */
export function validateDataIntegration(
  output: DataIntegrationOutput,
  scope: ScopeModel,
  design: ArchitectureDesign,
): { value: DataIntegrationOutput; issues: ValidationIssue[] } {
  const knownRequirementIds = new Set(scope.items.map((item) => item.id));
  const knownComponentIds = new Set(design.components.map((component) => component.id));
  const { value, droppedRequirementIds, droppedComponentIds } = cleanDataIntegration(output, knownRequirementIds, knownComponentIds);

  const issues: ValidationIssue[] = [];
  const unknownIssue = unknownIdIssue(droppedRequirementIds);
  if (unknownIssue !== undefined) {
    issues.push(unknownIssue);
  }
  if (droppedComponentIds.length > 0) {
    issues.push({
      severity: 'warning',
      code: 'unknown-component-id',
      message: `Removed ${droppedComponentIds.length} reference(s) to a component not present in the architecture design: ${droppedComponentIds.join(', ')}.`,
      refs: [...droppedComponentIds],
    });
  }
  issues.push(...unsupportedIntegrationIssues(value.integrations));
  const missingTopics = missingTopicsIssue(value.topics);
  if (missingTopics !== undefined) {
    issues.push(missingTopics);
  }
  return { value, issues };
}

function cleanUseCases(useCases: AiStrategyOutput['useCases'], known: ReadonlySet<string>) {
  const dropped: string[] = [];
  const useCasesValue = useCases.map((useCase) => {
    const result = dropUnknown(useCase.requirementIds, known);
    dropped.push(...result.dropped);
    return { ...useCase, requirementIds: result.kept };
  });
  return { useCasesValue, dropped };
}

function safeguardIssues(useCases: AiStrategyOutput['useCases']): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const useCase of useCases) {
    const missing = missingAiSafeguards(useCase);
    if (missing.length > 0) {
      issues.push({
        severity: 'warning',
        code: 'ai-safeguard-missing',
        message: `AI use case "${useCase.name}" (${useCase.id}) is missing: ${missing.join(', ')}.`,
        refs: [useCase.id],
      });
    }
  }
  return issues;
}

function frameworkRationaleIssues(frameworks: AiStrategyOutput['frameworks']): ValidationIssue[] {
  return frameworks
    .filter((framework) => framework.rationale.trim().length < MIN_RATIONALE_LENGTH)
    .map((framework) => ({
      severity: 'warning' as const,
      code: 'weak-framework-rationale',
      message: `Recommendation "${framework.name}" has too short a rationale to justify the choice.`,
      refs: framework.requirementIds,
    }));
}

/** Validates an AI-solution strategy against the reviewed scope: unknown ids, missing safeguards, thin rationale. */
export function validateAiSolution(output: AiStrategyOutput, scope: ScopeModel): { value: AiStrategyOutput; issues: ValidationIssue[] } {
  const known = new Set(scope.items.map((item) => item.id));
  const { useCasesValue, dropped } = cleanUseCases(output.useCases, known);
  const value: AiStrategyOutput = { ...output, useCases: useCasesValue };

  const issues: ValidationIssue[] = [];
  const unknownIssue = unknownIdIssue(dropped);
  if (unknownIssue !== undefined) {
    issues.push(unknownIssue);
  }
  issues.push(
    ...useCasesValue
      .filter((useCase) => useCase.requirementIds.length === 0)
      .map((useCase) => ({
        severity: 'warning' as const,
        code: 'unsupported-recommendation',
        message: `AI use case "${useCase.name}" (${useCase.id}) cites no reviewed requirement.`,
        refs: [useCase.id],
      })),
  );
  if (output.applicable) {
    issues.push(...safeguardIssues(useCasesValue));
  }
  issues.push(...frameworkRationaleIssues(output.frameworks));
  return { value, issues };
}
