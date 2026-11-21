/**
 * Shared vocabulary used by every deliverable in the scoping package.
 *
 * All structures that can be produced by an AI provider are declared as Zod schemas so the same
 * definition is used for (a) runtime validation of AI output, (b) validation of imported
 * sessions, and (c) the static TypeScript types consumed by the UI and the engines.
 */
import { z } from 'zod';

export const PrioritySchema = z.enum(['High', 'Medium', 'Low']);
export type Priority = z.infer<typeof PrioritySchema>;

/** Where a statement came from - the core of the grounding hierarchy. */
export const ProvenanceSchema = z.enum(['customer-stated', 'ai-inferred', 'assumed']);
export type Provenance = z.infer<typeof ProvenanceSchema>;

/** How a generated scope/PRD statement relates to what the customer actually asked for. */
export const ContentLabelSchema = z.enum([
  'customer-requested',
  'ai-interpretation',
  'recommended-enhancement',
  'assumption-to-confirm',
  'out-of-scope',
]);
export type ContentLabel = z.infer<typeof ContentLabelSchema>;

export const ConfidenceSchema = z.enum(['High', 'Medium', 'Low']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const ComplexitySchema = z.enum(['Low', 'Medium', 'High', 'Very High']);
export type Complexity = z.infer<typeof ComplexitySchema>;

export const CloudPlatformSchema = z.enum(['aws', 'azure', 'gcp']);
export type CloudPlatform = z.infer<typeof CloudPlatformSchema>;

/** A sentence in a generated deliverable together with the scope-model IDs that justify it. */
export const TracedStatementSchema = z.object({
  text: z.string().min(1),
  refs: z.array(z.string()).default([]),
  label: ContentLabelSchema.default('ai-interpretation'),
});
export type TracedStatement = z.infer<typeof TracedStatementSchema>;

/** A problem found while validating AI output or cross-checking deliverables. */
export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  /** IDs of the scope items / output elements the issue relates to. */
  refs: string[];
}

/** Audit record attached to every generated section so reviewers can see how it was produced. */
export interface GenerationMeta {
  providerId: string;
  providerLabel: string;
  mode: 'mock' | 'live';
  /** True when a live call failed and the clearly-labelled mock generator was used instead. */
  usedFallback: boolean;
  generatedAt: string;
  durationMs: number;
  scopeVersion: number;
  issues: ValidationIssue[];
}

export interface MoneyRange {
  low: number;
  likely: number;
  high: number;
  currency: string;
}

export interface NumericRange {
  low: number;
  likely: number;
  high: number;
}
