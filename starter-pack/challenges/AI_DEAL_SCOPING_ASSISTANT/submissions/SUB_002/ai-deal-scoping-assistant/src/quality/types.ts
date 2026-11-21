/** Internal building blocks of the quality gate. */
import type { CoverageReport, QualityCheckId, QualityFinding, ScopeModel, ScopingSession } from '../domain';

/** Everything the checks read, computed once per run. */
export interface QualityContext {
  session: ScopingSession;
  scope: ScopeModel | null;
  coverage: CoverageReport;
  /** Ids generated content may legitimately cite (active, in-scope items). */
  knownIds: ReadonlySet<string>;
}

export interface GradedFinding extends QualityFinding {
  severity: 'warn' | 'fail';
  /**
   * A notice explains why a check could not be evaluated ('Not generated yet'). It sets the
   * check's status but is not counted as an issue, so the quality summary never reports phantom
   * uncovered requirements or questions for a package that has not been generated.
   */
  notice: boolean;
}

/** One quality check: spec-worded metadata plus a small pure function that lists its findings. */
export interface QualityCheckSpec {
  id: QualityCheckId;
  label: string;
  description: string;
  run(context: QualityContext): GradedFinding[];
}
