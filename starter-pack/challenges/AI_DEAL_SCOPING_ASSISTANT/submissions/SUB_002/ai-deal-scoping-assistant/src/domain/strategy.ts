/**
 * Coordinated data, integration and AI solution strategy. Each major element references reviewed
 * requirement IDs so it shows up in the coverage view and in change-impact analysis.
 */
import { z } from 'zod';
import { ComplexitySchema, TracedStatementSchema } from './common';

export const DATA_TOPICS = [
  'ownership',
  'ingestion',
  'transactional-storage',
  'analytical-storage',
  'data-quality',
  'metadata-governance',
  'retention',
  'privacy-security',
  'reporting-analytics',
  'backup-recovery',
] as const;
export const DataTopicSchema = z.enum(DATA_TOPICS);
export type DataTopic = z.infer<typeof DataTopicSchema>;

export const DataDomainSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  sources: z.array(z.string()).default([]),
  owner: z.string().default('To be confirmed with customer'),
  classification: z.enum(['public', 'internal', 'confidential', 'regulated']).default('internal'),
  requirementIds: z.array(z.string()).default([]),
});
export type DataDomain = z.infer<typeof DataDomainSchema>;

export const DataTopicPlanSchema = z.object({
  topic: DataTopicSchema,
  approach: z.string().min(1),
  services: z.array(z.string()).default([]),
  requirementIds: z.array(z.string()).default([]),
});
export type DataTopicPlan = z.infer<typeof DataTopicPlanSchema>;

export const IntegrationSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  system: z.string().min(1),
  systemType: z.enum(['internal', 'external']).default('external'),
  direction: z.enum(['inbound', 'outbound', 'bidirectional']).default('bidirectional'),
  pattern: z.enum(['api', 'event', 'batch', 'file']).default('api'),
  protocol: z.string().default('REST/JSON over HTTPS'),
  authentication: z.string().min(1),
  errorHandling: z.string().min(1),
  retry: z.string().min(1),
  monitoring: z.string().min(1),
  dataSync: z.string().default(''),
  requirementIds: z.array(z.string()).default([]),
  /** Architecture component IDs that implement this integration. */
  componentIds: z.array(z.string()).default([]),
  complexity: ComplexitySchema.default('Medium'),
  readiness: z.enum(['confirmed', 'unknown']).default('unknown'),
});
export type IntegrationSpec = z.infer<typeof IntegrationSpecSchema>;

export const DataFlowSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  payload: z.string().default(''),
  mechanism: z.string().default(''),
});
export type DataFlow = z.infer<typeof DataFlowSchema>;

export const DataIntegrationOutputSchema = z.object({
  domains: z.array(DataDomainSchema).min(1),
  topics: z.array(DataTopicPlanSchema).min(1),
  integrations: z.array(IntegrationSpecSchema).default([]),
  flows: z.array(DataFlowSchema).default([]),
});
export type DataIntegrationOutput = z.infer<typeof DataIntegrationOutputSchema>;

export const ProcessingTypeSchema = z.enum(['ai', 'deterministic', 'human-decision']);
export type ProcessingType = z.infer<typeof ProcessingTypeSchema>;

export const AiUseCaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  requirementIds: z.array(z.string()).default([]),
  pattern: z.string().min(1),
  modelOptions: z.array(z.string()).default([]),
  retrieval: z.string().default(''),
  orchestration: z.string().default(''),
  evaluation: z.string().default(''),
  safety: z.string().default(''),
  privacy: z.string().default(''),
  humanReview: z.string().default(''),
  monitoring: z.string().default(''),
  complexity: ComplexitySchema.default('Medium'),
});
export type AiUseCase = z.infer<typeof AiUseCaseSchema>;

/** The four considerations the specification requires for every AI use case. */
export const AI_SAFEGUARD_FIELDS = ['evaluation', 'safety', 'privacy', 'humanReview'] as const;

export type AiSafeguardField = (typeof AI_SAFEGUARD_FIELDS)[number];

/**
 * Which of the required safeguards a use case leaves empty. One implementation so the validator,
 * the quality gate and the workspace can never disagree about what "missing" means; each caller
 * keeps its own wording and order for the fields it reports.
 */
export function missingAiSafeguards(useCase: Pick<AiUseCase, AiSafeguardField>): AiSafeguardField[] {
  const values: readonly (readonly [AiSafeguardField, string])[] = [
    ['evaluation', useCase.evaluation],
    ['safety', useCase.safety],
    ['privacy', useCase.privacy],
    ['humanReview', useCase.humanReview],
  ];
  return values.filter(([, value]) => value.trim().length === 0).map(([field]) => field);
}

/** Explicit split between AI functions, deterministic rules and mandatory human decisions. */
export const ProcessingBoundarySchema = z.object({
  activity: z.string().min(1),
  type: ProcessingTypeSchema,
  reason: z.string().min(1),
  requirementIds: z.array(z.string()).default([]),
});
export type ProcessingBoundary = z.infer<typeof ProcessingBoundarySchema>;

export const FrameworkRecommendationSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['orchestration', 'model-service', 'retrieval', 'evaluation', 'guardrails', 'sdk']),
  rationale: z.string().min(1),
  requirementIds: z.array(z.string()).default([]),
  alternatives: z.array(z.string()).default([]),
});
export type FrameworkRecommendation = z.infer<typeof FrameworkRecommendationSchema>;

export const AiStrategyOutputSchema = z.object({
  /** False when the requirements contain no AI need - the strategy then explains why. */
  applicable: z.boolean().default(true),
  summary: z.array(TracedStatementSchema).min(1),
  useCases: z.array(AiUseCaseSchema).default([]),
  boundaries: z.array(ProcessingBoundarySchema).default([]),
  architecturePattern: z.string().default(''),
  frameworks: z.array(FrameworkRecommendationSchema).default([]),
  promptManagement: z.string().default(''),
  evaluationApproach: z.string().default(''),
  responsibleAi: z.array(z.string()).default([]),
  monitoringAndFeedback: z.string().default(''),
  dataPrivacy: z.string().default(''),
});
export type AiStrategyOutput = z.infer<typeof AiStrategyOutputSchema>;
