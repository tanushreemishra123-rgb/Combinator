/**
 * Persisted schema for `ArchitectureDesign` (`src/domain/architecture.ts`): the generated
 * `ArchitectureOutput` (already a domain Zod schema) plus the platform-selection/recommendation
 * extras that only exist once a design has been produced.
 */
import { z } from 'zod';
import { ArchitectureOutputSchema, CloudPlatformSchema } from '../../domain';

const PlatformScoreSchema = z.object({
  platform: CloudPlatformSchema,
  score: z.number(),
  reasons: z.array(z.object({ text: z.string(), refs: z.array(z.string()).default([]), points: z.number() })).default([]),
});

const PlatformRecommendationSchema = z.object({
  recommended: CloudPlatformSchema,
  scores: z.array(PlatformScoreSchema).default([]),
  explanation: z.string().default(''),
});

export const ArchitectureDesignSchema = ArchitectureOutputSchema.extend({
  selection: z.enum(['user-selected', 'ai-recommended']),
  recommendation: PlatformRecommendationSchema,
});
