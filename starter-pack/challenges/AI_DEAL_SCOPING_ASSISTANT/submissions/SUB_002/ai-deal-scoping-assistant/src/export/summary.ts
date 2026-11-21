/**
 * Executive summary: a deterministic two-paragraph fallback (`planExecutiveSummary`), the free-text
 * 'summarize-package' AI task definition, and the stage entry (`generateExecutiveSummary`) the
 * session layer calls. The mock AI provider (src/ai/providers/mockProvider.ts) calls
 * `planExecutiveSummary` directly for this task, so mock mode and a failed live call always produce
 * the same grounded, deterministic text (see src/impact/explanation.ts for the same pattern).
 */
import { runTextTask } from '../ai';
import { buildSystemPrompt, describeCustomerForPrompt, describeScopeForPrompt } from '../ai/promptKit';
import type { PromptParts, SummaryContext, TaskRunOptions } from '../ai/types';
import type { GenerationMeta, ScopeItemKind, ScopeModel, ScopingSession } from '../domain';
import { countOf } from '../estimation/format';
import { getInScopeItemsByKind, getOpenQuestions } from '../scope';
import { buildCoverageReport } from '../traceability';
import { formatWhole, moneyRangeOrBlocked, platformDisplayName } from './text';

function countOfKind(scope: ScopeModel, kind: ScopeItemKind): number {
  return getInScopeItemsByKind(scope, kind).length;
}

/** Facts the summary (and the live prompt) may cite verbatim - never recomputed or guessed by the AI. */
function buildSummaryFacts(session: ScopingSession): { label: string; value: string }[] {
  const result = session.outputs.estimate.data?.result ?? null;
  const coverage = session.scope === null ? null : buildCoverageReport(session);
  const openQuestions = session.scope === null ? 0 : getOpenQuestions(session.scope).length;
  return [
    { label: 'Cloud platform', value: platformDisplayName(session.config.cloudPlatform) },
    { label: 'Requirement coverage', value: coverage === null ? 'Not yet assessed' : `${coverage.coveragePct}%` },
    {
      label: 'Effort estimate',
      value: result === null ? 'Not yet estimated' : `${formatWhole(result.totals.effortDays.low)} to ${formatWhole(result.totals.effortDays.high)} person-days (likely ${formatWhole(result.totals.effortDays.likely)})`,
    },
    { label: 'Timeline', value: result === null ? 'Not yet estimated' : weeksSummary(result.totals.timelineWeeks.low, result.totals.timelineWeeks.high) },
    { label: 'ROM commercial range', value: result === null ? 'Not yet estimated' : moneyRangeOrBlocked(result.totals.rom, 'Blocked - one or more role day rates are missing') },
    { label: 'Estimate confidence', value: result === null ? 'Not yet estimated' : result.confidence },
    { label: 'Open questions', value: `${openQuestions}` },
  ];
}

function weeksSummary(low: number, high: number): string {
  return `${formatWhole(low)} to ${formatWhole(high)} weeks`;
}

/** Builds the grounded context `planExecutiveSummary` and the live prompt both read from. */
export function buildSummaryContext(session: ScopingSession, scope: ScopeModel): SummaryContext {
  return { task: 'summarize-package', scope, customer: session.customer, config: session.config, facts: buildSummaryFacts(session) };
}

/**
 * Deterministic two-paragraph executive summary: the first paragraph names the customer and
 * quantifies the reviewed scope, the second cites the pre-computed facts (platform, coverage,
 * effort, timeline, ROM, confidence, open questions). Used by the mock AI provider and as the
 * fallback whenever a live summary call fails, returns nothing, or was never requested.
 */
export function planExecutiveSummary(context: SummaryContext): string {
  const { scope, customer } = context;
  const customerName = customer.customerName.trim().length > 0 ? customer.customerName.trim() : 'the customer';
  const opportunity = customer.opportunityName.trim().length > 0 ? customer.opportunityName.trim() : 'this opportunity';

  const opening =
    scope.items.length === 0
      ? `This scoping package for ${customerName}'s ${opportunity} has not yet been grounded in an analysed and approved requirements set.`
      : [
          `This scoping package covers ${customerName}'s ${opportunity}, grounded in`,
          `${countOf(countOfKind(scope, 'business'), 'business objective')}, ${countOf(countOfKind(scope, 'functional'), 'functional requirement')} and`,
          `${countOf(countOfKind(scope, 'nonFunctional'), 'non-functional requirement')} reviewed from the customer's own requirements text, alongside`,
          `${countOf(countOfKind(scope, 'integration'), 'integration')} and ${countOf(countOfKind(scope, 'security'), 'security or compliance requirement')} that shape the proposed solution.`,
        ].join(' ');

  const openQuestions = getOpenQuestions(scope).length;
  const factsSentence = context.facts.map((fact) => `${fact.label}: ${fact.value}`).join('; ');
  const questionsSentence =
    openQuestions > 0
      ? ` ${countOf(openQuestions, 'clarification question')} ${openQuestions === 1 ? 'remains' : 'remain'} open and should be resolved before this package is finalised.`
      : '';
  const closing =
    `${factsSentence.length > 0 ? `${factsSentence}.` : ''}${questionsSentence} ` +
    `This summary and the estimates that follow are an AI-assisted planning output and require review and validation by qualified sales, ` +
    `architecture, delivery, security and commercial stakeholders before being shared with ${customerName}.`;

  return `${opening}\n\n${closing.trim()}`;
}

const SUMMARY_SYSTEM_PROMPT = buildSystemPrompt(
  'a senior engagement lead writing the executive summary that opens a solution-scoping package for a Topcoder delivery proposal',
);

function buildSummaryPrompt(context: SummaryContext): PromptParts {
  const facts = context.facts.map((fact) => `${fact.label}: ${fact.value}`).join('\n');
  const prompt = [
    `Customer context:\n${describeCustomerForPrompt(context.customer)}`,
    `Reviewed scope model:\n${describeScopeForPrompt(context.scope)}`,
    `Pre-computed facts you may cite verbatim (never invent your own numbers):\n${facts}`,
    'Write exactly two short paragraphs of plain prose (no headings, bullet points, Markdown or JSON): the first names the customer and opportunity and summarises the reviewed scope; the second cites the facts above and states that the package requires stakeholder review before it is shared with the customer.',
  ].join('\n\n');
  return { system: SUMMARY_SYSTEM_PROMPT, prompt };
}

/** Free-text AI task definition consumed by `runTextTask` (same shape as IMPACT_EXPLANATION_TASK). */
export const SUMMARY_TASK = {
  id: 'summarize-package',
  label: 'Executive summary generation',
  buildPrompt: buildSummaryPrompt,
} as const;

function ruleBasedMeta(run: TaskRunOptions, startedAt: number, reason: string): GenerationMeta {
  return {
    providerId: 'rule-based-summary',
    providerLabel: 'Rule-based summary (deterministic)',
    mode: 'mock',
    usedFallback: true,
    generatedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - startedAt),
    scopeVersion: run.scopeVersion,
    issues: [{ severity: 'warning', code: 'live-fallback', message: reason, refs: [] }],
  };
}

function describeFailure(error: unknown): string {
  return error instanceof Error ? error.message : 'an unknown error';
}

/**
 * Runs the 'summarize-package' text task (mock planner or live provider). A session with no
 * approved scope, or a provider call that fails or returns nothing, falls back to the deterministic
 * `planExecutiveSummary` text so the export always has a labelled, non-empty summary to show.
 */
export async function generateExecutiveSummary(session: ScopingSession, run: TaskRunOptions): Promise<{ summary: string; meta: GenerationMeta }> {
  const startedAt = performance.now();
  if (session.scope === null) {
    return {
      summary: 'No approved scope model is available yet, so no executive summary could be generated.',
      meta: ruleBasedMeta(run, startedAt, 'No approved scope model was available when the executive summary was requested.'),
    };
  }
  const context = buildSummaryContext(session, session.scope);
  try {
    const result = await runTextTask(SUMMARY_TASK, context, run);
    const summary = result.value.trim();
    if (summary.length === 0) {
      throw new Error('The AI provider returned an empty executive summary.');
    }
    return { summary, meta: result.meta };
  } catch (error) {
    console.warn('Executive summary generation failed; using the rule-based summary.', error instanceof Error ? error.name : 'unknown error');
    return {
      summary: planExecutiveSummary(context),
      meta: ruleBasedMeta(run, startedAt, `The AI provider could not produce an executive summary (${describeFailure(error)}), so a rule-based summary was used instead.`),
    };
  }
}
