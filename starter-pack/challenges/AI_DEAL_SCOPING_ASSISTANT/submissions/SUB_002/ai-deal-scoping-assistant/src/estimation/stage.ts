/**
 * Estimate stage entry. The AI (mock planner or live model) suggests the inputs; after semantic
 * validation the deterministic engine produces every number. `recalculate` re-runs only the engine,
 * so rate, contingency, currency or complexity changes never need an AI call.
 */
import { runTask } from '../ai';
import type { EstimateContext, TaskRunOptions } from '../ai/types';
import type {
  ComplexityOverride,
  EstimateBundle,
  EstimateSuggestion,
  EstimationConfig,
  GenerationMeta,
  ScopeModel,
  SolutionConfig,
  ValidationIssue,
} from '../domain';
import { calculateEstimate } from './engine/calculateEstimate';
import { estimateInputsTask } from './prompt';
import type { EstimateInput } from './types';
import { validateSuggestion } from './validation';

/**
 * Builds the grounded context. Recommended enhancements are passed along with the requested
 * capabilities so the planner can list them as exclusions instead of silently estimating them.
 */
export function buildEstimateContext(input: EstimateInput): EstimateContext {
  const { functionalScope } = input.prd;
  return {
    task: 'suggest-estimate-inputs',
    scope: input.scope,
    customer: input.customer,
    config: input.config,
    capabilities: [...functionalScope.capabilities, ...functionalScope.recommendedEnhancements],
    components: input.design.components,
    integrations: input.dataIntegration.integrations,
    aiUseCases: input.aiStrategy.applicable ? input.aiStrategy.useCases : [],
  };
}

interface ApplicableOverrides {
  overrides: ComplexityOverride[];
  issues: ValidationIssue[];
}

/** Overrides are keyed by driver id; one that no longer matches a driver must not be applied silently. */
function applicableOverrides(overrides: readonly ComplexityOverride[], suggestion: EstimateSuggestion): ApplicableOverrides {
  const driverIds = new Set(suggestion.workstreams.flatMap((workstream) => workstream.drivers.map((driver) => driver.id)));
  const dropped = overrides.filter((override) => !driverIds.has(override.driverId));
  const issues: ValidationIssue[] =
    dropped.length === 0
      ? []
      : [
          {
            severity: 'info',
            code: 'estimate.override-dropped',
            message: `Complexity overrides for ${dropped.map((override) => override.driverId).join(', ')} were dropped because those drivers no longer exist.`,
            refs: dropped.map((override) => override.driverId),
          },
        ];
  return { overrides: overrides.filter((override) => driverIds.has(override.driverId)), issues };
}

/** AI suggests inputs (workstreams, drivers, complexity); the numbers come from calculateEstimate. */
export async function generateEstimate(
  input: EstimateInput,
  run: TaskRunOptions,
): Promise<{ bundle: EstimateBundle; meta: GenerationMeta }> {
  const context = buildEstimateContext(input);
  const { value, meta } = await runTask(estimateInputsTask, context, run);
  const validated = validateSuggestion(value, context);
  const applicable = applicableOverrides(input.overrides, validated.suggestion);
  const result = calculateEstimate({
    suggestion: validated.suggestion,
    scope: input.scope,
    config: input.config,
    estimationConfig: input.estimationConfig,
    overrides: applicable.overrides,
    computedAt: meta.generatedAt,
  });
  return {
    bundle: { suggestion: validated.suggestion, overrides: applicable.overrides, result },
    meta: { ...meta, issues: [...meta.issues, ...validated.issues, ...applicable.issues] },
  };
}

/** Pure re-calculation after a rate, contingency, currency, team or complexity-override change. */
export function recalculate(
  bundle: EstimateBundle,
  scope: ScopeModel,
  config: SolutionConfig,
  estimationConfig: EstimationConfig,
  overrides: ComplexityOverride[],
  computedAt: string,
): EstimateBundle {
  const applicable = applicableOverrides(overrides, bundle.suggestion);
  const result = calculateEstimate({
    suggestion: bundle.suggestion,
    scope,
    config,
    estimationConfig,
    overrides: applicable.overrides,
    computedAt,
  });
  return { suggestion: bundle.suggestion, overrides: applicable.overrides, result };
}
