import { knownIds } from '../scope';
import { buildCoverageReport } from '../traceability';
import type { QualityReport, ScopingSession } from '../domain';
import { gradeCheck } from './checkKit';
import { QUALITY_CHECKS } from './checks';
import { summarizeQuality } from './summary';
import type { QualityContext } from './types';

function buildContext(session: ScopingSession): QualityContext {
  return {
    session,
    scope: session.scope,
    coverage: buildCoverageReport(session),
    knownIds: session.scope === null ? new Set<string>() : knownIds(session.scope),
  };
}

/** Pure and deterministic. ranAt is injected so results are reproducible in tests. */
export function runQualityGate(session: ScopingSession, ranAt: string): QualityReport {
  const context = buildContext(session);
  const checks = QUALITY_CHECKS.map((spec) => gradeCheck(spec, context));
  return { checks, summary: summarizeQuality(session, context.coverage, checks), ranAt, scopeVersion: session.scope?.version ?? 0 };
}
