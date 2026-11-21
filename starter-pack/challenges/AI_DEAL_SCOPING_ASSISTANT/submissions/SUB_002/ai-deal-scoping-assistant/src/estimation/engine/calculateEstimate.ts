/**
 * The deterministic estimation engine. It reads only the suggestion (workstreams, drivers,
 * complexity), the reviewed scope, and the visible configuration; identical input always yields an
 * identical result. No clock, no randomness, no AI-supplied numbers, no historical data.
 */
import type { Complexity, EstimateNote, EstimateResult, EstimationConfig } from '../../domain';
import { detectMissingInputs } from '../missingInputs';
import type { WorkstreamFacts } from '../missingInputs';
import { comparePhaseIds } from '../phases';
import { distinct } from '../scopeFacts';
import type { CalculationInput } from '../types';
import { estimateTotals, finaliseWorkstream, summariseRoles } from './commercials';
import { assessConfidence } from './confidence';
import { assessDeadline } from './deadline';
import { createConfigLookups } from './lookups';
import type { EngineContext, WorkstreamDraft } from './model';
import { commercialAssumptions, explainResult } from './narrative';
import { buildOverheadDrafts } from './overheads';
import { CALCULATION_RULES } from './rules';
import { buildTimeline } from './timeline';
import { buildWorkstreamDraft } from './workstreams';

const DEADLINE_KEY = 'deliveryDeadline';

/** Deep copy so later edits of the live configuration can never alter a stored result. */
export function snapshotConfig(config: EstimationConfig): EstimationConfig {
  return {
    ...config,
    rates: config.rates.map((rate) => ({ ...rate })),
    baseEffort: config.baseEffort.map((row) => ({ ...row, days: row.days.map((cell) => ({ ...cell })) })),
    phaseOverheads: config.phaseOverheads.map((overhead) => ({ ...overhead })),
    roleMix: config.roleMix.map((row) => ({ ...row, shares: row.shares.map((share) => ({ ...share })) })),
    confidenceSpreads: config.confidenceSpreads.map((spread) => ({ ...spread })),
  };
}

function createEngineContext(input: CalculationInput): EngineContext {
  return {
    estimationConfig: input.estimationConfig,
    solution: input.config,
    lookups: createConfigLookups(input.estimationConfig),
    overrides: new Map<string, Complexity>(input.overrides.map((override) => [override.driverId, override.complexity])),
  };
}

function toFacts(draft: WorkstreamDraft): WorkstreamFacts {
  return {
    id: draft.id,
    driverTypes: distinct(draft.drivers.map((driver) => driver.type)),
    refIds: distinct([...draft.requirementIds, ...draft.drivers.flatMap((driver) => driver.refIds)]),
    blockedDrivers: draft.blockedDrivers,
    unpricedRoles: draft.roles.filter((role) => role.cost === null),
    unmixedTypes: draft.unmixedTypes,
  };
}

function copyNotes(notes: readonly EstimateNote[]): EstimateNote[] {
  return notes.map((note) => ({ ...note, refs: [...note.refs] }));
}

function byPhase(a: WorkstreamDraft, b: WorkstreamDraft): number {
  return comparePhaseIds(a.phaseId, b.phaseId);
}

/** Pure, deterministic: identical input always yields an identical result (rules CR_01 to CR_15). */
export function calculateEstimate(input: CalculationInput): EstimateResult {
  const context = createEngineContext(input);
  const { estimationConfig, lookups } = context;
  const buildDrafts = input.suggestion.workstreams.map((workstream) => buildWorkstreamDraft(workstream, context));
  const overheadDrafts = buildOverheadDrafts(buildDrafts, context);
  const drafts = [...buildDrafts, ...overheadDrafts].sort(byPhase);
  const missingInputs = detectMissingInputs({ scope: input.scope, config: input.config, workstreams: drafts.map(toFacts) });
  const confidence = assessConfidence({ buildDrafts, overheadDrafts, scope: input.scope, missingInputs });
  const workstreams = drafts.map((draft) =>
    finaliseWorkstream(
      draft,
      confidence.byWorkstream.get(draft.id) ?? { confidence: confidence.overall, limitations: [] },
      estimationConfig,
      lookups,
    ),
  );
  const timeline = buildTimeline({
    workstreams,
    overheadPhaseIds: new Set(overheadDrafts.map((draft) => draft.phaseId)),
    config: estimationConfig,
    confidence: confidence.timeline.confidence,
    spread: lookups.spread(confidence.timeline.confidence),
  });
  const assumptions = copyNotes(input.suggestion.assumptions);
  const result: Omit<EstimateResult, 'explanation'> = {
    workstreams,
    phases: timeline.phases,
    totals: estimateTotals(
      workstreams,
      timeline.timelineWeeks,
      estimationConfig,
      missingInputs.some((missing) => missing.effect === 'calculation-blocked'),
    ),
    roleSummary: summariseRoles(workstreams, lookups),
    confidence: confidence.overall,
    missingInputs,
    risks: copyNotes(input.suggestion.risks),
    dependencies: copyNotes(input.suggestion.dependencies),
    assumptions: [...assumptions, ...commercialAssumptions(estimationConfig, assumptions)],
    exclusions: copyNotes(input.suggestion.exclusions),
    rules: [...CALCULATION_RULES],
    deadlineAssessment: assessDeadline({
      deadlineWeeks: input.config.deliveryDeadlineWeeks,
      timelineWeeks: timeline.timelineWeeks,
      loads: timeline.loads,
      config: estimationConfig,
      relatedScopeIds: missingInputs.filter((missing) => missing.key === DEADLINE_KEY).flatMap((m) => m.relatedScopeIds),
    }),
    configSnapshot: snapshotConfig(estimationConfig),
    computedAt: input.computedAt,
  };
  return { ...result, explanation: explainResult(result, input.suggestion.explanation) };
}
