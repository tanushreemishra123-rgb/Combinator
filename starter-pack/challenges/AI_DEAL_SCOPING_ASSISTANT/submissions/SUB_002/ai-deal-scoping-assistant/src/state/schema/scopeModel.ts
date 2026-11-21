/**
 * Persisted schema for the reviewed `ScopeModel` (`src/domain/scope.ts`): every AI-draft field plus
 * the reviewer-facing fields (`signals`, `review`, `inScope`, `userEdited`, `resolved`, `resolution`)
 * that only exist once a draft has been turned into a reviewable item.
 */
import { z } from 'zod';
import { ScopeItemDraftSchema } from '../../domain';

export const ScopeItemSchema = ScopeItemDraftSchema.extend({
  signals: z.array(z.string()).default([]),
  review: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  inScope: z.boolean().default(true),
  userEdited: z.boolean().default(false),
  resolved: z.boolean().default(false),
  resolution: z.string().default(''),
});

const ValidationIssueSchema = z.object({
  severity: z.enum(['error', 'warning', 'info']),
  code: z.string(),
  message: z.string(),
  refs: z.array(z.string()).default([]),
});

export const ScopeModelSchema = z.object({
  summary: z.string().default(''),
  items: z.array(ScopeItemSchema).default([]),
  version: z.number().int().positive(),
  approvedAt: z.string().nullable(),
  approvedVersion: z.number().int().positive().nullable(),
  issues: z.array(ValidationIssueSchema).default([]),
});

/** Reused by every `SectionState.meta` (see `sectionState.ts`) - one audit record per generation. */
export const GenerationMetaSchema = z.object({
  providerId: z.string(),
  providerLabel: z.string(),
  mode: z.enum(['mock', 'live']),
  usedFallback: z.boolean(),
  generatedAt: z.string(),
  durationMs: z.number().nonnegative(),
  scopeVersion: z.number().int().nonnegative(),
  issues: z.array(ValidationIssueSchema).default([]),
});
