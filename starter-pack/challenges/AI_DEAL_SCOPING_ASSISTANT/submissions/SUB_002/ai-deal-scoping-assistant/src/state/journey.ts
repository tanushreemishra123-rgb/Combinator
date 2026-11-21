/**
 * The twelve-step Core User Journey in the spec's wording ("Understand the customer need" ...
 * "Prepare the scoping package"), each step with a status and a hint derived from the session.
 * Every step first reports a progress of 'done', 'attention' or 'open'; the first open step is the
 * one the reviewer should work on next ('active'), later open steps stay 'todo'.
 */
import type { ScopeModel, ScopingSession } from '../domain';
import { stageState } from '../impact';
import { getOpenGaps, getOpenQuestions, isScopeApproved } from '../scope';
import { stagePrerequisite } from './stageRules';
import type { StageId } from './types';

export type JourneyWorkspaceId = 'requirements' | 'prd' | 'architecture' | 'strategy' | 'estimate' | 'package';

/** One of the twelve journey steps in the spec's wording ("Understand the customer need", ...). */
export interface JourneyStep {
  id: string;
  label: string;
  hint: string;
  status: 'todo' | 'active' | 'done' | 'attention';
  workspaceId: JourneyWorkspaceId;
}

interface StepProgress {
  progress: 'done' | 'attention' | 'open';
  hint: string;
}

interface StepDefinition {
  id: string;
  label: string;
  workspaceId: JourneyWorkspaceId;
  /** Hint shown while no session exists yet. */
  idleHint: string;
  evaluate(session: ScopingSession): StepProgress;
}

const NEEDS_ANALYSIS_HINT = 'Available once the customer requirements have been analyzed.';

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function withScope(session: ScopingSession, evaluate: (scope: ScopeModel) => StepProgress): StepProgress {
  return session.scope === null ? { progress: 'open', hint: NEEDS_ANALYSIS_HINT } : evaluate(session.scope);
}

function understandStep(session: ScopingSession): StepProgress {
  if (session.scope !== null) {
    return { progress: 'done', hint: `${plural(session.scope.items.length, 'scope item', 'scope items')} extracted from the customer requirements.` };
  }
  const hasText = session.input.rawText.trim().length > 0;
  return { progress: 'open', hint: hasText ? 'Requirements captured - analyze them to extract the scope.' : 'Paste or upload the customer requirements to begin.' };
}

function reviewStep(scope: ScopeModel): StepProgress {
  const pending = scope.items.filter((item) => item.review === 'pending').length;
  const reviewed = scope.items.length - pending;
  const hint = `${reviewed} of ${plural(scope.items.length, 'scope item', 'scope items')} reviewed.`;
  return { progress: pending === 0 ? 'done' : 'open', hint };
}

function clarifyStep(scope: ScopeModel): StepProgress {
  const open = [...getOpenGaps(scope), ...getOpenQuestions(scope)];
  const critical = open.filter((item) => item.critical).length;
  if (critical > 0) {
    return { progress: 'attention', hint: `${plural(critical, 'critical gap or question is', 'critical gaps or questions are')} still open.` };
  }
  if (open.length > 0) {
    return { progress: 'done', hint: `No critical gaps; ${plural(open.length, 'open question or gap stays', 'open questions or gaps stay')} listed for the customer.` };
  }
  return { progress: 'done', hint: 'Every gap and clarification question is resolved.' };
}

function approveStep(scope: ScopeModel): StepProgress {
  if (isScopeApproved(scope)) {
    return { progress: 'done', hint: `Scope version ${scope.version} is approved.` };
  }
  if (scope.approvedVersion !== null) {
    return { progress: 'attention', hint: 'The scope changed after approval - approve it again.' };
  }
  return { progress: 'open', hint: 'Approve or reject every item, then approve the requirements.' };
}

/** A generation step follows its stage: current = done, stale = attention, otherwise the prerequisite. */
function stageStep(stageId: StageId): (session: ScopingSession) => StepProgress {
  return (session) => {
    const state = stageState(session.outputs, stageId);
    if (state.status === 'stale') {
      return { progress: 'attention', hint: state.staleReasons.at(0) ?? 'Out of date after a change - regenerate it.' };
    }
    if (state.status === 'current') {
      return { progress: 'done', hint: state.reviewed ? 'Generated and reviewed.' : 'Generated - review it before export.' };
    }
    return { progress: 'open', hint: stagePrerequisite(session, stageId) ?? 'Ready to generate.' };
  };
}

function staleStageCount(session: ScopingSession): number {
  const { outputs } = session;
  return [outputs.prd, outputs.architecture, outputs.dataIntegration, outputs.aiStrategy, outputs.estimate].filter((state) => state.status === 'stale').length;
}

function changeImpactStep(session: ScopingSession): StepProgress {
  const stale = staleStageCount(session);
  if (stale > 0) {
    return { progress: 'attention', hint: `${plural(stale, 'deliverable is', 'deliverables are')} stale - regenerate or recalculate the affected sections.` };
  }
  if (session.changeLog.length > 0) {
    return { progress: 'done', hint: `${plural(session.changeLog.length, 'change', 'changes')} analysed; every affected section is up to date.` };
  }
  return { progress: 'open', hint: 'Change a reviewed requirement, assumption or configuration to see its impact.' };
}

function coverageStep(session: ScopingSession): StepProgress {
  if (session.quality === null) {
    return { progress: 'open', hint: 'Run the quality gate to validate requirement coverage and consistency.' };
  }
  const { requirementCoveragePct, exportStatus } = session.quality.summary;
  const hint = `Requirement coverage ${Math.round(requirementCoveragePct)}% - export status ${exportStatus}.`;
  return { progress: exportStatus === 'Blocked' ? 'attention' : 'done', hint };
}

function packageStep(session: ScopingSession): StepProgress {
  const ready = session.quality !== null && session.quality.summary.exportStatus !== 'Blocked' && session.executiveSummary.trim().length > 0;
  return ready
    ? { progress: 'done', hint: 'Executive summary written and quality gate passed - export the package.' }
    : { progress: 'open', hint: 'Write the executive summary, run the quality gate and export the package.' };
}

const STEP_DEFINITIONS: readonly StepDefinition[] = [
  { id: 'understand', label: 'Understand the customer need', workspaceId: 'requirements', idleHint: 'Create a session or load a sample scenario to begin.', evaluate: understandStep },
  { id: 'review-scope', label: 'Review the extracted scope', workspaceId: 'requirements', idleHint: NEEDS_ANALYSIS_HINT, evaluate: (session) => withScope(session, reviewStep) },
  { id: 'clarify', label: 'Clarify missing information', workspaceId: 'requirements', idleHint: NEEDS_ANALYSIS_HINT, evaluate: (session) => withScope(session, clarifyStep) },
  { id: 'approve', label: 'Approve the requirements', workspaceId: 'requirements', idleHint: NEEDS_ANALYSIS_HINT, evaluate: (session) => withScope(session, approveStep) },
  { id: 'prd', label: 'Generate the PRD', workspaceId: 'prd', idleHint: 'Available after the requirements are approved.', evaluate: stageStep('prd') },
  { id: 'architecture', label: 'Design the solution', workspaceId: 'architecture', idleHint: 'Available after the PRD is generated.', evaluate: stageStep('architecture') },
  { id: 'data-flow', label: 'Plan the data flow', workspaceId: 'strategy', idleHint: 'Available after the solution is designed.', evaluate: stageStep('dataIntegration') },
  { id: 'ai-approach', label: 'Select the AI approach', workspaceId: 'strategy', idleHint: 'Available after the solution is designed.', evaluate: stageStep('aiStrategy') },
  { id: 'estimate', label: 'Estimate the delivery', workspaceId: 'estimate', idleHint: 'Available after the strategies are generated.', evaluate: stageStep('estimate') },
  { id: 'change-impact', label: 'Review change impact', workspaceId: 'package', idleHint: 'Available once deliverables exist.', evaluate: changeImpactStep },
  { id: 'coverage', label: 'Validate requirement coverage', workspaceId: 'package', idleHint: 'Available once deliverables exist.', evaluate: coverageStep },
  { id: 'package', label: 'Prepare the scoping package', workspaceId: 'package', idleHint: 'Available once deliverables exist.', evaluate: packageStep },
];

function idleProgress(definition: StepDefinition): StepProgress {
  return { progress: 'open', hint: definition.idleHint };
}

/** The twelve journey steps; a null session reads as nothing done with the first step active. */
export function selectJourney(session: ScopingSession | null): JourneyStep[] {
  const evaluated = STEP_DEFINITIONS.map((definition) => ({
    definition,
    result: session === null ? idleProgress(definition) : definition.evaluate(session),
  }));
  const firstOpenId = evaluated.find((entry) => entry.result.progress === 'open')?.definition.id;
  return evaluated.map(({ definition, result }) => {
    const openStatus = definition.id === firstOpenId ? 'active' : 'todo';
    return {
      id: definition.id,
      label: definition.label,
      hint: result.hint,
      status: result.progress === 'open' ? openStatus : result.progress,
      workspaceId: definition.workspaceId,
    };
  });
}
