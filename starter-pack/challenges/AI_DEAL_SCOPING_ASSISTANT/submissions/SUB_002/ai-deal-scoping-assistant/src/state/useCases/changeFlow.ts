/**
 * Change-impact flow (spec section 6 "Change-Impact Handling"): an edit is expressed as a pure
 * `SessionMutation`, diffed into readable changes, analysed by the rule-based impact engine and -
 * when applied - logged, with only the affected stages marked stale. Reviewed, unaffected content
 * is never replaced: untouched stages are carried over by reference.
 */
import { resolveRunOptions } from '../../ai';
import type { AiSettings } from '../../ai';
import type { ImpactReport, ScopingSession } from '../../domain';
import { applyImpactReport, createImpactReport, describeChanges, summarizePendingActions } from '../../impact';
import { isScopeApproved } from '../../scope';
import { selectHasOutputs } from '../selectors';
import type { ChangePreview, SessionMutation, UseCaseDeps } from '../types';
import { recalculateEstimateIfPure } from './estimateRecalc';
import { notify, requireActiveSession, runBusy, runGuarded, saveSession } from './support';

const CHANGE_BUSY_LABEL = 'Analyzing the change impact...';

/** Returned when there is nothing to analyse (no active session) or the analysis failed. */
function emptyPreview(): ChangePreview {
  return { changes: [], reports: [] };
}

/** One report per change, created in sequence so a live provider is never hit with a burst of calls. */
async function analyseChange(before: ScopingSession, after: ScopingSession, aiSettings: AiSettings, createdAt: string): Promise<ChangePreview> {
  const changes = describeChanges(before, after);
  const run = resolveRunOptions(aiSettings, after.scope?.version ?? 0);
  const reports: ImpactReport[] = [];
  for (const change of changes) {
    reports.push(await createImpactReport(after, change, run, createdAt));
  }
  return { changes, reports };
}

interface AppliedChange {
  session: ScopingSession;
  preview: ChangePreview;
  estimateRecalculated: boolean;
}

/** Logs every report, marks the affected stages stale, then applies the pure-recalculation shortcut. */
function applyReports(after: ScopingSession, preview: ChangePreview, now: string): AppliedChange {
  const logged = preview.reports.reduce(applyImpactReport, after);
  const session = recalculateEstimateIfPure(logged, now);
  return { session, preview, estimateRecalculated: session !== logged };
}

function joinLabels(labels: readonly string[]): string {
  const last = labels.at(-1) ?? '';
  return labels.length <= 1 ? last : `${labels.slice(0, -1).join(', ')} and ${last}`;
}

function describeWhatChanged(preview: ChangePreview): string {
  const first = preview.changes.at(0);
  return preview.changes.length === 1 && first !== undefined ? `${first.label}.` : `${preview.changes.length} changes were analyzed.`;
}

function describeStaleStages(applied: AppliedChange): string {
  const stale = summarizePendingActions(applied.session).map((pending) => pending.label);
  if (stale.length > 0) {
    return `Marked stale: ${joinLabels(stale)}. Unaffected deliverables were left as reviewed.`;
  }
  return applied.estimateRecalculated ? 'No deliverable needs regenerating.' : 'No generated deliverable is affected.';
}

/** Says what changed, what was recalculated, what is stale and whether the scope needs re-approval. */
function notifyAppliedChange(deps: UseCaseDeps, before: ScopingSession, applied: AppliedChange): void {
  const needsApproval = isScopeApproved(before.scope) && !isScopeApproved(applied.session.scope);
  const sentences = [
    describeWhatChanged(applied.preview),
    applied.estimateRecalculated ? 'Effort, timeline and ROM were recalculated immediately by the calculation engine (no AI call).' : '',
    describeStaleStages(applied),
    needsApproval ? 'The scope changed after approval - approve the requirements again before regenerating.' : '',
  ].filter((sentence) => sentence !== '');
  const needsAction = needsApproval || summarizePendingActions(applied.session).length > 0;
  notify(deps, needsAction ? 'warning' : 'info', needsApproval ? 'Change saved - re-approval needed' : 'Change impact analyzed', sentences.join(' '));
}

/** Analyses a hypothetical edit to the active session. Nothing is saved and no notice is raised. */
export async function previewChange(deps: UseCaseDeps, mutate: SessionMutation): Promise<ChangePreview> {
  const before = requireActiveSession(deps);
  if (before === null) {
    return emptyPreview();
  }
  const { aiSettings } = deps.getState();
  return runBusy(deps, { label: CHANGE_BUSY_LABEL, stageId: null, errorTitle: 'Change impact could not be analyzed', fallback: emptyPreview() }, () =>
    analyseChange(before, mutate(before), aiSettings, deps.now()),
  );
}

async function runApply(deps: UseCaseDeps, before: ScopingSession, mutate: SessionMutation, errorTitle: string): Promise<ChangePreview> {
  const { aiSettings } = deps.getState();
  return runBusy(deps, { label: CHANGE_BUSY_LABEL, stageId: null, errorTitle, fallback: emptyPreview() }, async () => {
    const after = mutate(before);
    const now = deps.now();
    const preview = await analyseChange(before, after, aiSettings, now);
    if (preview.changes.length === 0) {
      saveSession(deps, after);
      return preview;
    }
    const applied = applyReports(after, preview, now);
    saveSession(deps, applied.session);
    notifyAppliedChange(deps, before, applied);
    return preview;
  });
}

/**
 * Saves the edit, logs one impact report per change and marks only the affected stages stale. When
 * the estimate is the only thing to refresh and it needs no AI (see `estimateRecalc.ts`), it is
 * recalculated at once. An edit that changes nothing describable is simply saved.
 */
export async function applyChange(deps: UseCaseDeps, mutate: SessionMutation): Promise<ChangePreview> {
  const before = requireActiveSession(deps);
  return before === null ? emptyPreview() : runApply(deps, before, mutate, 'Change could not be applied');
}

/**
 * The rule every scope and configuration edit follows: before any deliverable exists the edit is a
 * plain save (there is nothing to invalidate); afterwards it runs through the change flow, so its
 * impact is analysed and logged instead of silently replacing content.
 */
export async function commitEdit(deps: UseCaseDeps, errorTitle: string, mutate: SessionMutation): Promise<void> {
  const session = requireActiveSession(deps);
  if (session === null) {
    return;
  }
  if (selectHasOutputs(session)) {
    await runApply(deps, session, mutate, errorTitle);
    return;
  }
  runGuarded(deps, errorTitle, undefined, () => {
    saveSession(deps, mutate(session));
  });
}
