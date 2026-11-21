/**
 * Applies an impact report to the session (spec: "regenerate or recalculate the affected sections
 * without silently replacing reviewed and unaffected content"). Only stages that own an affected
 * section become stale; every other stage object is returned by reference, untouched.
 */
import { STAGES } from '../domain';
import type { ImpactEntry, ImpactReport, OutputSectionId, ScopingSession, SectionState, SessionOutputs, StageDescriptor } from '../domain';
import { unique } from './format';
import { stageState } from './sectionElements';
import type { PendingAction } from './types';

function stageOf(stageId: keyof SessionOutputs): StageDescriptor | undefined {
  return STAGES.find((stage) => stage.id === stageId);
}

function entriesForStage(report: ImpactReport, stageId: keyof SessionOutputs): ImpactEntry[] {
  const sections = stageOf(stageId)?.sections ?? [];
  return report.affected.filter((entry) => sections.includes(entry.section));
}

/** One readable reason per affected area: 'Expected users increased ... - Database sizing'. */
function staleReasonsFor(report: ImpactReport, stageId: keyof SessionOutputs): string[] {
  return entriesForStage(report, stageId).map((entry) => `${report.change.label} - affects ${entry.area}`);
}

/**
 * Marks a generated section stale. The `reviewed` flag and the data are deliberately kept: the
 * reviewer still sees the approved content until they regenerate this specific section.
 */
function markStale<T>(state: SectionState<T>, reasons: readonly string[]): SectionState<T> {
  if (reasons.length === 0 || state.data === null) {
    return state;
  }
  return { ...state, status: 'stale', staleReasons: unique([...state.staleReasons, ...reasons]) };
}

/** Marks only the affected sections stale (with reasons) and appends the report to the change log. */
export function applyImpactReport(session: ScopingSession, report: ImpactReport): ScopingSession {
  const { outputs } = session;
  const alreadyLogged = session.changeLog.some((entry) => entry.id === report.id);
  return {
    ...session,
    outputs: {
      prd: markStale(outputs.prd, staleReasonsFor(report, 'prd')),
      architecture: markStale(outputs.architecture, staleReasonsFor(report, 'architecture')),
      dataIntegration: markStale(outputs.dataIntegration, staleReasonsFor(report, 'dataIntegration')),
      aiStrategy: markStale(outputs.aiStrategy, staleReasonsFor(report, 'aiStrategy')),
      estimate: markStale(outputs.estimate, staleReasonsFor(report, 'estimate')),
    },
    changeLog: alreadyLogged ? session.changeLog : [...session.changeLog, report],
    // The quality gate describes the package before the change and must be re-run.
    quality: null,
  };
}

function resolveInReport(report: ImpactReport, sections: readonly OutputSectionId[]): ImpactReport {
  const pending = sections.filter((section) => report.affected.some((entry) => entry.section === section) && !report.resolvedSections.includes(section));
  return pending.length === 0 ? report : { ...report, resolvedSections: [...report.resolvedSections, ...unique(pending)] };
}

/**
 * Records that sections were brought up to date (after a stage was regenerated or recalculated).
 * A refreshed section reflects every earlier change, so each report that lists it is updated.
 */
export function markSectionsResolved(session: ScopingSession, sections: readonly OutputSectionId[]): ScopingSession {
  const changeLog = session.changeLog.map((report) => resolveInReport(report, sections));
  const unchanged = changeLog.every((report, index) => report === session.changeLog.at(index));
  return unchanged ? session : { ...session, changeLog };
}

function pendingEntries(session: ScopingSession, stageId: keyof SessionOutputs): ImpactEntry[] {
  return session.changeLog.flatMap((report) => entriesForStage(report, stageId).filter((entry) => !report.resolvedSections.includes(entry.section)));
}

/**
 * What the reviewer still has to refresh: one action per stale stage. 'recalculate' (engine only)
 * is offered when every pending entry is deterministic; any AI-derived area requires 'regenerate'.
 */
export function summarizePendingActions(session: ScopingSession): PendingAction[] {
  return STAGES.filter((stage) => stageState(session.outputs, stage.id).status === 'stale').map((stage) => {
    const entries = pendingEntries(session, stage.id);
    const state = stageState(session.outputs, stage.id);
    const recalculateOnly = entries.length > 0 && entries.every((entry) => entry.action === 'recalculate');
    return {
      stageId: stage.id,
      label: stage.label,
      action: recalculateOnly ? 'recalculate' : 'regenerate',
      sections: entries.length === 0 ? [...stage.sections] : unique(entries.map((entry) => entry.section)),
      reasons: state.staleReasons.length > 0 ? [...state.staleReasons] : unique(entries.map((entry) => entry.reason)),
    };
  });
}
