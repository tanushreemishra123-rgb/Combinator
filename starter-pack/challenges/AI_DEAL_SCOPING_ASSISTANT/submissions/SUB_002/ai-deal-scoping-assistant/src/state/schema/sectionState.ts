/** Generic persisted schema for the `SectionState<T>` wrapper every generated deliverable is kept in. */
import { z } from 'zod';
import { GenerationMetaSchema } from './scopeModel';

export function sectionStateSchema<Data extends z.ZodTypeAny>(dataSchema: Data) {
  return z.object({
    data: dataSchema.nullable().default(null),
    status: z.enum(['empty', 'current', 'stale']).default('empty'),
    reviewed: z.boolean().default(false),
    meta: GenerationMetaSchema.nullable().default(null),
    staleReasons: z.array(z.string()).default([]),
  });
}
