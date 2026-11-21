/**
 * Cloud-specific solution architecture. Components map a logical building block to a concrete
 * service of the selected platform and must cite the requirements/assumptions that justify them.
 */
import { z } from 'zod';
import { CloudPlatformSchema, TracedStatementSchema } from './common';

export const ARCHITECTURE_AREAS = [
  'user-apps',
  'backend',
  'api',
  'data-storage',
  'identity',
  'messaging',
  'integration',
  'ai-ml',
  'observability',
  'security',
  'deployment',
  'environments',
  'availability',
  'backup-dr',
] as const;
export const ArchitectureAreaSchema = z.enum(ARCHITECTURE_AREAS);
export type ArchitectureArea = z.infer<typeof ArchitectureAreaSchema>;

export const ArchitectureComponentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  area: ArchitectureAreaSchema,
  /** Key into the cloud service catalog, e.g. 'managed-relational-db'. */
  logicalComponent: z.string().min(1),
  service: z.string().min(1),
  requirementIds: z.array(z.string()).default([]),
  assumptionIds: z.array(z.string()).default([]),
  purpose: z.string().min(1),
  rationale: z.string().min(1),
  tradeOffs: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  securityConsiderations: z.array(z.string()).default([]),
});
export type ArchitectureComponent = z.infer<typeof ArchitectureComponentSchema>;

export const ArchitectureFlowSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().default(''),
  kind: z.enum(['request', 'event', 'data', 'batch', 'auth', 'telemetry']).default('request'),
});
export type ArchitectureFlow = z.infer<typeof ArchitectureFlowSchema>;

export const EnvironmentPlanSchema = z.object({
  name: z.string().min(1),
  purpose: z.string().min(1),
  sizing: z.string().default(''),
});
export type EnvironmentPlan = z.infer<typeof EnvironmentPlanSchema>;

export const ArchitectureOutputSchema = z.object({
  platform: CloudPlatformSchema,
  summary: z.array(TracedStatementSchema).min(1),
  components: z.array(ArchitectureComponentSchema).min(1),
  flows: z.array(ArchitectureFlowSchema).default([]),
  environments: z.array(EnvironmentPlanSchema).default([]),
  deployment: z.array(TracedStatementSchema).default([]),
  availability: z.array(TracedStatementSchema).default([]),
  backupDr: z.array(TracedStatementSchema).default([]),
  securityControls: z.array(TracedStatementSchema).default([]),
});
export type ArchitectureOutput = z.infer<typeof ArchitectureOutputSchema>;

export interface PlatformScore {
  platform: z.infer<typeof CloudPlatformSchema>;
  score: number;
  reasons: { text: string; refs: string[]; points: number }[];
}

/** Transparent, rule-based platform recommendation (shown even when the user picks manually). */
export interface PlatformRecommendation {
  recommended: z.infer<typeof CloudPlatformSchema>;
  scores: PlatformScore[];
  explanation: string;
}

export interface ArchitectureDesign extends ArchitectureOutput {
  selection: 'user-selected' | 'ai-recommended';
  recommendation: PlatformRecommendation;
}

/** One catalog row: the concrete service each cloud offers for a logical component. */
export interface CloudServiceCatalogEntry {
  logicalComponent: string;
  label: string;
  area: ArchitectureArea;
  services: { platform: z.infer<typeof CloudPlatformSchema>; service: string; notes: string }[];
}
