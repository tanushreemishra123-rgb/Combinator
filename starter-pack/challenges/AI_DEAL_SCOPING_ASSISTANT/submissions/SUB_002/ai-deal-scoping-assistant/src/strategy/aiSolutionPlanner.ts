/**
 * Deterministic AI-solution strategy used by the mock provider (and as the grounded baseline a
 * live-generated response is validated against, see validate.ts). When the reviewed scope carries
 * no `ai:*` signal, applicable is false and no use case is invented (spec 4, "AI Solution
 * Approach" + Solution Depth Requirement: never assert AI capability the requirements do not ask
 * for).
 */
import type { AiSolutionContext } from '../ai/types';
import type { AiStrategyOutput, AiUseCase, ContentLabel, ScopeItem, ScopeModel, TracedStatement } from '../domain';
import { AiStrategyOutputSchema, hasSignalInGroup, signalLabel } from '../domain';
import { getActiveItems } from '../scope';
import { buildAiUseCases, prohibitsAi } from './aiUseCases';
import { buildProcessingBoundaries } from './aiBoundaries';
import { buildFrameworkRecommendations } from './aiFrameworks';
import { findScopeItem, labelForProvenance } from './shared';

/** Wording that means a compliance item's own text puts an obligation on the model/AI provider itself (e.g. a required business-associate agreement), not only on how the customer's own systems handle the data. */
const AI_PROVIDER_COMPLIANCE_CUES: readonly string[] = ['ai provider', 'model provider', 'subprocessor'];

function namesAiProviderCompliance(item: ScopeItem): boolean {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return AI_PROVIDER_COMPLIANCE_CUES.some((cue) => text.includes(cue));
}

/**
 * True when `item` restates the same provider-compliance obligation as another matched item that
 * is itself customer-stated, so a customer's own requirement (e.g. a HIPAA BAA clause) is not
 * repeated as a second, near-identical bullet merely because a related assumption or dependency
 * also happens to mention the AI/model provider.
 */
function isRestatedByCustomerStatedItem(item: ScopeItem, matched: readonly ScopeItem[]): boolean {
  return item.provenance !== 'customer-stated' && matched.some((other) => other.id !== item.id && other.provenance === 'customer-stated' && item.relatedIds.includes(other.id));
}

/** A grounded sentence per reviewed compliance item that puts an obligation directly on the AI/model provider (a BAA or equivalent data-processing agreement), so a regulation that names the provider is never left out of Responsible AI and Data privacy in favour of the same generic bullets every scenario gets. Only one statement is produced for a group of related items that all restate the same obligation. */
function aiProviderComplianceStatements(items: readonly ScopeItem[]): string[] {
  const matched = items.filter((item) => hasSignalInGroup(item.signals, 'compliance') && namesAiProviderCompliance(item));
  return matched
    .filter((item) => !isRestatedByCustomerStatedItem(item, matched))
    .map((item) => {
      const regulation = item.signals.find((signal) => hasSignalInGroup([signal], 'compliance'));
      const regulationLabel = regulation === undefined ? 'a' : signalLabel(regulation);
      const relatedNote = item.relatedIds.length > 0 ? `; see also ${item.relatedIds.join(', ')}` : '';
      return `The model provider must sign a ${regulationLabel} business associate agreement (or equivalent data-processing agreement) before any pilot (${item.id}${relatedNote}).`;
    });
}

/** A grounded sentence per reviewed item whose own wording refuses AI training/fine-tuning, citing the id so the exclusion is traceable to the requirement that states it rather than asserted once in general terms. */
function aiTrainingExclusionStatements(items: readonly ScopeItem[]): string[] {
  return items.filter(prohibitsAi).map((item) => `Content sent to the model for ${item.id} is excluded from training or fine-tuning unless separately approved through the process that requirement states.`);
}

function summaryLabel(scope: ScopeModel, requirementIds: readonly string[]): ContentLabel {
  const items = requirementIds.map((id) => findScopeItem(scope, id)).filter((item): item is ScopeItem => item !== undefined);
  const assumed = items.find((item) => item.provenance === 'assumed');
  if (assumed !== undefined) {
    return labelForProvenance('assumed');
  }
  const inferred = items.find((item) => item.provenance === 'ai-inferred');
  return labelForProvenance(inferred === undefined ? 'customer-stated' : 'ai-inferred');
}

/** The use-case name already leads with its pattern unless a single requirement named it, so the pattern is appended only then. */
function titleWithPattern(useCase: AiUseCase): string {
  return useCase.name.startsWith(useCase.pattern) ? useCase.name : `${useCase.name} (${useCase.pattern})`;
}

function summaryFor(scope: ScopeModel, useCases: readonly AiUseCase[]): TracedStatement[] {
  return useCases.map((useCase) => ({
    text: `${titleWithPattern(useCase)}: ${useCase.description}`,
    refs: useCase.requirementIds,
    label: summaryLabel(scope, useCase.requirementIds),
  }));
}

function notApplicableStrategy(items: readonly ScopeItem[]): AiStrategyOutput {
  const boundaries = buildProcessingBoundaries(items, []);
  const summary: TracedStatement[] = [
    {
      text:
        boundaries.length > 0
          ? `The reviewed requirements contain no AI-driven capability (no requirement carries an ai:* signal); ${boundaries.map((row) => row.activity).join(', ')} are delivered through deterministic application logic instead.`
          : 'The reviewed requirements contain no AI-driven capability and no deterministic activity has been reviewed yet; this strategy will be regenerated once functional requirements are approved.',
      refs: [],
      label: 'ai-interpretation',
    },
  ];
  return {
    applicable: false,
    summary,
    useCases: [],
    boundaries,
    architecturePattern: 'No AI architecture pattern applies: every reviewed activity is implemented as deterministic application logic.',
    frameworks: [],
    promptManagement: 'Not applicable: no use case sends a prompt to a model.',
    evaluationApproach: 'Not applicable: correctness is verified with conventional unit and integration tests against the deterministic rules, not model evaluation.',
    responsibleAi: [],
    monitoringAndFeedback: 'Standard application monitoring (error rate, latency, availability) covers these deterministic activities; no model-specific monitoring is required.',
    dataPrivacy: 'No requirement content is sent to an AI model; standard application-level data protection controls apply.',
  };
}

function promptManagementFor(useCases: readonly AiUseCase[]): string {
  const names = useCases.map((useCase) => useCase.name).join(', ');
  return `Each use case's (${names}) system and user prompts are versioned in source control next to the code that calls them, changed only through code review, and re-run against that use case's golden set in CI before the change ships; the model's JSON output is validated against a versioned JSON schema for that use case, so a malformed response is rejected rather than passed downstream.`;
}

function evaluationApproachFor(useCases: readonly AiUseCase[]): string {
  return useCases.map((useCase) => `${useCase.name}: ${useCase.evaluation}`).join(' ');
}

function responsibleAiFor(items: readonly ScopeItem[], useCases: readonly AiUseCase[]): string[] {
  const statements = [
    'No reviewed requirement or customer document is used to train or fine-tune a third-party model.',
    'Every AI use case names the mandatory human decision it feeds and does not make alone (see AI vs deterministic vs human-decision boundaries).',
  ];
  if (useCases.some((useCase) => useCase.evaluation.length > 0)) {
    statements.push('Accuracy/groundedness is measured against a golden set before release and monitored in production, not asserted once and left unchecked.');
  }
  if (useCases.some((useCase) => useCase.safety.length > 0)) {
    statements.push('Prompt-injection and content-safety filters run on every production request, not only in development.');
  }
  statements.push(...aiProviderComplianceStatements(items));
  statements.push(...aiTrainingExclusionStatements(items));
  return statements;
}

function monitoringAndFeedbackFor(useCases: readonly AiUseCase[]): string {
  const names = useCases.map((useCase) => useCase.name).join(', ');
  const verb = useCases.length === 1 ? 'is' : 'are';
  return `${names} ${verb} monitored for request volume, latency, token cost, error rate and evaluation-score trend as described per use case; a human reviewer's correction or escalation is logged and periodically folded back into the golden set so the evaluation suite improves with production use instead of staying fixed at launch.`;
}

function dataPrivacyFor(items: readonly ScopeItem[], useCases: readonly AiUseCase[]): string {
  const perUseCase = useCases.map((useCase) => `${useCase.name}: ${useCase.privacy}`).join(' ');
  const complianceStatements = aiProviderComplianceStatements(items).join(' ');
  return complianceStatements.length === 0 ? perUseCase : `${perUseCase} ${complianceStatements}`;
}

function architecturePatternFor(useCases: readonly AiUseCase[], orchestrationName: string): string {
  const patterns = Array.from(new Set(useCases.map((useCase) => useCase.pattern)));
  return `${patterns.join(' combined with ')}, orchestrated with ${orchestrationName} and served behind the platform's managed AI service.`;
}

/** Builds the full AiStrategyOutput for the reviewed scope; not-applicable when no `ai:*` signal is present. */
export function planAiSolution(context: AiSolutionContext): AiStrategyOutput {
  const items = getActiveItems(context.scope).filter((item) => item.inScope);
  if (!items.some((item) => hasSignalInGroup(item.signals, 'ai'))) {
    return AiStrategyOutputSchema.parse(notApplicableStrategy(items));
  }

  const useCases = buildAiUseCases(context, items);
  const boundaries = buildProcessingBoundaries(items, useCases);
  const frameworks = buildFrameworkRecommendations(items, useCases, context.platform, context.components);
  const orchestrationName = frameworks.at(0)?.name ?? 'a custom orchestrator';

  const draft: AiStrategyOutput = {
    applicable: true,
    summary: summaryFor(context.scope, useCases),
    useCases,
    boundaries,
    architecturePattern: architecturePatternFor(useCases, orchestrationName),
    frameworks,
    promptManagement: promptManagementFor(useCases),
    evaluationApproach: evaluationApproachFor(useCases),
    responsibleAi: responsibleAiFor(items, useCases),
    monitoringAndFeedback: monitoringAndFeedbackFor(useCases),
    dataPrivacy: dataPrivacyFor(items, useCases),
  };
  return AiStrategyOutputSchema.parse(draft);
}
