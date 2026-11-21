/**
 * Requirement analysis use case (spec section 1): validates and normalises the requirements text,
 * runs the analysis stage (mock or live) and stores the reviewable scope model. A new analysis
 * produces new scope-item ids, so every downstream deliverable, the change log, the quality report
 * and the executive summary are reset rather than left pointing at items that no longer exist.
 */
import { resolveRunOptions } from '../../ai';
import { analyzeRequirements } from '../../analysis';
import { emptyOutputs } from '../../domain';
import type { GenerationMeta, NormalizedDocument, ScopeModel, ScopingSession, ValidationIssue } from '../../domain';
import { normalizeRequirements, validateRequirementsText } from '../../ingestion';
import { getOpenGaps, getOpenQuestions, getRequirements } from '../../scope';
import { getRecordedAnalysis, getScenario } from '../../seed';
import type { UseCaseDeps } from '../types';
import { notify, notifyFallback, requireActiveSession, runBusy, saveSession } from './support';

/** Issue code of the note that records which path produced the scope model. */
export const ANALYSIS_PATH_ISSUE_CODE = 'analysis.generated-by';

/** Mirrors the mock provider's rule: the recorded response is used only for a seed scenario's unedited text. */
function usesRecordedResponse(session: ScopingSession, document: NormalizedDocument): boolean {
  const { scenarioId } = session.input;
  const scenario = scenarioId === null ? undefined : getScenario(scenarioId);
  if (scenario === undefined) {
    return false;
  }
  const unedited = normalizeRequirements(scenario.requirementsText).text === document.text;
  return unedited && getRecordedAnalysis(scenario.id, scenario.requirementsText) !== undefined;
}

/** Mock mode always says whether the seeded response or the heuristic engine analysed the text. */
function describeAnalysisPath(meta: GenerationMeta, recorded: boolean): string {
  if (meta.mode === 'live') {
    return `Analyzed by ${meta.providerLabel}.`;
  }
  const path = recorded ? 'the recorded response for this seeded scenario' : 'the deterministic heuristic analysis engine for custom text';
  return `Analyzed by ${meta.providerLabel} using ${path}.`;
}

function pathIssue(message: string): ValidationIssue {
  return { severity: 'info', code: ANALYSIS_PATH_ISSUE_CODE, message, refs: [] };
}

function countsSentence(scope: ScopeModel): string {
  return `Extracted ${getRequirements(scope).length} requirements, ${getOpenQuestions(scope).length} clarification questions and ${getOpenGaps(scope).length} gaps.`;
}

/** Analyses the active session's requirements text and replaces the scope model and every output. */
export async function runAnalysis(deps: UseCaseDeps): Promise<void> {
  const session = requireActiveSession(deps);
  if (session === null) {
    return;
  }
  const inputIssues = validateRequirementsText(session.input.rawText);
  if (inputIssues.length > 0) {
    notify(deps, 'error', 'Requirements cannot be analyzed yet', inputIssues.map((issue) => issue.message).join(' '));
    return;
  }
  const { aiSettings } = deps.getState();
  await runBusy(deps, { label: 'Analyzing the customer requirements...', stageId: 'analysis', errorTitle: 'Analysis failed', fallback: undefined }, async () => {
    const document = normalizeRequirements(session.input.rawText);
    const input = { document, customer: session.customer, scenarioId: session.input.scenarioId };
    const { scope, meta } = await analyzeRequirements(input, resolveRunOptions(aiSettings, 0));
    const path = describeAnalysisPath(meta, usesRecordedResponse(session, document));
    saveSession(deps, {
      ...session,
      input: { ...session.input, normalized: document },
      scope: { ...scope, issues: [pathIssue(path), ...scope.issues] },
      outputs: emptyOutputs(),
      changeLog: [],
      quality: null,
      executiveSummary: '',
    });
    notify(deps, 'success', 'Requirements analyzed', `${countsSentence(scope)} ${path}`);
    notifyFallback(deps, 'Requirement analysis', meta);
  });
}
