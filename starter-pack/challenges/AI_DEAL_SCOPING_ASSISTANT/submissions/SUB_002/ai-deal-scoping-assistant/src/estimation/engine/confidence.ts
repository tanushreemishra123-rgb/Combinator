/**
 * Rules CR_06 and CR_07: confidence per workstream, for the whole estimate and for the timeline.
 * Every reduction is backed by a limitation sentence so the reviewer sees exactly why.
 */
import type { Confidence, MissingEstimationInput, ScopeModel } from '../../domain';
import { limitationFor, TIMELINE_COMPONENT } from '../missingInputs';
import { describeItem, distinct, relatedOpenItems, relatedOutstandingDependencies } from '../scopeFacts';
import type { ConfidenceAssessment, WorkstreamDraft } from './model';
import { sum } from './numbers';

/** Overall confidence drops to Low once this share of the build effort sits in Low-confidence workstreams. */
export const LOW_CONFIDENCE_EFFORT_SHARE = 0.3;

/** Overall confidence also drops to Low once this many distinct estimation inputs are missing. */
export const MISSING_INPUTS_FOR_LOW_CONFIDENCE = 4;

const CONFIDENCE_RANK: ReadonlyMap<Confidence, number> = new Map<Confidence, number>([
  ['High', 3],
  ['Medium', 2],
  ['Low', 1],
]);

export interface EstimateConfidence {
  byWorkstream: ReadonlyMap<string, ConfidenceAssessment>;
  overall: Confidence;
  timeline: ConfidenceAssessment;
}

export interface ConfidenceQuery {
  buildDrafts: readonly WorkstreamDraft[];
  overheadDrafts: readonly WorkstreamDraft[];
  scope: ScopeModel;
  missingInputs: readonly MissingEstimationInput[];
}

export function lowerOf(a: Confidence, b: Confidence): Confidence {
  return (CONFIDENCE_RANK.get(a) ?? 0) <= (CONFIDENCE_RANK.get(b) ?? 0) ? a : b;
}

function fromLimitations(low: readonly string[], medium: readonly string[]): ConfidenceAssessment {
  const limitations = distinct([...low, ...medium]);
  if (low.length > 0) {
    return { confidence: 'Low', limitations };
  }
  return { confidence: medium.length > 0 ? 'Medium' : 'High', limitations };
}

function componentLimitations(
  componentId: string,
  query: ConfidenceQuery,
): { low: string[]; medium: string[]; citedIds: string[] } {
  const relevant = query.missingInputs.filter((missing) => missing.affected.includes(componentId));
  const limitations = relevant.map((missing) => limitationFor(missing, query.scope));
  return {
    low: limitations.filter((entry) => entry.level === 'Low').map((entry) => entry.text),
    medium: limitations.filter((entry) => entry.level === 'Medium').map((entry) => entry.text),
    citedIds: relevant.flatMap((missing) => missing.relatedScopeIds),
  };
}

/** An outstanding delivery dependency adds no effort, but a delay would push out the dependent work. */
function dependencyLimitations(refIds: readonly string[], scope: ScopeModel): string[] {
  return relatedOutstandingDependencies(scope, refIds).map(
    (item) => `${describeItem(item)} is an outstanding delivery dependency of this workstream; the estimate assumes it is met on schedule, and a delay would push out the dependent work.`,
  );
}

/**
 * Start High; Medium for Very High drivers, related open items or outstanding delivery
 * dependencies; Low for critical gaps or blocked inputs.
 */
function assessBuildWorkstream(draft: WorkstreamDraft, query: ConfidenceQuery): ConfidenceAssessment {
  const fromInputs = componentLimitations(draft.id, query);
  const veryHigh = draft.drivers
    .filter((driver) => driver.complexity === 'Very High')
    .map((driver) => `${driver.label} (${driver.id}) is rated Very High complexity, which carries inherent delivery uncertainty.`);
  const refIds = [...draft.requirementIds, ...draft.drivers.flatMap((driver) => driver.refIds)];
  const openItems = relatedOpenItems(query.scope, refIds)
    .filter((item) => !fromInputs.citedIds.includes(item.id))
    .map((item) => `${describeItem(item)} is still open and relates to the requirements of this workstream.`);
  const dependencies = dependencyLimitations(refIds, query.scope);
  return fromLimitations(fromInputs.low, [...fromInputs.medium, ...veryHigh, ...openItems, ...dependencies]);
}

/**
 * CR_07: Low when any calculation is blocked, nothing can be estimated, Low-confidence workstreams
 * carry at least 30% of the build effort, or four or more distinct estimation inputs are missing;
 * Medium when any workstream is below High or any input is missing; otherwise High.
 */
function assessOverall(
  buildDrafts: readonly WorkstreamDraft[],
  byWorkstream: ReadonlyMap<string, ConfidenceAssessment>,
  missingInputs: readonly MissingEstimationInput[],
): Confidence {
  const buildDays = sum(buildDrafts.map((draft) => draft.likelyDays));
  const lowDays = sum(
    buildDrafts.filter((draft) => byWorkstream.get(draft.id)?.confidence === 'Low').map((draft) => draft.likelyDays),
  );
  const blocked = missingInputs.some((missing) => missing.effect === 'calculation-blocked');
  const manyInputsMissing = new Set(missingInputs.map((missing) => missing.key)).size >= MISSING_INPUTS_FOR_LOW_CONFIDENCE;
  if (blocked || manyInputsMissing || buildDays <= 0 || lowDays / buildDays >= LOW_CONFIDENCE_EFFORT_SHARE) {
    return 'Low';
  }
  const allHigh = buildDrafts.every((draft) => byWorkstream.get(draft.id)?.confidence === 'High');
  return allHigh && missingInputs.length === 0 ? 'High' : 'Medium';
}

/** Overhead phases are a percentage of build effort, so they inherit the overall confidence. */
function assessOverhead(draft: WorkstreamDraft, overall: Confidence, query: ConfidenceQuery): ConfidenceAssessment {
  const own = componentLimitations(draft.id, query);
  const inherited =
    overall === 'High'
      ? []
      : [`Sized as a percentage of build effort, so it inherits the ${overall} overall confidence of the build workstreams.`];
  const assessment = fromLimitations(own.low, [...own.medium, ...inherited]);
  return { ...assessment, confidence: lowerOf(assessment.confidence, overall) };
}

function assessTimeline(overall: Confidence, query: ConfidenceQuery): ConfidenceAssessment {
  const own = componentLimitations(TIMELINE_COMPONENT, query);
  const assessment = fromLimitations(own.low, own.medium);
  return { ...assessment, confidence: lowerOf(assessment.confidence, overall) };
}

export function assessConfidence(query: ConfidenceQuery): EstimateConfidence {
  const byWorkstream = new Map<string, ConfidenceAssessment>(
    query.buildDrafts.map((draft) => [draft.id, assessBuildWorkstream(draft, query)]),
  );
  const overall = assessOverall(query.buildDrafts, byWorkstream, query.missingInputs);
  for (const draft of query.overheadDrafts) {
    byWorkstream.set(draft.id, assessOverhead(draft, overall, query));
  }
  return { byWorkstream, overall, timeline: assessTimeline(overall, query) };
}
