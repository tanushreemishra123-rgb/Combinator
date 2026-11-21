/**
 * The 'design-architecture' AI task: how to prompt a live provider, and the Zod schema its JSON
 * response must satisfy (ArchitectureOutputSchema - the same schema the mock planner's output is
 * validated against, so both travel through identical checks). The prompt embeds the requested
 * platform's catalog so the model is limited to concrete, current services for that platform
 * (spec section 3 constraint: "must not be limited to a generic list of technologies").
 */
import { buildSystemPrompt, describeConfigForPrompt, describeCustomerForPrompt, describeScopeForPrompt, jsonContract } from '../ai';
import type { ArchitectureContext, PromptParts, TaskDefinition } from '../ai/types';
import { ArchitectureOutputSchema, type ArchitectureOutput } from '../domain';
import { getCatalogService, platformLabel } from './catalog/cloudServiceCatalog.data';

/** One line per catalog logical component, mapped to the requested platform's concrete service. */
function describeCatalogForPrompt(context: ArchitectureContext): string {
  const heading = `Approved service catalog for ${platformLabel(context.platform)} - propose a service ONLY from this list for the matching logical component:`;
  const lines = context.catalog.map((entry) => {
    const service = getCatalogService(entry.logicalComponent, context.platform) ?? entry.label;
    return `- ${entry.logicalComponent} (${entry.label}, area: ${entry.area}) -> ${service}`;
  });
  return [heading, ...lines].join('\n');
}

const COVERAGE_AREAS: readonly string[] = [
  'user-facing applications',
  'backend services',
  'APIs',
  'databases and storage',
  'identity and access management',
  'messaging and event processing',
  'integration components',
  'AI and machine-learning services (only when the scope has an AI use case)',
  'observability and monitoring',
  'security controls',
  'deployment and runtime approach',
  'development, test and production environments',
  'availability and scalability',
  'backup and disaster recovery',
];

function buildInstructions(context: ArchitectureContext): string {
  const lines = [
    `Design a solution architecture on ${platformLabel(context.platform)} for the reviewed scope above. Cover the applicable areas from this list: ${COVERAGE_AREAS.join('; ')}.`,
    'For every component: set logicalComponent to a key from the catalog above, and service to that platform-specific catalog value - never a generic or cross-platform name.',
    'requirementIds/assumptionIds must only use ids that appear in the reviewed scope items above; every major component must cite at least one such id, or reviewed assumption - never invent a rationale for a component nothing in the scope supports.',
    'rationale must name the citing ids and the concrete service feature that satisfies them (for example: "Azure Database for PostgreSQL satisfies DATA_01, NFR_03 by providing managed PostgreSQL compatibility, automated backups and encryption").',
    'List tradeOffs, dependencies and securityConsiderations for every component.',
    'flows must connect component ids you defined; represent an external system as "ext:<citing id>:<system name>".',
    `Set the platform field to exactly "${context.platform}".`,
  ];
  return lines.join('\n');
}

export const architectureTask: TaskDefinition<ArchitectureContext, ArchitectureOutput> = {
  id: 'design-architecture',
  label: 'Cloud Solution Architecture',
  schema: ArchitectureOutputSchema,
  buildPrompt(context: ArchitectureContext): PromptParts {
    const sections = [
      describeCustomerForPrompt(context.customer),
      describeConfigForPrompt(context.config),
      describeScopeForPrompt(context.scope),
      describeCatalogForPrompt(context),
      buildInstructions(context),
      jsonContract(ArchitectureOutputSchema),
    ];
    return { system: buildSystemPrompt('solution architect'), prompt: sections.join('\n\n') };
  },
};
