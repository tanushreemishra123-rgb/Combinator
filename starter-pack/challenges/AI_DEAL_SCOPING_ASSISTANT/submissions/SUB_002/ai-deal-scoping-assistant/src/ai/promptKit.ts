/** Shared prompt-building helpers used by every task's `buildPrompt(context)` implementation. */
import { z } from 'zod';
import type { CustomerContext, ScopeModel, SolutionConfig } from '../domain';

/** Grounding rules every AI task must follow, regardless of which stage is prompting it. */
const GROUNDING_RULES: readonly string[] = [
  'Use only the supplied, reviewed scope model and configuration as your source of truth - do not invent facts about the customer, their systems, or their industry.',
  'Cite only requirement, scope and component IDs that appear in the supplied input; never invent new IDs.',
  'Label anything you add that the customer did not explicitly state as an AI interpretation, a recommended enhancement, or an assumption to confirm.',
  'When information needed to complete a section is missing, surface it as an assumption or a clarification question instead of inventing a plausible-sounding answer.',
  'Never output effort, cost or timeline numbers - those are produced separately by a deterministic calculation engine.',
  'Respond with a single JSON object and nothing else: no prose, no markdown code fences, no commentary before or after the JSON.',
];

/** Combines a task-specific role description with the rules every generation task must follow. */
export function buildSystemPrompt(role: string): string {
  const rules = GROUNDING_RULES.map((rule, index) => `${index + 1}. ${rule}`).join('\n');
  return `${role}\n\nFollow these rules for every response:\n${rules}`;
}

/** One line per active, in-scope item: `ID | kind | priority | provenance | title: description`. */
export function describeScopeForPrompt(scope: ScopeModel): string {
  const activeItems = scope.items.filter((item) => item.inScope && item.review !== 'rejected');
  if (activeItems.length === 0) {
    return 'No active in-scope items are recorded yet.';
  }
  return activeItems
    .map((item) => `${item.id} | ${item.kind} | ${item.priority} | ${item.provenance} | ${item.title}: ${item.description}`)
    .join('\n');
}

export function describeCustomerForPrompt(customer: CustomerContext): string {
  const notes = customer.notes.trim().length > 0 ? customer.notes.trim() : 'None recorded.';
  return [
    `Customer: ${customer.customerName}`,
    `Industry: ${customer.industry}`,
    `Opportunity: ${customer.opportunityName}`,
    `Region: ${customer.region}`,
    `Engagement type: ${customer.engagementType}`,
    `Notes: ${notes}`,
  ].join('\n');
}

function describeOrUnspecified(value: string | number | null, unit = ''): string {
  return value === null ? 'Not yet specified by the customer.' : `${value}${unit}`;
}

export function describeConfigForPrompt(config: SolutionConfig): string {
  const platform =
    config.cloudPlatform === null
      ? `Not yet selected (mode: ${config.cloudSelectionMode}).`
      : `${config.cloudPlatform.toUpperCase()} (mode: ${config.cloudSelectionMode}).`;
  const regions = config.targetRegions.length > 0 ? config.targetRegions.join(', ') : 'Not yet specified.';
  return [
    `Cloud platform: ${platform}`,
    `Expected users: ${describeOrUnspecified(config.expectedUsers)}`,
    `Target regions: ${regions}`,
    `Delivery deadline: ${describeOrUnspecified(config.deliveryDeadlineWeeks, ' weeks')}`,
    `Environments: ${describeOrUnspecified(config.environments)}`,
    `AI provider preference: ${config.aiProviderPreference}`,
  ].join('\n');
}

/** JSON Schema text for the expected output, embedded in prompts so the model returns valid structure. */
export function jsonContract(schema: z.ZodType): string {
  try {
    return JSON.stringify(z.toJSONSchema(schema));
  } catch {
    return 'Return a single JSON value matching the structure requested above, and nothing else.';
  }
}
