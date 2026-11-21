/**
 * Live-provider prompts for the two strategy tasks. The mock provider never reads these (it calls
 * planDataIntegration/planAiSolution directly - see stage.ts); a live response still has to satisfy
 * the same Zod schema and semantic validation as the deterministic plan.
 */
import type { AiSolutionContext, DataIntegrationContext, PromptParts, TaskDefinition } from '../ai/types';
import { buildSystemPrompt, describeConfigForPrompt, describeCustomerForPrompt, describeScopeForPrompt, jsonContract } from '../ai/promptKit';
import type { AiStrategyOutput, ArchitectureComponent, DataIntegrationOutput } from '../domain';
import { AiStrategyOutputSchema, DataIntegrationOutputSchema } from '../domain';

/** Component list with services, so a live response names the same concrete services the design already picked. */
function describeComponentsForPrompt(components: readonly ArchitectureComponent[]): string {
  if (components.length === 0) {
    return 'No architecture component has been designed yet.';
  }
  return components.map((component) => `${component.id} | ${component.area} | ${component.name} -> ${component.service}`).join('\n');
}

const DATA_INTEGRATION_ROLE =
  'a solution architect writing the data, integration and data-flow strategy for a cloud delivery scoping package';

function buildDataIntegrationPrompt(context: DataIntegrationContext): PromptParts {
  const system = buildSystemPrompt(DATA_INTEGRATION_ROLE);
  const prompt = [
    describeCustomerForPrompt(context.customer),
    describeConfigForPrompt(context.config),
    `Selected cloud platform: ${context.platform}.`,
    'Architecture components (id | area | name -> service):',
    describeComponentsForPrompt(context.components),
    'Reviewed scope items (id | kind | priority | provenance | text):',
    describeScopeForPrompt(context.scope),
    'Cover every one of the ten fixed data topics (ownership, ingestion, transactional-storage, analytical-storage, data-quality, metadata-governance, retention, privacy-security, reporting-analytics, backup-recovery), name only the services listed above for this platform, and cite the reviewed requirement ids that justify each domain, topic and integration.',
    jsonContract(DataIntegrationOutputSchema),
  ].join('\n\n');
  return { system, prompt };
}

export const PLAN_DATA_INTEGRATION_TASK: TaskDefinition<DataIntegrationContext, DataIntegrationOutput> = {
  id: 'plan-data-integration',
  label: 'Data, integration and data-flow strategy',
  schema: DataIntegrationOutputSchema,
  buildPrompt: buildDataIntegrationPrompt,
};

const AI_SOLUTION_ROLE = 'an AI solution architect writing the AI strategy for a cloud delivery scoping package';

function buildAiSolutionPrompt(context: AiSolutionContext): PromptParts {
  const system = buildSystemPrompt(AI_SOLUTION_ROLE);
  const prompt = [
    describeCustomerForPrompt(context.customer),
    describeConfigForPrompt(context.config),
    `Selected cloud platform: ${context.platform}. AI provider preference: ${context.config.aiProviderPreference}.`,
    'Architecture components (id | area | name -> service):',
    describeComponentsForPrompt(context.components),
    'Reviewed scope items (id | kind | priority | provenance | text):',
    describeScopeForPrompt(context.scope),
    "If, and only if, no reviewed item signals an AI need, set applicable to false, explain why in summary, and list the scope's activities under boundaries as deterministic - never invent a use case.",
    'Otherwise: for every AI use case, name the model/provider options for the selected platform and preference, and fill retrieval/orchestration/evaluation/safety/privacy/humanReview - none may be left empty.',
    'In boundaries, separate every activity into exactly one of ai, deterministic or human-decision, and include at least one of each when any AI use case applies.',
    'Every framework or service recommendation needs a rationale that names the requirement ids it is based on and explains why it, not a generic popular alternative, fits this scope; list the alternatives you considered and why you did not pick them.',
    jsonContract(AiStrategyOutputSchema),
  ].join('\n\n');
  return { system, prompt };
}

export const PLAN_AI_SOLUTION_TASK: TaskDefinition<AiSolutionContext, AiStrategyOutput> = {
  id: 'plan-ai-solution',
  label: 'AI solution strategy',
  schema: AiStrategyOutputSchema,
  buildPrompt: buildAiSolutionPrompt,
};
