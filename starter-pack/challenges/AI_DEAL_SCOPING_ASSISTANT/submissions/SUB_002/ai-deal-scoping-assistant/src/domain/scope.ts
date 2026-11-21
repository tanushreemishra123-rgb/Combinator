/**
 * The structured, reviewable scope model - the single shared model every deliverable is built from.
 */
import { z } from 'zod';
import { PrioritySchema, ProvenanceSchema } from './common';
import type { ValidationIssue } from './common';
import { SourceRefSchema } from './source';

export const ScopeItemKindSchema = z.enum([
  'business',
  'persona',
  'functional',
  'nonFunctional',
  'existingSystem',
  'integration',
  'data',
  'security',
  'technology',
  'constraint',
  'dependency',
  'risk',
  'gap',
  'assumption',
  'question',
]);
export type ScopeItemKind = z.infer<typeof ScopeItemKindSchema>;

/** Estimation / design inputs that a gap or open question can leave undefined. */
export const EstimationInputKeySchema = z.enum([
  'expectedUsers',
  'environments',
  'deliveryDeadline',
  'integrationReadiness',
  'dataVolume',
  'complianceScope',
  'aiDataAvailability',
  'targetRegions',
]);
export type EstimationInputKey = z.infer<typeof EstimationInputKeySchema>;

/** What an AI provider must return for each extracted item (validated before use). */
export const ScopeItemDraftSchema = z.object({
  id: z.string().min(1),
  kind: ScopeItemKindSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  priority: PrioritySchema.default('Medium'),
  provenance: ProvenanceSchema,
  source: SourceRefSchema.nullable().default(null),
  /** Dependencies, assumptions and open questions associated with the item (scope-model IDs). */
  relatedIds: z.array(z.string()).default([]),
  /** For gaps/questions: which estimation or design inputs stay unknown until resolved. */
  affectsInputs: z.array(EstimationInputKeySchema).default([]),
  /** For gaps/questions/assumptions: true when the missing information is critical. */
  critical: z.boolean().default(false),
});
export type ScopeItemDraft = z.infer<typeof ScopeItemDraftSchema>;

export const AnalysisOutputSchema = z.object({
  summary: z.string().min(1),
  items: z.array(ScopeItemDraftSchema).min(1),
});
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;

export type ReviewStatus = 'pending' | 'approved' | 'rejected';

/** A scope item once it lives in the reviewable model. */
export interface ScopeItem extends ScopeItemDraft {
  /** Deterministic taxonomy tags (see analysis/signals) that drive downstream generators. */
  signals: string[];
  review: ReviewStatus;
  /** Scope inclusion / exclusion toggle - excluded items are listed as out of scope. */
  inScope: boolean;
  userEdited: boolean;
  /** Questions: answered. Assumptions: validated by a human. Gaps: closed. */
  resolved: boolean;
  /** Answer to a question or validation note for an assumption. */
  resolution: string;
}

export interface ScopeModel {
  summary: string;
  items: ScopeItem[];
  /** Incremented on every reviewed edit; outputs record the version they were generated from. */
  version: number;
  approvedAt: string | null;
  approvedVersion: number | null;
  issues: ValidationIssue[];
}

/** Kinds that represent requirements which must be covered by downstream deliverables. */
export const REQUIREMENT_KINDS: readonly ScopeItemKind[] = [
  'business',
  'functional',
  'nonFunctional',
  'integration',
  'data',
  'security',
];
