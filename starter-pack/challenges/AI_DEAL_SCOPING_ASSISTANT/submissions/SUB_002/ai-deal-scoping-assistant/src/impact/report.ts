/** Assembles an `ImpactReport`: rule-based analysis first, plain-language explanation second. */
import { runTextTask } from '../ai';
import type { ImpactContext, TaskRunOptions } from '../ai/types';
import { newUid } from '../domain';
import type { ChangeDescriptor, ImpactReport, ScopingSession } from '../domain';
import { analyzeImpact } from './analyzeImpact';
import { IMPACT_EXPLANATION_TASK, planImpactExplanation } from './explanation';

/** Appended when no provider could explain the change, so the fallback is never silent. */
export const RULE_BASED_EXPLANATION_NOTE = '(Explanation written by the built-in rule-based summary because the AI provider did not return one.)';

/**
 * The provider only words the explanation. If it fails or returns nothing, the deterministic
 * explanation is used and labelled - the affected list never depends on the AI call.
 */
async function explain(context: ImpactContext, run: TaskRunOptions): Promise<string> {
  try {
    const result = await runTextTask(IMPACT_EXPLANATION_TASK, context, run);
    const text = result.value.trim();
    if (text !== '') {
      return text;
    }
  } catch (error) {
    console.warn('Change-impact explanation failed; using the rule-based summary.', error instanceof Error ? error.name : 'unknown error');
  }
  return `${planImpactExplanation(context)} ${RULE_BASED_EXPLANATION_NOTE}`;
}

/** analyzeImpact + AI (or mock) plain-language explanation. `createdAt` is injectable for reproducible tests. */
export async function createImpactReport(
  session: ScopingSession,
  change: ChangeDescriptor,
  run: TaskRunOptions,
  createdAt: string = new Date().toISOString(),
): Promise<ImpactReport> {
  const { affected, unaffected } = analyzeImpact(session, change);
  const context: ImpactContext = { task: 'explain-change-impact', change, affected, unaffected };
  const explanation = await explain(context, run);
  return { id: newUid(), change, affected, unaffected, explanation, createdAt, resolvedSections: [] };
}
