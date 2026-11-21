/**
 * Stage 5 of the heuristic engine: missing-information detection.
 *
 * Missing or ambiguous critical information is surfaced as gap + clarification question pairs and
 * as explicit working assumptions - it is never silently invented. Gaps and questions carry the
 * estimation inputs they leave undefined so the estimator can lower confidence accordingly.
 */
import type { CustomerContext, EstimationInputKey, NormalizedDocument, Priority, ScopeItemKind, SourceRef } from '../domain';
import { sourceFromStatement } from './draftBook';
import type { DraftBook, ExtractedItem } from './draftBook';
import { inputsAffectedBy } from './extraction';
import { AMBIGUITY_RULES, CHECKLIST_RULES, INTERFACE_READINESS_TERMS } from './gapChecklist.data';
import type { AmbiguityRule, ChecklistRule, DocumentFacts } from './gapChecklist.data';
import { MAX_RELATED_IDS } from './inference';
import type { IntegrationLink } from './inference';
import type { Statement } from './segmentation';
import { detectSignals } from './signals';
import { containsAnyTerm, containsNumber, normalizeForMatch } from './textMatch';

/** Kinds whose wording can be ambiguous; open points, risks and assumptions are already caveats. */
const AMBIGUITY_SOURCE_KINDS: ReadonlySet<ScopeItemKind> = new Set<ScopeItemKind>([
  'business', 'functional', 'nonFunctional', 'integration', 'data', 'security', 'technology', 'constraint',
]);

export function buildDocumentFacts(document: NormalizedDocument, statements: readonly Statement[], customer: CustomerContext): DocumentFacts {
  return { normalizedText: normalizeForMatch(document.text), statements, signals: detectSignals(document.text), customer };
}

/** A selector is an exact signal id, or a 'group:' prefix matching every signal of that group. */
function matchesSelector(signals: readonly string[], selector: string): boolean {
  return selector.endsWith(':') ? signals.some((signal) => signal.startsWith(selector)) : signals.includes(selector);
}

function relatedItems(extracted: readonly ExtractedItem[], selectors: readonly string[]): ExtractedItem[] {
  return extracted.filter((item) => selectors.some((selector) => matchesSelector(item.signals, selector))).slice(0, MAX_RELATED_IDS);
}

interface GapPairFields {
  gapTitle: string;
  gapDescription: string;
  questionTitle: string;
  questionDescription: string;
  critical: boolean;
  inputs: ChecklistRule['inputs'];
  source: SourceRef | null;
  relatedIds: readonly string[];
}

/** Adds the gap and its clarification question, linked to each other and to the related items. */
function addGapPair(book: DraftBook, fields: GapPairFields): void {
  const priority: Priority = fields.critical ? 'High' : 'Medium';
  const shared = { priority, provenance: 'ai-inferred' as const, source: fields.source, affectsInputs: [...fields.inputs], critical: fields.critical };
  const gapId = book.add('gap', { ...shared, title: fields.gapTitle, description: fields.gapDescription });
  const questionId = book.add('question', { ...shared, title: fields.questionTitle, description: fields.questionDescription });
  book.link(gapId, questionId);
  book.linkAll(gapId, fields.relatedIds);
  book.linkAll(questionId, fields.relatedIds);
}

function raiseChecklistGap(book: DraftBook, rule: ChecklistRule, facts: DocumentFacts, extracted: readonly ExtractedItem[]): void {
  const related = relatedItems(extracted, rule.relatedSignals);
  const anchor = related.at(0);
  addGapPair(book, {
    gapTitle: rule.gapTitle,
    gapDescription: rule.gapDescription,
    questionTitle: rule.questionTitle,
    questionDescription: rule.questionDescription,
    critical: rule.isCritical(facts),
    inputs: rule.inputs,
    source: anchor === undefined ? null : sourceFromStatement(anchor.statement),
    relatedIds: related.map((item) => item.id),
  });
}

/** Interface readiness is tracked per system, so one open point about it never answers for the others. */
const PER_SYSTEM_INPUT: EstimationInputKey = 'integrationReadiness';

/** Estimation inputs the customer has already flagged as open in their own words. */
function inputsOpenedByCustomer(extracted: readonly ExtractedItem[]): ReadonlySet<EstimationInputKey> {
  return new Set(extracted.filter((item) => item.kind === 'gap').flatMap((item) => inputsAffectedBy(item.statement.normalized)));
}

/** A checklist gap would only repeat an open point the customer raised for the same input. */
function isAlreadyOpen(rule: ChecklistRule, opened: ReadonlySet<EstimationInputKey>): boolean {
  return rule.inputs.length > 0 && rule.inputs.every((input) => input !== PER_SYSTEM_INPUT && opened.has(input));
}

/** Runs the critical-information checklist over the whole document. */
export function raiseChecklistGaps(facts: DocumentFacts, extracted: readonly ExtractedItem[], book: DraftBook): void {
  const opened = inputsOpenedByCustomer(extracted);
  for (const rule of CHECKLIST_RULES) {
    if (rule.applies(facts) && !rule.isStated(facts) && !isAlreadyOpen(rule, opened)) {
      raiseChecklistGap(book, rule, facts, extracted);
    }
  }
}

/** One readiness gap per integration whose statement says nothing about how the system is reached. */
export function raiseIntegrationReadinessGaps(links: readonly IntegrationLink[], book: DraftBook): void {
  for (const link of links) {
    const { integration, systemName } = link;
    if (containsAnyTerm(integration.statement.normalized, INTERFACE_READINESS_TERMS)) {
      continue;
    }
    addGapPair(book, {
      gapTitle: `Interface readiness of ${systemName} not stated`,
      gapDescription: `${integration.id} requires an exchange with ${systemName}, but the requirements do not say whether documented APIs, a sandbox and rate limits exist. Integration complexity cannot be confirmed until this is known.`,
      questionTitle: `How can ${systemName} be integrated?`,
      questionDescription: `Does ${systemName} expose documented APIs or events for ${integration.id}, is a sandbox available, and which team owns interface changes and credentials?`,
      critical: true,
      inputs: ['integrationReadiness'],
      source: sourceFromStatement(integration.statement),
      relatedIds: [integration.id, ...link.relatedIds],
    });
  }
}

function isAmbiguous(rule: AmbiguityRule, item: ExtractedItem): boolean {
  const text = item.statement.normalized;
  if (!AMBIGUITY_SOURCE_KINDS.has(item.kind) || !containsAnyTerm(text, rule.terms)) {
    return false;
  }
  if (containsAnyTerm(text, rule.specificTerms)) {
    return false;
  }
  return !(rule.quantifiable && containsNumber(text));
}

/**
 * Unquantified wording becomes one 'assumed' working assumption per ambiguity type, citing the
 * first statement that uses it and linked both ways to every requirement it qualifies.
 */
export function raiseAmbiguityAssumptions(extracted: readonly ExtractedItem[], book: DraftBook): void {
  for (const rule of AMBIGUITY_RULES) {
    const ambiguous = extracted.filter((item) => isAmbiguous(rule, item)).slice(0, MAX_RELATED_IDS);
    const first = ambiguous.at(0);
    if (first === undefined) {
      continue;
    }
    const relatedIds = ambiguous.map((item) => item.id);
    const id = book.add('assumption', {
      title: rule.title,
      description: `${rule.assumption} Applies to ${relatedIds.join(', ')}; to be validated with the customer.`,
      priority: 'Medium',
      provenance: 'assumed',
      source: sourceFromStatement(first.statement),
      affectsInputs: [...rule.inputs],
      critical: false,
    });
    book.linkAll(id, relatedIds);
  }
}
