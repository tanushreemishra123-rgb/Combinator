/**
 * Stage entries the rest of the app calls: build the typed AI context from the reviewed scope,
 * design and config, run the task (mock delegates to the planner in this module, live calls the
 * provider - see ai/index.ts), then run semantic validation and fold its issues into the audit
 * trail.
 */
import { runTask } from '../ai';
import type { AiSolutionContext, DataIntegrationContext, TaskRunOptions } from '../ai/types';
import type { AiStrategyOutput, ArchitectureDesign, CustomerContext, DataIntegrationOutput, GenerationMeta, ScopeModel, SolutionConfig } from '../domain';
import { PLAN_AI_SOLUTION_TASK, PLAN_DATA_INTEGRATION_TASK } from './prompts';
import { validateAiSolution, validateDataIntegration } from './validate';

export interface StrategyInput {
  scope: ScopeModel;
  customer: CustomerContext;
  config: SolutionConfig;
  design: ArchitectureDesign;
}

function dataIntegrationContext(input: StrategyInput): DataIntegrationContext {
  return { task: 'plan-data-integration', scope: input.scope, customer: input.customer, config: input.config, platform: input.design.platform, components: input.design.components };
}

function aiSolutionContext(input: StrategyInput): AiSolutionContext {
  return { task: 'plan-ai-solution', scope: input.scope, customer: input.customer, config: input.config, platform: input.design.platform, components: input.design.components };
}

/** Generates the data/integration strategy, then validates it against the reviewed scope and design. */
export async function generateDataIntegration(input: StrategyInput, run: TaskRunOptions): Promise<{ plan: DataIntegrationOutput; meta: GenerationMeta }> {
  const context = dataIntegrationContext(input);
  const result = await runTask(PLAN_DATA_INTEGRATION_TASK, context, run);
  const { value, issues } = validateDataIntegration(result.value, input.scope, input.design);
  const meta: GenerationMeta = { ...result.meta, issues: [...result.meta.issues, ...issues] };
  return { plan: value, meta };
}

/** Generates the AI-solution strategy, then validates it against the reviewed scope. */
export async function generateAiStrategy(input: StrategyInput, run: TaskRunOptions): Promise<{ strategy: AiStrategyOutput; meta: GenerationMeta }> {
  const context = aiSolutionContext(input);
  const result = await runTask(PLAN_AI_SOLUTION_TASK, context, run);
  const { value, issues } = validateAiSolution(result.value, input.scope);
  const meta: GenerationMeta = { ...result.meta, issues: [...result.meta.issues, ...issues] };
  return { strategy: value, meta };
}
