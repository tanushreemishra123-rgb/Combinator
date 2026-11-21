/**
 * Pure read-only views over a `ScopingSession` for the UI: stage readiness, pending refresh
 * actions, coverage, the live input preview and the integrated package. Nothing here touches
 * React or storage, so components can wrap any of these in `useMemo`. The twelve-step journey
 * lives in `journey.ts` and is re-exported from here.
 */
import { describeAiMode } from '../ai';
import type { AiSettings } from '../ai';
import { STAGES } from '../domain';
import type { CoverageReport, NormalizedDocument, PackageDocument, ScopingSession, SectionState, SectionStatus, ValidationIssue } from '../domain';
import { buildPackage } from '../export';
import { stageState, summarizePendingActions } from '../impact';
import type { PendingAction } from '../impact';
import { normalizeRequirements, validateRequirementsText } from '../ingestion';
import { buildCoverageReport } from '../traceability';
import { stagePrerequisite } from './stageRules';
import type { StageId } from './types';

export { selectJourney } from './journey';
export { APPROVAL_PREREQUISITE, stagePrerequisite } from './stageRules';
export type { JourneyStep, JourneyWorkspaceId } from './journey';

export interface StageStatusView {
  stageId: StageId;
  label: string;
  status: SectionStatus;
  reviewed: boolean;
  staleReasons: string[];
  /** Why the stage cannot be generated yet, or null when it can. */
  prerequisite: string | null;
}

export function selectStageStatuses(session: ScopingSession): StageStatusView[] {
  return STAGES.map((stage) => {
    const state = stageState(session.outputs, stage.id);
    return {
      stageId: stage.id,
      label: stage.label,
      status: state.status,
      reviewed: state.reviewed,
      staleReasons: [...state.staleReasons],
      prerequisite: stagePrerequisite(session, stage.id),
    };
  });
}

/** True once any deliverable has data - from then on edits go through the change flow. */
export function selectHasOutputs(session: ScopingSession): boolean {
  return STAGES.some((stage) => stageState(session.outputs, stage.id).data !== null);
}

export function selectCoverage(session: ScopingSession): CoverageReport {
  return buildCoverageReport(session);
}

/** Live normalised preview of the requirements text currently in the input box. */
export function selectNormalizedPreview(session: ScopingSession): NormalizedDocument {
  return normalizeRequirements(session.input.rawText);
}

export function selectInputIssues(session: ScopingSession): ValidationIssue[] {
  return validateRequirementsText(session.input.rawText);
}

/** Stale stages with the action (regenerate vs recalculate) and reasons from the change log. */
export function selectPendingActions(session: ScopingSession): PendingAction[] {
  return summarizePendingActions(session);
}

/** The integrated package for preview and export (AI mode label + timestamp stamped in). */
export function buildPackageForSession(session: ScopingSession, aiSettings: AiSettings, generatedAt: string): PackageDocument {
  return buildPackage(session, { aiModeLabel: describeAiMode(aiSettings), generatedAt });
}

function sectionStates(session: ScopingSession): SectionState<unknown>[] {
  return [session.outputs.prd, session.outputs.architecture, session.outputs.dataIntegration, session.outputs.aiStrategy, session.outputs.estimate];
}

/**
 * True when the last quality-gate run no longer reflects the session: the scope model has moved on
 * since, or a section was (re)generated after the run - either way the cached report describes a
 * package that no longer matches what would be exported now.
 */
export function selectIsQualityReportOutdated(session: ScopingSession): boolean {
  const { quality } = session;
  if (quality === null) {
    return false;
  }
  if (quality.scopeVersion !== (session.scope?.version ?? 0)) {
    return true;
  }
  return sectionStates(session).some((state) => state.meta !== null && state.meta.generatedAt > quality.ranAt);
}
