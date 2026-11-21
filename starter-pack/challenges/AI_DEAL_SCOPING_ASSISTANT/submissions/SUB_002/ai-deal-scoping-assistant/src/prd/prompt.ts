/**
 * Prompt for the 'generate-prd' task. The live provider sends this prompt and validates the
 * response against PrdOutputSchema; the mock provider ignores the prompt text and calls planPrd
 * directly, but both paths go through the same schema (see src/ai orchestrator).
 */
import { buildSystemPrompt, describeCustomerForPrompt, describeScopeForPrompt, jsonContract } from '../ai/promptKit';
import type { PrdContext, PromptParts, TaskDefinition } from '../ai/types';
import type { PrdOutput } from '../domain';
import { PrdOutputSchema } from '../domain';

const TASK_INSTRUCTIONS = [
  'Produce a PRD and functional scope for the reviewed customer scope below.',
  'Decompose the reviewed functional, integration, data, AI and security requirements into capabilities; every capability must cite the requirement IDs that justify it.',
  'Distinguish five kinds of content with the matching label: customer-requested scope (customer-requested), your own AI-derived interpretation (ai-interpretation), enhancements the customer did not ask for (recommended-enhancement), assumptions that still need confirmation (assumption-to-confirm), and items that are explicitly out of scope (out-of-scope).',
  'Only cite IDs that appear in the reviewed scope below; never invent an ID, and never mark a capability customer-requested unless every requirement it cites is customer-stated.',
  'Write one user journey per listed persona, grounded in the capabilities that persona would use, citing the requirement IDs each step depends on.',
].join(' ');

function buildPrompt(context: PrdContext): PromptParts {
  const system = buildSystemPrompt('a senior product manager and business analyst preparing a PRD and functional scope for a Topcoder delivery proposal');
  const prompt = [
    `Customer context:\n${describeCustomerForPrompt(context.customer)}`,
    `Reviewed scope model (cite only these IDs):\n${describeScopeForPrompt(context.scope)}`,
    `Instructions: ${TASK_INSTRUCTIONS}`,
    jsonContract(PrdOutputSchema),
  ].join('\n\n');
  return { system, prompt };
}

export const prdTask: TaskDefinition<PrdContext, PrdOutput> = {
  id: 'generate-prd',
  label: 'PRD and functional scope generation',
  schema: PrdOutputSchema,
  buildPrompt,
};
