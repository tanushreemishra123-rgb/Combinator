/**
 * Persisted schema for the change log (`ImpactReport[]`, `src/domain/impact.ts`). `ChangeKind` is a
 * plain TS union there with no runtime schema, so `ChangeKindSchema` mirrors it by hand; keep the
 * two in sync if `src/impact` (which owns that file) adds a new kind.
 */
import { z } from 'zod';
import { OUTPUT_SECTION_IDS } from '../../domain';

const CHANGE_KINDS = [
  'cloud-platform',
  'expected-users',
  'delivery-deadline',
  'environments',
  'target-regions',
  'ai-provider-preference',
  'requirement-priority',
  'requirement-text',
  'scope-inclusion',
  'security-requirement',
  'integration-complexity',
  'assumption',
  'question-resolved',
  'rate-card',
  'contingency',
  'currency',
  'productivity',
  'driver-complexity',
] as const;
export const ChangeKindSchema = z.enum(CHANGE_KINDS);

export const OutputSectionIdSchema = z.enum(OUTPUT_SECTION_IDS);

const ChangeDescriptorSchema = z.object({
  kind: ChangeKindSchema,
  targetId: z.string(),
  label: z.string(),
  from: z.string(),
  to: z.string(),
});

const ImpactEntrySchema = z.object({
  section: OutputSectionIdSchema,
  area: z.string(),
  elementIds: z.array(z.string()).default([]),
  reason: z.string(),
  action: z.enum(['regenerate', 'recalculate']),
});

const UnaffectedEntrySchema = z.object({
  section: z.union([OutputSectionIdSchema, z.literal('scope')]),
  area: z.string(),
  reason: z.string(),
});

export const ImpactReportSchema = z.object({
  id: z.string().min(1),
  change: ChangeDescriptorSchema,
  affected: z.array(ImpactEntrySchema).default([]),
  unaffected: z.array(UnaffectedEntrySchema).default([]),
  explanation: z.string().default(''),
  createdAt: z.string(),
  resolvedSections: z.array(OutputSectionIdSchema).default([]),
});
