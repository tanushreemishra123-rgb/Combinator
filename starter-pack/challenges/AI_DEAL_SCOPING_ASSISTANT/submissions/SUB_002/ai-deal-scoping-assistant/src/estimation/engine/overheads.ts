/**
 * Rule CR_05: Discovery and Architecture, Testing and Hardening, and Deployment and Handover are
 * sized as a configurable percentage of the total adjusted build effort. Each becomes its own
 * workstream so it carries roles, cost, confidence and a calculation trace like any other.
 */
import type { PhaseOverhead } from '../../domain';
import { formatPct, formatWhole } from '../format';
import { phaseName } from '../phases';
import { weightedComplexity } from './drivers';
import type { EngineContext, WorkstreamDraft } from './model';
import { pctOf, roundWhole, sum } from './numbers';
import { allocateRoles } from './roles';

const OVERHEAD_SKILLS: ReadonlyMap<string, readonly string[]> = new Map([
  ['PH_1', ['Solution architecture', 'Business analysis and backlog definition', 'Engagement and delivery planning']],
  ['PH_5', ['Test management and automation', 'Performance and security testing', 'User acceptance test support']],
  ['PH_6', ['Release management and cutover planning', 'Cloud operations handover', 'Knowledge transfer and documentation']],
]);

const DEFAULT_OVERHEAD_SKILLS: readonly string[] = ['Delivery management', 'Solution architecture', 'Quality assurance'];

export function overheadWorkstreamId(phaseId: string): string {
  return `WS_${phaseId}`;
}

function buildOverheadDraft(
  overhead: PhaseOverhead,
  buildDays: number,
  complexity: WorkstreamDraft['complexity'],
  context: EngineContext,
): WorkstreamDraft {
  const name = phaseName(overhead.phaseId, overhead.label);
  const pct = Number.isFinite(overhead.pctOfBuild) && overhead.pctOfBuild > 0 ? overhead.pctOfBuild : 0;
  const likelyDays = roundWhole(pctOf(buildDays, pct));
  const allocation = allocateRoles(likelyDays, [{ key: 'overhead', days: likelyDays }], context.lookups);
  return {
    id: overheadWorkstreamId(overhead.phaseId),
    name,
    phaseId: overhead.phaseId,
    kind: 'overhead',
    requirementIds: [],
    skills: [...(OVERHEAD_SKILLS.get(overhead.phaseId) ?? DEFAULT_OVERHEAD_SKILLS)],
    drivers: [],
    blockedDrivers: [],
    complexity,
    baseDays: likelyDays,
    adjustments: [
      {
        label: 'Percentage of build effort',
        factor: pct / 100,
        reason: `${name} is sized at ${formatPct(pct)} of the total adjusted build effort of ${formatWhole(buildDays)} days.`,
      },
    ],
    likelyDays,
    roles: allocation.roles,
    unmixedTypes: allocation.unmixedTypes,
    trace: [
      `${name} = ${formatPct(pct)} of ${formatWhole(buildDays)} build days = ${formatWhole(likelyDays)} days (likely effort, rounded to whole days)`,
    ],
  };
}

/** One overhead workstream per configured phase overhead; build phases can never be overridden. */
export function buildOverheadDrafts(buildDrafts: readonly WorkstreamDraft[], context: EngineContext): WorkstreamDraft[] {
  const buildDays = sum(buildDrafts.map((draft) => draft.likelyDays));
  const complexity = weightedComplexity(
    buildDrafts.map((draft) => ({ complexity: draft.complexity, weight: draft.likelyDays })),
  );
  const buildPhaseIds = new Set(buildDrafts.map((draft) => draft.phaseId));
  const seen = new Set<string>();
  return context.estimationConfig.phaseOverheads
    .filter((overhead) => {
      const usable = !buildPhaseIds.has(overhead.phaseId) && !seen.has(overhead.phaseId);
      seen.add(overhead.phaseId);
      return usable;
    })
    .map((overhead) => buildOverheadDraft(overhead, buildDays, complexity, context));
}
