/**
 * Stage entry for customer requirements analysis. Mock and live output take the same path:
 * AI task -> schema validation (orchestrator) -> ID normalisation -> grounding -> signal tagging
 * -> reviewable ScopeModel. Every validation finding is kept on the scope and the generation meta
 * so the reviewer sees what was repaired or downgraded.
 */
import { runTask } from '../ai';
import type { AnalyzeContext, TaskRunOptions } from '../ai/types';
import type { CustomerContext, GenerationMeta, NormalizedDocument, ScopeItemDraft, ScopeModel } from '../domain';
import { createScopeModel } from '../scope';
import { groundScopeItems } from './grounding';
import { normalizeIds } from './idNormalizer';
import { analyzeRequirementsTask } from './prompt';
import { detectSignals } from './signals';

export interface AnalyzeInput {
  document: NormalizedDocument;
  customer: CustomerContext;
  scenarioId: string | null;
}

/** Signals are matched on the item's own wording plus the customer wording it is based on. */
function signalsForDraft(draft: ScopeItemDraft): string[] {
  return detectSignals([draft.title, draft.description, draft.source?.quote ?? ''].join(' '));
}

/** Full stage: AI task -> schema validation -> ID normalisation -> grounding -> signals -> ScopeModel. */
export async function analyzeRequirements(
  input: AnalyzeInput,
  run: TaskRunOptions,
): Promise<{ scope: ScopeModel; meta: GenerationMeta }> {
  const context: AnalyzeContext = { task: 'analyze-requirements', ...input };
  const { value, meta } = await runTask(analyzeRequirementsTask, context, run);

  const normalized = normalizeIds(value.items);
  const grounded = groundScopeItems(normalized.items, input.document);
  const tagged = grounded.items.map((draft) => ({ ...draft, signals: signalsForDraft(draft) }));
  const signalsById = new Map(tagged.map((draft) => [draft.id, draft.signals]));

  const issues = [...meta.issues, ...normalized.issues, ...grounded.issues];
  const model = createScopeModel(value.summary, tagged);
  const scope: ScopeModel = {
    ...model,
    items: model.items.map((item) => ({ ...item, signals: signalsById.get(item.id) ?? item.signals })),
    issues: [...model.issues, ...issues],
  };
  return { scope, meta: { ...meta, issues } };
}
