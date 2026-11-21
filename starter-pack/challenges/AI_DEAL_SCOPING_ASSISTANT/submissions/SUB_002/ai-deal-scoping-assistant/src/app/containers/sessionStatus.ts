/** A short, human status label for one saved session, shown in the Sessions dialog's table. */
import type { ScopingSession } from '../../domain';
import { isScopeApproved } from '../../scope';

/** Keys of `SessionOutputs` (prd, architecture, dataIntegration, aiStrategy, estimate). */
const GENERATION_STAGE_COUNT = 5;

function countGeneratedStages(session: ScopingSession): number {
  return Object.values(session.outputs).filter((section) => section.data !== null).length;
}

export function describeSessionStatus(session: ScopingSession): string {
  if (session.scope === null) {
    return 'Requirements not analyzed';
  }
  if (!isScopeApproved(session.scope)) {
    return 'Scope in review';
  }
  const generated = countGeneratedStages(session);
  if (generated === 0) {
    return 'Scope approved';
  }
  if (generated < GENERATION_STAGE_COUNT) {
    return `${generated} of ${GENERATION_STAGE_COUNT} deliverables generated`;
  }
  return 'All deliverables generated';
}
