/**
 * Pure-recalculation path of the estimate stage (spec section 5: every number comes from the
 * deterministic engine). When a change only affects calculated values - rate card, contingency,
 * currency, productivity, a driver's complexity - the engine re-runs at once with no AI call; the
 * AI-suggested workstreams and drivers, and the generation meta that describes them, are kept.
 */
import type { ScopingSession } from '../../domain';
import { recalculate } from '../../estimation';
import { markSectionsResolved, summarizePendingActions } from '../../impact';
import { sectionsOf } from './stageRunner';

/** True when the estimate is stale and every pending entry for it is a deterministic recalculation. */
export function estimateNeedsOnlyRecalculation(session: ScopingSession): boolean {
  if (session.outputs.estimate.status !== 'stale') {
    return false;
  }
  const pendingForEstimate = summarizePendingActions(session).filter((pending) => pending.stageId === 'estimate');
  return pendingForEstimate.length > 0 && pendingForEstimate.every((pending) => pending.action === 'recalculate');
}

/**
 * Re-runs the calculation engine on the existing estimate inputs. The stage becomes 'current' but
 * unreviewed (its numbers changed), and its sections are marked resolved on the change log - the
 * impact reports themselves stay, so the reviewer still sees what each change affected.
 */
export function recalculateEstimateStage(session: ScopingSession, computedAt: string): ScopingSession {
  const { estimate } = session.outputs;
  if (estimate.data === null || session.scope === null) {
    return session;
  }
  const data = recalculate(estimate.data, session.scope, session.config, session.estimationConfig, estimate.data.overrides, computedAt);
  const recalculated: ScopingSession = {
    ...session,
    outputs: { ...session.outputs, estimate: { ...estimate, data, status: 'current', reviewed: false, staleReasons: [] } },
    quality: null,
    executiveSummary: '',
  };
  return markSectionsResolved(recalculated, sectionsOf('estimate'));
}

/** Applies the shortcut when it is safe; otherwise returns the session untouched (by reference). */
export function recalculateEstimateIfPure(session: ScopingSession, computedAt: string): ScopingSession {
  return estimateNeedsOnlyRecalculation(session) ? recalculateEstimateStage(session, computedAt) : session;
}
