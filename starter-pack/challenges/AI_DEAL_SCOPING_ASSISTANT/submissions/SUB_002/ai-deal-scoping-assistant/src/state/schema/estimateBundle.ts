/**
 * Persisted schema for the estimate section. `EstimateResult` is deliberately NOT part of this
 * schema: it is the deterministic engine's output, never trusted from storage. `sessionSchema.ts`
 * rebuilds it with `calculateEstimate` from the validated `suggestion` + `overrides` after parsing.
 */
import { z } from 'zod';
import { EstimateSuggestionSchema } from '../../domain';
import { ComplexityOverrideSchema } from './estimationConfig';

export const PersistedEstimateBundleSchema = z.object({
  suggestion: EstimateSuggestionSchema,
  overrides: z.array(ComplexityOverrideSchema).default([]),
});
export type PersistedEstimateBundle = z.infer<typeof PersistedEstimateBundleSchema>;
