/**
 * Prompt for the 'suggest-estimate-inputs' task. The model is asked for estimation *inputs* only
 * and is explicitly forbidden to state days, weeks or money - the engine calculates every number.
 */
import {
  buildSystemPrompt,
  describeConfigForPrompt,
  describeCustomerForPrompt,
  describeScopeForPrompt,
  jsonContract,
} from '../ai';
import type { EstimateContext, PromptParts, TaskDefinition } from '../ai/types';
import { DELIVERY_PHASES, DriverTypeSchema, EstimateSuggestionSchema } from '../domain';
import type { EstimateSuggestion } from '../domain';
import { COMPLEXITY_LEVELS } from './complexity';
import { BUILD_PHASE_IDS } from './phases';

const ROLE = 'a delivery lead who prepares the estimation inputs of a scoping package';

const NUMBERS_RULE =
  'NUMBERS RULE: never state person-days, hours, weeks, months, dates, rates, prices or any other effort, timeline or cost figure. The application calculates every number from its visible estimation configuration; any figure you provide is removed.';

const OUTPUT_RULES: readonly string[] = [
  `Create workstreams with ids WS_01, WS_02, ... Each workstream belongs to exactly one build phase: ${BUILD_PHASE_IDS.join(', ')}. Do not create workstreams for the other phases; they are calculated as overheads.`,
  `Give each workstream at least one driver with ids DRV_01, DRV_02, ... unique across the whole answer. Allowed driver types: ${DriverTypeSchema.options.join(', ')}.`,
  'Create one driver per functional capability, per integration, per data domain or migration need, per AI use case, per security or compliance control group, plus infrastructure and non-functional hardening drivers.',
  `Suggest a complexity for every driver (${COMPLEXITY_LEVELS.join(', ')}). For integrations and AI use cases reuse the complexity listed below. The rationale must name the facts that set the complexity and cite their ids.`,
  'refIds and requirementIds may only contain ids that appear in this prompt (scope items, capabilities, architecture components, integrations, AI use cases). Unknown ids are dropped.',
  'Omit the AI Capabilities phase when no AI use case is listed.',
  'List the skills each workstream needs, and the delivery risks (ER_01...), dependencies (ED_01...), assumptions (EA_01...) and exclusions (EX_01...) of the estimate, grounded in the RSK, DEP, ASM, GAP and Q items. Include the standard ROM exclusions such as licences, cloud consumption and support beyond handover.',
  'Write the explanation as one short paragraph on how the workstreams and complexity levels were derived. It must not contain numbers of days, weeks or money.',
];

function section(title: string, body: string): string {
  return `${title}\n${body.trim() === '' ? 'None.' : body}`;
}

function listLines(lines: readonly string[]): string {
  return lines.join('\n');
}

function describeEstimationSubjects(context: EstimateContext): string[] {
  const capabilities = context.capabilities.map(
    (capability) =>
      `${capability.id} | ${capability.name} | ${capability.priority} | ${capability.label} | workstream: ${capability.workstream} | requirements: ${capability.requirementIds.join(', ')}`,
  );
  const components = context.components.map(
    (component) => `${component.id} | ${component.area} | ${component.name} | ${component.service}`,
  );
  const integrations = context.integrations.map(
    (spec) =>
      `${spec.id} | ${spec.name} | ${spec.system} | ${spec.direction} ${spec.pattern} | complexity: ${spec.complexity} | readiness: ${spec.readiness} | requirements: ${spec.requirementIds.join(', ')}`,
  );
  const useCases = context.aiUseCases.map(
    (useCase) =>
      `${useCase.id} | ${useCase.name} | ${useCase.pattern} | complexity: ${useCase.complexity} | requirements: ${useCase.requirementIds.join(', ')}`,
  );
  return [
    section('FUNCTIONAL CAPABILITIES', listLines(capabilities)),
    section('ARCHITECTURE COMPONENTS', listLines(components)),
    section('INTEGRATIONS', listLines(integrations)),
    section('AI USE CASES', listLines(useCases)),
  ];
}

function buildPrompt(context: EstimateContext): PromptParts {
  const phases = DELIVERY_PHASES.map((phase) => `${phase.id} ${phase.name}`);
  return {
    system: [buildSystemPrompt(ROLE), NUMBERS_RULE].join('\n'),
    prompt: [
      'TASK: Suggest the estimation inputs (workstreams, scope drivers, complexity levels, skills, risks, dependencies, assumptions and exclusions) for the solution below.',
      NUMBERS_RULE,
      section('CUSTOMER', describeCustomerForPrompt(context.customer)),
      section('SOLUTION CONFIGURATION', describeConfigForPrompt(context.config)),
      section('REVIEWED SCOPE MODEL', describeScopeForPrompt(context.scope)),
      ...describeEstimationSubjects(context),
      section('DELIVERY PHASES', listLines(phases)),
      section('OUTPUT RULES', listLines(OUTPUT_RULES.map((rule, index) => `${index + 1}. ${rule}`))),
      section('OUTPUT JSON CONTRACT', jsonContract(EstimateSuggestionSchema)),
    ].join('\n\n'),
  };
}

export const estimateInputsTask: TaskDefinition<EstimateContext, EstimateSuggestion> = {
  id: 'suggest-estimate-inputs',
  label: 'Suggest estimate inputs',
  schema: EstimateSuggestionSchema,
  buildPrompt,
};
