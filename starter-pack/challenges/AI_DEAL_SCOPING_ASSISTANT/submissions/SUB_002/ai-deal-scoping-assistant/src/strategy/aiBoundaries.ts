/**
 * The explicit AI / deterministic / human-decision split the spec requires (4, "Areas where
 * deterministic processing is more appropriate"): every AI use case contributes an 'ai' row and a
 * 'human-decision' row for the decision it must not make alone, and every reviewed functional or
 * integration requirement that carries no `ai:*` signal contributes a 'deterministic' row, so the
 * table is read from the same reviewed scope rather than curated by hand.
 *
 * Both the deterministic and human-decision rationale are looked up from a small table keyed by the
 * item's own capability/integration/data signal, so the sentence explains why *this* activity (a
 * payment posting, a search, a retention rule) is rule-based, rather than one sentence repeated
 * across every row. Only the first item with no matching signal
 * falls back to a fully generic sentence; any further one gets a second, differently worded generic
 * sentence so the table never repeats the exact same fallback text twice.
 */
import type { AiUseCase, ProcessingBoundary, ScopeItem } from '../domain';
import { hasSignalInGroup, signalLabel } from '../domain';
import { detectSignals } from '../analysis/signals';
import { AI_PATTERN_DEFS } from './aiPatterns.data';

/** Deterministic rationale for an activity, keyed by the capability/integration/data signal that best explains why it is rule-based rather than probabilistic. Checked in order, first match wins. */
const DETERMINISTIC_RATIONALE: ReadonlyMap<string, string> = new Map([
  ['capability:payments', 'The amounts, GL codes and approval thresholds it posts are fixed accounting rules with exactly one correct value per transaction, so the posting logic is deterministic, auditable and reconcilable to the cent rather than a probabilistic judgement.'],
  ['capability:documents', 'Which document goes where is decided by fixed metadata (record id, document type, retention class), not a judgement call, so intake and storage stay deterministic and fully auditable.'],
  ['capability:reporting', 'The figures a report or dashboard shows are a fixed aggregation of already-recorded data (sums, counts, groupings) that a query engine computes exactly and reproducibly every time, with nothing left to infer.'],
  ['capability:workflow', 'Who a case is routed or reassigned to follows a fixed rule (role, queue, workload threshold) that must give the same answer for the same input, not a model’s best guess.'],
  ['capability:portal', 'What a self-service user can see is decided by a fixed authorisation check against their own record and role, not a prediction.'],
  ['capability:forms', 'The fields required to submit or view a record are a fixed schema the form validates against, with a single correct pass/fail answer - a deterministic check, not a judgement call.'],
  ['capability:notifications', 'Whether a notification fires follows a fixed trigger condition (a status change, a schedule) with exactly one correct answer, so it is deterministic rule evaluation, not a prediction.'],
  ['capability:orders', 'Order state transitions follow the fixed rules of the order lifecycle (received, allocated, shipped), which must be applied identically every time rather than inferred.'],
  ['capability:admin', 'Reconciling one record against another is a fixed field-by-field comparison against tolerance rules the customer defines, not a probabilistic match.'],
  ['capability:catalog', 'Matching a catalogue or inventory record to its master entry is a fixed key lookup, not a probabilistic match.'],
  ['capability:identity', 'Authenticating a user and validating their profile fields are checked against fixed identity rules (credentials, required fields), a deterministic check with no ambiguity for a model to resolve.'],
  ['capability:search', 'A directory or record search is an exact or fixed-fuzzy match against indexed fields; the same query must return the same ranked results every time, which a deterministic search index guarantees and a probabilistic model does not.'],
  ['capability:messaging', 'Which channel or queue a message is delivered to is decided by a fixed routing rule tied to the message type, not a judgement call.'],
  ['data:retention', 'How long a record is kept follows the fixed retention period the customer states (or a documented default), a deterministic lifecycle rule rather than a case-by-case judgement.'],
  ['integration:erp', 'The field mapping and posting rules for this ERP exchange are fixed by the ERP’s own schema and the customer’s accounting rules, leaving nothing for a model to infer.'],
  ['integration:crm', 'Records are matched to the CRM by a fixed key (account or contact id), a deterministic lookup rather than a probabilistic match.'],
  ['integration:data-warehouse', 'Loading the warehouse follows a fixed schema and refresh schedule with one correct transformation per record, not a judgement call.'],
  ['integration:api', 'The request and response contract is fixed by the API’s own specification, so building to it is deterministic integration work.'],
  ['integration:file', 'The file layout (columns, delimiters, encoding) is fixed by the exchange format both sides agreed on, a deterministic parse rather than an inference.'],
  ['integration:batch', 'A batch job applies the same fixed transformation to every record in the run, with exactly one correct output per input row.'],
  ['integration:realtime', 'Each event is processed against a fixed schema and idempotency rule the moment it arrives, a deterministic transformation, not a prediction.'],
  ['integration:ehr', 'Reading from and writing to the clinical system follows the fixed resource contract (HL7/FHIR) the system exposes, leaving no ambiguity for a model to resolve.'],
  ['integration:email-sms', 'Whether a message is sent follows the fixed trigger and template rule for that message type, not a judgement call.'],
  ['integration:identity-provider', 'Authentication decisions must be reproducible and auditable for every sign-in, which only a deterministic protocol - not a probabilistic model - can guarantee.'],
]);

function humanDecisionActivityFor(useCase: AiUseCase): string {
  const def = AI_PATTERN_DEFS.find((candidate) => candidate.patternLabel === useCase.pattern);
  return def?.humanDecisionActivity ?? 'a decision that requires a person, not a model';
}

/**
 * Fixed phrases the customer uses when a functional or integration requirement itself hands a
 * decision to a person, so a plain requirement outside any AI use case (a clerk review step, a
 * steward correction queue, a sign-off) is still routed to a 'human-decision' row instead of being
 * folded into 'deterministic' merely because it carries no `ai:*` signal. Checked with
 * `String.includes` against the item's own lowercased title and description - no RegExp, so a cue
 * only fires on the literal wording the customer used.
 */
const HUMAN_DECISION_CUES: readonly string[] = [
  'review and correct',
  'for review',
  'manual review',
  'human review',
  'mandatory review',
  'sign-off',
  'sign off',
  'requires approval',
  'needs approval',
  'hand off',
  'hand-off',
  'stewards',
  'unit review',
];

/** True when the item's own title or description names a human decision step in the customer's own words. */
function statesHumanDecision(item: ScopeItem): boolean {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return HUMAN_DECISION_CUES.some((cue) => text.includes(cue));
}

/** Grounded reason for a requirement that states its own human-decision step, quoting the requirement so the row is traceable to what the customer actually wrote rather than a generic sentence. */
function customerStatedHumanDecisionReason(item: ScopeItem): string {
  return `${item.id} is the customer's own requirement for a human decision: ${item.description} The application routes and records that decision; it does not make it on its own.`;
}

/** Human-decision rows for plain functional/integration items whose own wording names a human decision step, so they never get mislabelled as deterministic merely for carrying no `ai:*` signal. */
function customerStatedHumanDecisionRows(items: readonly ScopeItem[]): ProcessingBoundary[] {
  return items.filter((item) => isNonAiActivity(item) && statesHumanDecision(item)).map((item) => ({
    activity: item.title,
    type: 'human-decision',
    reason: customerStatedHumanDecisionReason(item),
    requirementIds: [item.id],
  }));
}

function aiRows(useCases: readonly AiUseCase[]): ProcessingBoundary[] {
  return useCases.map((useCase) => ({
    activity: useCase.name,
    type: 'ai',
    reason: `${useCase.pattern} produces a probabilistic result best suited to unstructured input, so it is implemented as an AI function rather than a fixed rule.`,
    requirementIds: useCase.requirementIds,
  }));
}

function firstTableReason(signals: readonly string[]): string | undefined {
  for (const signal of signals) {
    const reason = DETERMINISTIC_RATIONALE.get(signal);
    if (reason !== undefined) {
      return reason;
    }
  }
  return undefined;
}

/**
 * The title names the activity itself, while the description often mentions neighbouring systems
 * ("...and SAP payment postings"), so only a signal found in the title may pick a specific reason;
 * otherwise a timeline view would be explained with the accounting rationale of a system it merely shows.
 */
function tableRationale(item: ScopeItem): string | undefined {
  return firstTableReason(detectSignals(item.title).filter((signal) => item.signals.includes(signal)));
}

/** Item-specific wording for an activity no table entry describes, so rows never share one boilerplate sentence. */
function specifiedByRequirement(item: ScopeItem): string {
  return `"${item.title}" is fully specified by ${item.id}: the same input must always produce the same result, so it is built as application logic that can be tested and audited rather than as a model.`;
}

function isNonAiActivity(item: ScopeItem): boolean {
  return (item.kind === 'functional' || item.kind === 'integration') && !hasSignalInGroup(item.signals, 'ai');
}

/** Deterministic rows, one per non-AI functional/integration item that states no human decision of its own, each reasoned from the activity its title names. */
function deterministicRows(items: readonly ScopeItem[]): ProcessingBoundary[] {
  return items.filter((item) => isNonAiActivity(item) && !statesHumanDecision(item)).map((item) => ({
    activity: item.title,
    type: 'deterministic',
    reason: tableRationale(item) ?? specifiedByRequirement(item),
    requirementIds: [item.id],
  }));
}

/**
 * Cues in a citing item's own wording that it actually demands a human review, sign-off or
 * approval, so `citedAuthority` never names a "required by" source that merely happens to carry a
 * compliance signal or a business/security kind - such as a technology preference that only
 * mentions a regulation in passing - without itself stating any such step. Checked with
 * `String.includes` against the item's own lowercased title and description - no RegExp.
 */
const AUTHORITY_CUES: readonly string[] = ['review', 'approv', 'sign', 'human', 'staff', 'clinician'];

/** True when the item's own title or description states, in the customer's own words, that a person reviews, approves or signs off on this activity. */
function statesReviewAuthority(item: ScopeItem): boolean {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return AUTHORITY_CUES.some((cue) => text.includes(cue));
}

function citedAuthority(items: readonly ScopeItem[], useCase: AiUseCase): ScopeItem | undefined {
  return useCase.requirementIds
    .map((id) => items.find((item) => item.id === id))
    .find((item): item is ScopeItem => item !== undefined && item.provenance === 'customer-stated' && statesReviewAuthority(item));
}

/** The pattern's own human-review sentence, plus which regulation or customer statement requires it when the use case's evidence names one. */
function humanDecisionReason(items: readonly ScopeItem[], useCase: AiUseCase): string {
  const authority = citedAuthority(items, useCase);
  if (authority === undefined) {
    return useCase.humanReview;
  }
  const regulation = authority.signals.find((signal) => hasSignalInGroup([signal], 'compliance'));
  const citation = regulation === undefined ? `${authority.id} (${authority.title})` : `${signalLabel(regulation)}, per ${authority.id} (${authority.title})`;
  return `${useCase.humanReview} This sign-off is required by ${citation}.`;
}

function humanDecisionRows(items: readonly ScopeItem[], useCases: readonly AiUseCase[]): ProcessingBoundary[] {
  return useCases.map((useCase) => ({
    activity: `Sign-off on ${humanDecisionActivityFor(useCase)}`,
    type: 'human-decision',
    reason: humanDecisionReason(items, useCase),
    requirementIds: useCase.requirementIds,
  }));
}

/** The AI/deterministic/human-decision table for the reviewed scope's activities. */
export function buildProcessingBoundaries(items: readonly ScopeItem[], useCases: readonly AiUseCase[]): ProcessingBoundary[] {
  return [...aiRows(useCases), ...deterministicRows(items), ...customerStatedHumanDecisionRows(items), ...humanDecisionRows(items, useCases)];
}
