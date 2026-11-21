/**
 * Stage entry for the 'design-architecture' task: resolves the platform (user-selected, or the transparent recommendation),
 * asks the orchestrator to run the task (mock planner or live provider, validated against the same
 * schema either way), applies semantic validation, and assembles the final ArchitectureDesign - the
 * recommendation is always attached, even when the user picked the platform manually, so the choice
 * stays auditable.
 */
import { runTask } from '../ai';
import type { ArchitectureContext, TaskRunOptions } from '../ai/types';
import type { ArchitectureDesign, Capability, CloudPlatform, CustomerContext, GenerationMeta, ScopeModel, SolutionConfig } from '../domain';
import { CLOUD_SERVICE_CATALOG } from './catalog/cloudServiceCatalog.data';
import { architectureTask } from './prompt';
import { recommendPlatform } from './recommender';
import { validateArchitectureOutput } from './validate';

export interface ArchitectureInput {
  scope: ScopeModel;
  customer: CustomerContext;
  config: SolutionConfig;
  capabilities: Capability[];
}

/** The user's explicit choice wins when one was made; otherwise the transparent recommendation. */
function resolvePlatform(config: SolutionConfig, recommended: CloudPlatform): CloudPlatform {
  return config.cloudSelectionMode === 'user-selected' && config.cloudPlatform !== null ? config.cloudPlatform : recommended;
}

function resolveSelection(config: SolutionConfig): ArchitectureDesign['selection'] {
  return config.cloudSelectionMode === 'user-selected' && config.cloudPlatform !== null ? 'user-selected' : 'ai-recommended';
}

/** Generates the solution architecture for the reviewed scope, in mock or live mode (see runTask). */
export async function generateArchitecture(input: ArchitectureInput, run: TaskRunOptions): Promise<{ design: ArchitectureDesign; meta: GenerationMeta }> {
  const recommendation = recommendPlatform(input.scope, input.config);
  const platform = resolvePlatform(input.config, recommendation.recommended);

  const context: ArchitectureContext = {
    task: 'design-architecture',
    scope: input.scope,
    customer: input.customer,
    config: input.config,
    platform,
    catalog: [...CLOUD_SERVICE_CATALOG],
    capabilities: input.capabilities,
  };

  const result = await runTask(architectureTask, context, run);
  const { value, issues } = validateArchitectureOutput(result.value, context);

  const design: ArchitectureDesign = { ...value, selection: resolveSelection(input.config), recommendation };
  const meta: GenerationMeta = { ...result.meta, issues: [...result.meta.issues, ...issues] };

  return { design, meta };
}
