/**
 * Persisted schema for `PrdBundle` (`src/domain/prd.ts` + `src/domain/session.ts`). Statements,
 * capabilities and journeys already have Zod schemas in the domain; this file only adds the
 * document/functional-scope wrappers around them.
 */
import { z } from 'zod';
import { CapabilitySchema, PrdSectionIdSchema, TracedStatementSchema, UserJourneySchema } from '../../domain';

const PrdSectionSchema = z.object({
  id: PrdSectionIdSchema,
  title: z.string().min(1),
  statements: z.array(TracedStatementSchema),
});

export const PrdDocumentSchema = z.object({
  title: z.string().min(1),
  sections: z.array(PrdSectionSchema),
  journeys: z.array(UserJourneySchema),
});

const ScopeGroupingSchema = z.object({
  name: z.string().min(1),
  capabilityIds: z.array(z.string()).default([]),
  requirementIds: z.array(z.string()).default([]),
});

const DeliveryPackagePlanSchema = ScopeGroupingSchema.extend({
  engagementModel: z.enum(['topcoder-challenge-series', 'dedicated-team', 'blended']),
  suggestedChallengeTypes: z.array(z.string()).default([]),
});

export const FunctionalScopeSchema = z.object({
  capabilities: z.array(CapabilitySchema),
  recommendedEnhancements: z.array(CapabilitySchema).default([]),
  modules: z.array(ScopeGroupingSchema).default([]),
  workstreams: z.array(ScopeGroupingSchema).default([]),
  deliveryPackages: z.array(DeliveryPackagePlanSchema).default([]),
  outOfScope: z.array(TracedStatementSchema).default([]),
});

export const PrdBundleSchema = z.object({
  prd: PrdDocumentSchema,
  functionalScope: FunctionalScopeSchema,
});
