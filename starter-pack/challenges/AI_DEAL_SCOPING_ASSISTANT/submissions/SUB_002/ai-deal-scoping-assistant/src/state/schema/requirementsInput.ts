/**
 * Persisted schema for the requirements-input document (`src/domain/source.ts`). `normalized` is
 * validated here only so a corrupt entry cannot crash the load - the session hydrator always
 * rebuilds it from `rawText` with `normalizeRequirements`, never trusting the stored copy.
 */
import { z } from 'zod';

const SOURCE_FORMATS = ['text', 'markdown', 'docx', 'pdf'] as const;

export const UploadedDocumentInfoSchema = z.object({
  name: z.string().min(1),
  format: z.enum(SOURCE_FORMATS),
  characters: z.number().int().nonnegative(),
  addedAt: z.string(),
});

const SourceLineSchema = z.object({
  number: z.number().int().nonnegative(),
  text: z.string(),
  sectionId: z.string(),
});

const SourceSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  level: z.number().int().nonnegative(),
  lineStart: z.number().int().nonnegative(),
  lineEnd: z.number().int().nonnegative(),
});

export const NormalizedDocumentSchema = z.object({
  text: z.string(),
  lines: z.array(SourceLineSchema),
  sections: z.array(SourceSectionSchema),
  wordCount: z.number().int().nonnegative(),
});

export const RequirementsInputSchema = z.object({
  rawText: z.string().default(''),
  documents: z.array(UploadedDocumentInfoSchema).default([]),
  normalized: NormalizedDocumentSchema.nullable().default(null),
  scenarioId: z.string().nullable().default(null),
});
