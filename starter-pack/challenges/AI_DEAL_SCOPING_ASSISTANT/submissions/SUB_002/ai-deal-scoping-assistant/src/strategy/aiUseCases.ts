/**
 * AI use cases (AIUC_01, ...): one per pattern group in aiPatterns.data.ts that the reviewed scope
 * actually signals, so nothing is invented - a scope with no `ai:*` signal produces none (see
 * aiSolutionPlanner.ts for the not-applicable path).
 *
 * A pattern only becomes a use case when a genuine requirement backs it: only a requirement-kind
 * item (business, functional, nonFunctional, integration, data, security) can trigger it, and at
 * least one of those triggers must be a functional/business capability or something the customer
 * explicitly asked for - a delivery assumption or an inferred persona/gap carrying the same signal
 * cannot invent a use case on its own (for example a "Recommendation engine" use case built solely
 * from an internal delivery assumption). Other item kinds that share the
 * signal still shape the use case's description. An item whose own text refuses AI (a no-retraining
 * clause and similar) never counts either way. Customer-stated use cases are then ordered first,
 * so an explicitly requested capability is never crowded out by a merely inferred one.
 */
import type { AiSolutionContext } from '../ai/types';
import type { AiUseCase, ArchitectureComponent, CloudPlatform, ScopeItem } from '../domain';
import { REQUIREMENT_KINDS } from '../domain';
import { findComponents, serviceNames } from './componentLookup';
import { modelOptionsFor, retrievalServiceFor } from './aiModels.data';
import type { AiPatternDef, UseCaseNarrativeInput } from './aiPatterns.data';
import { AI_PATTERN_DEFS } from './aiPatterns.data';
import { idSequence } from './shared';

/** A negation paired with a training/model reference means "do not use AI here" (e.g. DATA4's no-retraining-without-approval clause), not a capability to build - it must never trigger or shape a use case even if it shares a pattern's signal. */
const AI_NEGATION_CUES: readonly string[] = ['must not', 'should not', 'may not', 'is not permitted to', 'are not permitted to'];
const AI_TRAINING_CUES: readonly string[] = ['retrain', 'fine-tune', 'fine tune', 'train the model', 'train a model'];

function textOf(item: ScopeItem): string {
  return `${item.title} ${item.description}`.toLowerCase();
}

/** True when the item's own wording refuses AI use for training/fine-tuning (e.g. a no-retraining-without-approval clause), so callers outside this module can exclude the same items from an AI use case and from any statement that would otherwise assert unrestricted model training. */
export function prohibitsAi(item: ScopeItem): boolean {
  const text = textOf(item);
  return AI_NEGATION_CUES.some((cue) => text.includes(cue)) && AI_TRAINING_CUES.some((cue) => text.includes(cue));
}

/** Every item carrying one of this pattern's signals, minus anything that explicitly refuses AI. */
function matchedItems(items: readonly ScopeItem[], def: AiPatternDef): ScopeItem[] {
  return items.filter((item) => item.signals.some((signal) => def.signals.includes(signal)) && !prohibitsAi(item));
}

function isRequirementKind(item: ScopeItem): boolean {
  return REQUIREMENT_KINDS.includes(item.kind);
}

/** A requirement-kind item that is, by itself, enough evidence for the use case to exist: a functional/business capability, or anything the customer explicitly stated (regardless of kind). */
function isQualifyingTrigger(item: ScopeItem): boolean {
  return isRequirementKind(item) && (item.kind === 'functional' || item.kind === 'business' || item.provenance === 'customer-stated');
}

function isCustomerStatedTrigger(item: ScopeItem): boolean {
  return isQualifyingTrigger(item) && item.provenance === 'customer-stated';
}

/** How many headline requirements the description spells out in full before summarising the rest by id. */
const MAX_DESCRIBED_ITEMS = 3;

/**
 * The items the use case exists to deliver: functional requirements first, then any other
 * requirement kind, then whatever matched - so personas, gaps and open questions that merely
 * mention the AI feature shape the use case without naming it.
 */
function headlineItems(items: readonly ScopeItem[]): ScopeItem[] {
  const functional = items.filter((item) => item.kind === 'functional');
  if (functional.length > 0) {
    return functional;
  }
  const requirements = items.filter((item) => REQUIREMENT_KINDS.includes(item.kind));
  return requirements.length > 0 ? requirements : [...items];
}

function nameFor(def: AiPatternDef, items: readonly ScopeItem[]): string {
  const titles = Array.from(new Set(headlineItems(items).map((item) => item.title)));
  const first = titles.at(0);
  if (first === undefined) {
    return def.patternLabel;
  }
  if (titles.length === 1) {
    return items.length === 1 ? first : `${def.patternLabel}: ${first}`;
  }
  const others = titles.length - 1;
  return `${def.patternLabel}: ${first} and ${others} related ${others === 1 ? 'function' : 'functions'}`;
}

function descriptionFor(def: AiPatternDef, items: readonly ScopeItem[]): string {
  const headline = headlineItems(items);
  const described = headline.slice(0, MAX_DESCRIBED_ITEMS);
  const describedIds = new Set(described.map((item) => item.id));
  const shapedBy = items.filter((item) => !describedIds.has(item.id)).map((item) => item.id);
  const delivers = `${def.patternLabel} delivering ${described.map((item) => `${item.id} (${item.description})`).join('; ')}.`;
  return shapedBy.length === 0 ? delivers : `${delivers} Also shaped by ${shapedBy.join(', ')}.`;
}

function monitoringFor(components: readonly ArchitectureComponent[]): string {
  const services = serviceNames(findComponents(components, { areas: ['observability'] }));
  const dashboard = services.length > 0 ? services.join(', ') : 'the platform-native monitoring and alerting service selected during detailed design';
  return `Request volume, latency, token cost, error rate and the evaluation score trend are tracked in ${dashboard}, with an alert when the evaluation score or error rate crosses its threshold.`;
}

function retrievalFor(def: AiPatternDef, platform: CloudPlatform, components: readonly ArchitectureComponent[], input: UseCaseNarrativeInput): string {
  if (!def.needsRetrieval) {
    return '';
  }
  return `${def.retrieval(input)} Retrieval runs against ${retrievalServiceFor(platform, components)}.`;
}

interface UseCaseCandidate {
  def: AiPatternDef;
  matched: ScopeItem[];
  customerStated: boolean;
}

/** One candidate per pattern the scope signals and that a qualifying trigger backs; customer-stated candidates sort first while ids stay assigned in that final order. */
function candidatesFor(items: readonly ScopeItem[]): UseCaseCandidate[] {
  const candidates: UseCaseCandidate[] = [];
  for (const def of AI_PATTERN_DEFS) {
    const matched = matchedItems(items, def);
    if (matched.length === 0 || !matched.some(isQualifyingTrigger)) {
      continue;
    }
    candidates.push({ def, matched, customerStated: matched.some(isCustomerStatedTrigger) });
  }
  return candidates.sort((a, b) => Number(b.customerStated) - Number(a.customerStated));
}

/** One AI use case per pattern the reviewed scope's `ai:*` signals match and a qualifying requirement backs. */
export function buildAiUseCases(context: AiSolutionContext, items: readonly ScopeItem[]): AiUseCase[] {
  const nextId = idSequence('AIUC');
  return candidatesFor(items).map(({ def, matched }) => {
    const name = nameFor(def, matched);
    const narrativeInput: UseCaseNarrativeInput = { name, region: context.customer.region, customerName: context.customer.customerName };
    return {
      id: nextId(),
      name,
      description: descriptionFor(def, matched),
      requirementIds: matched.map((item) => item.id),
      pattern: def.patternLabel,
      modelOptions: modelOptionsFor(context.platform, context.config.aiProviderPreference, def.modality),
      retrieval: retrievalFor(def, context.platform, context.components, narrativeInput),
      orchestration: def.orchestration(narrativeInput),
      evaluation: def.evaluation(narrativeInput),
      safety: def.safety(narrativeInput),
      privacy: def.privacy(narrativeInput),
      humanReview: def.humanReview(narrativeInput),
      monitoring: monitoringFor(context.components),
      complexity: def.complexity,
    };
  });
}
