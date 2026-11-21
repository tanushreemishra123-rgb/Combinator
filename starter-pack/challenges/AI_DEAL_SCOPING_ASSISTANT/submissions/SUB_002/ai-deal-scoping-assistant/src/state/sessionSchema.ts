/**
 * Zod validation for everything a `ScopingSession` persists or a workspace file imports (spec
 * "Grounding and Information Hierarchy"). Unknown keys are
 * stripped by Zod's default object behaviour, which also blocks prototype-pollution payloads).
 *
 * Computed data is never trusted from storage: `EstimateResult` is re-derived from the validated
 * `suggestion` + `overrides` with `calculateEstimate`, `input.normalized` is re-derived from
 * `rawText` with `normalizeRequirements`, and `quality` is always reset to `null` (the next quality
 * gate run recomputes it against whatever the session actually contains).
 */
import { z } from 'zod';
import { AiStrategyOutputSchema, DataIntegrationOutputSchema, emptySection } from '../domain';
import type { EstimateBundle, ScopeModel, ScopingSession, SectionState, SolutionConfig, EstimationConfig } from '../domain';
import { normalizeRequirements } from '../ingestion';
import { calculateEstimate } from '../estimation';
import { ArchitectureDesignSchema } from './schema/architectureDesign';
import { CustomerContextSchema } from './schema/customerContext';
import { PersistedEstimateBundleSchema } from './schema/estimateBundle';
import { EstimationConfigSchema } from './schema/estimationConfig';
import { ImpactReportSchema } from './schema/impactReport';
import { PrdBundleSchema } from './schema/prdBundle';
import { RequirementsInputSchema } from './schema/requirementsInput';
import { ScopeModelSchema } from './schema/scopeModel';
import { sectionStateSchema } from './schema/sectionState';
import { SolutionConfigSchema } from './schema/solutionConfig';

export * from './schema/customerContext';
export * from './schema/solutionConfig';
export * from './schema/estimationConfig';
export * from './schema/requirementsInput';
export * from './schema/scopeModel';
export * from './schema/sectionState';
export * from './schema/prdBundle';
export * from './schema/architectureDesign';
export * from './schema/estimateBundle';
export * from './schema/impactReport';

/** Every field of `ScopingSession` except the two computed ones (`quality`, `outputs.estimate.result`). */
export const PersistedScopingSessionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  customer: CustomerContextSchema,
  input: RequirementsInputSchema,
  scope: ScopeModelSchema.nullable(),
  config: SolutionConfigSchema,
  estimationConfig: EstimationConfigSchema,
  outputs: z.object({
    prd: sectionStateSchema(PrdBundleSchema),
    architecture: sectionStateSchema(ArchitectureDesignSchema),
    dataIntegration: sectionStateSchema(DataIntegrationOutputSchema),
    aiStrategy: sectionStateSchema(AiStrategyOutputSchema),
    estimate: sectionStateSchema(PersistedEstimateBundleSchema),
  }),
  changeLog: z.array(ImpactReportSchema).default([]),
  executiveSummary: z.string().default(''),
});
export type PersistedScopingSession = z.infer<typeof PersistedScopingSessionSchema>;

type PersistedEstimateSection = PersistedScopingSession['outputs']['estimate'];

/**
 * Re-derives the estimate result with the pure calculation engine. A stored suggestion that no
 * longer calculates cleanly (or has no scope to calculate against) resets the section to empty
 * rather than failing the whole session load - the reviewer just regenerates that one stage.
 */
function rebuildEstimateSection(
  persisted: PersistedEstimateSection,
  scope: ScopeModel | null,
  config: SolutionConfig,
  estimationConfig: EstimationConfig,
  now: string,
): SectionState<EstimateBundle> {
  if (persisted.data === null || scope === null) {
    return emptySection<EstimateBundle>();
  }
  try {
    const result = calculateEstimate({
      suggestion: persisted.data.suggestion,
      scope,
      config,
      estimationConfig,
      overrides: persisted.data.overrides,
      computedAt: now,
    });
    return {
      data: { suggestion: persisted.data.suggestion, overrides: persisted.data.overrides, result },
      status: persisted.status,
      reviewed: persisted.reviewed,
      meta: persisted.meta,
      staleReasons: persisted.staleReasons,
    };
  } catch {
    return emptySection<EstimateBundle>();
  }
}

/** Turns validated, storage-shaped data into a real `ScopingSession`, applying every rebuild rule above. */
export function hydrateSession(persisted: PersistedScopingSession, now: string): ScopingSession {
  return {
    id: persisted.id,
    name: persisted.name,
    createdAt: persisted.createdAt,
    updatedAt: persisted.updatedAt,
    customer: persisted.customer,
    input: { ...persisted.input, normalized: normalizeRequirements(persisted.input.rawText) },
    scope: persisted.scope,
    config: persisted.config,
    estimationConfig: persisted.estimationConfig,
    outputs: {
      prd: persisted.outputs.prd,
      architecture: persisted.outputs.architecture,
      dataIntegration: persisted.outputs.dataIntegration,
      aiStrategy: persisted.outputs.aiStrategy,
      estimate: rebuildEstimateSection(persisted.outputs.estimate, persisted.scope, persisted.config, persisted.estimationConfig, now),
    },
    changeLog: persisted.changeLog,
    quality: null,
    executiveSummary: persisted.executiveSummary,
  };
}

function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map((segment) => String(segment)).join('.');
    return path.length === 0 ? issue.message : `${path}: ${issue.message}`;
  });
}

export interface SessionValidationSuccess {
  readonly ok: true;
  readonly session: ScopingSession;
}
export interface SessionValidationFailure {
  readonly ok: false;
  readonly errors: string[];
}
export type SessionValidationResult = SessionValidationSuccess | SessionValidationFailure;

/**
 * Validates one stored or imported session. `now` is the calculation timestamp for the rebuilt
 * estimate, injected so this stays reproducible in tests (pure functions take timestamps as
 * parameters).
 */
export function parseSession(raw: unknown, now: string): SessionValidationResult {
  const parsed = PersistedScopingSessionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: formatZodIssues(parsed.error) };
  }
  return { ok: true, session: hydrateSession(parsed.data, now) };
}
