/**
 * Illustrative historical delivery references (sample data, not actual Topcoder records). They are
 * shown next to the estimate as context only: calculateEstimate never imports this module, so they
 * cannot replace the scope-based logic (CR_15).
 */
import type { HistoricalProjectReference } from '../domain';
import { HISTORICAL_PROJECTS } from '../seed';

/** Contextual only - never an input to calculateEstimate. */
export function getHistoricalReferences(): readonly HistoricalProjectReference[] {
  return HISTORICAL_PROJECTS;
}
