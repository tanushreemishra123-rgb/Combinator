/**
 * PRD generation stage entry point: runs the 'generate-prd' task (mock planner or live provider),
 * semantically validates the result against the reviewed scope, then assembles the PRD document
 * and functional scope. Validation issues are appended to the returned GenerationMeta so the UI
 * can surface them without a second pass over the output.
 */
import { runTask } from '../ai';
import type { PrdContext, TaskRunOptions } from '../ai/types';
import type { CustomerContext, GenerationMeta, PrdBundle, ScopeModel, SolutionConfig } from '../domain';
import { buildPrdBundle } from './assemble';
import { prdTask } from './prompt';
import { validatePrdOutput } from './validate';

export interface PrdInput {
  scope: ScopeModel;
  customer: CustomerContext;
  config: SolutionConfig;
}

export async function generatePrd(input: PrdInput, run: TaskRunOptions): Promise<{ bundle: PrdBundle; meta: GenerationMeta }> {
  const context: PrdContext = { task: 'generate-prd', scope: input.scope, customer: input.customer, config: input.config };
  const { value, meta } = await runTask(prdTask, context, run);
  const { output, issues } = validatePrdOutput(value, input.scope);
  const bundle = buildPrdBundle(output, input.scope, input.customer);
  return { bundle, meta: { ...meta, issues: [...meta.issues, ...issues] } };
}
