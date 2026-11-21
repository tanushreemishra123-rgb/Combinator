/**
 * Whether the last quality-gate run (if any) still reflects the session: the scope model must not
 * have moved on since, and no section may have been (re)generated after the run - both would leave
 * the report describing a package that no longer matches what is about to be exported.
 */
import type { ScopingSession, SectionState } from '../../domain';

function sectionStates(session: ScopingSession): SectionState<unknown>[] {
  return [session.outputs.prd, session.outputs.architecture, session.outputs.dataIntegration, session.outputs.aiStrategy, session.outputs.estimate];
}

export function isQualityReportOutdated(session: ScopingSession): boolean {
  const { quality } = session;
  if (quality === null) {
    return false;
  }
  if (quality.scopeVersion !== (session.scope?.version ?? 0)) {
    return true;
  }
  return sectionStates(session).some((state) => state.meta !== null && state.meta.generatedAt > quality.ranAt);
}
