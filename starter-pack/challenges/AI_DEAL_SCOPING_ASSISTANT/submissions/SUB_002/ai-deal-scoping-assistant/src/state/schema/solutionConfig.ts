/** Persisted schema for the solution configuration a reviewer sets in the Architecture/Estimate workspaces. */
import { z } from 'zod';
import { CloudPlatformSchema } from '../../domain';

/** Mirrors `AiProviderPreference` in `src/domain/config.ts` - a plain union with no runtime schema there. */
const AI_PROVIDER_PREFERENCES = ['cloud-native', 'openai', 'anthropic', 'open-source', 'no-preference'] as const;
export const AiProviderPreferenceSchema = z.enum(AI_PROVIDER_PREFERENCES);

export const SolutionConfigSchema = z.object({
  cloudPlatform: CloudPlatformSchema.nullable().default(null),
  cloudSelectionMode: z.enum(['user-selected', 'recommend']).default('recommend'),
  expectedUsers: z.number().int().nonnegative().nullable().default(null),
  targetRegions: z.array(z.string()).default([]),
  deliveryDeadlineWeeks: z.number().nonnegative().nullable().default(null),
  environments: z.number().int().nonnegative().nullable().default(null),
  aiProviderPreference: AiProviderPreferenceSchema.default('no-preference'),
});
