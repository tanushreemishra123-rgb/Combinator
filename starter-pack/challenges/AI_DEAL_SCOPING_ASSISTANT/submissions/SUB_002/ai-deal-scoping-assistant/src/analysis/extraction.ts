/**
 * Stage 3 of the heuristic engine: turn classified statements into customer-stated scope items.
 * Open points raised by the customer ("TBD", a literal question) become a gap plus a linked
 * clarification question instead of a requirement, so nothing uncertain is silently baselined.
 */
import { REQUIREMENT_KINDS } from '../domain';
import type { EstimationInputKey } from '../domain';
import { classifyStatement } from './classification';
import type { Classification } from './classification';
import { sourceFromStatement } from './draftBook';
import type { DraftBook, ExtractedItem } from './draftBook';
import { derivePriority } from './priority';
import type { Statement } from './segmentation';
import { detectSignals } from './signals';
import { containsAnyTerm } from './textMatch';
import { asSentence, buildTitle } from './titles';

/** When nothing is classifiable (e.g. non-English text) the opening statements are kept as scope. */
export const FALLBACK_STATEMENT_LIMIT = 3;

interface InputCue {
  input: EstimationInputKey;
  terms: readonly string[];
}

/** Which estimation inputs an open point touches, judged from its wording. */
const INPUT_CUES: readonly InputCue[] = [
  {
    input: 'expectedUsers',
    terms: ['number of users', 'user volume', 'user base', 'user count', 'member count', 'how many users', 'how many members', 'how many active',
      'how many customers', 'how many people', 'concurrent', 'headcount', 'seats'],
  },
  { input: 'environments', terms: ['environment', 'staging', 'uat', 'pre prod'] },
  { input: 'deliveryDeadline', terms: ['deadline', 'go live', 'golive', 'launch', 'timeline', 'date', 'schedule', 'milestone'] },
  { input: 'integrationReadiness', terms: ['api', 'integrat', 'interface', 'endpoint', 'connector', 'sandbox'] },
  { input: 'dataVolume', terms: ['volume', 'records', 'migrat', 'data size', 'history', 'storage'] },
  { input: 'complianceScope', terms: ['complian', 'regulat', 'gdpr', 'hipaa', 'pci', 'certification', 'legal'] },
  { input: 'aiDataAvailability', terms: ['training data', 'ai', 'model', 'labelled', 'labeled', 'knowledge base'] },
  { input: 'targetRegions', terms: ['region', 'countr', 'geograph', 'market', 'hosting location'] },
];

export function inputsAffectedBy(normalizedText: string): EstimationInputKey[] {
  return INPUT_CUES.filter((cue) => containsAnyTerm(normalizedText, cue.terms)).map((cue) => cue.input);
}

/** A literal customer question or a "Confirm ..." action already reads as a question title. */
function questionTitle(topic: string, isQuestion: boolean): string {
  return isQuestion || topic.toLowerCase().startsWith('confirm ') ? topic : `Clarify: ${topic}`;
}

function addOpenPoint(book: DraftBook, statement: Statement, classification: Classification): ExtractedItem {
  const source = sourceFromStatement(statement);
  const topic = buildTitle(statement.text);
  const affectsInputs = inputsAffectedBy(statement.normalized);
  const critical = affectsInputs.length > 0;
  const priority = critical ? 'High' : 'Medium';
  const gapId = book.add('gap', {
    title: `Open point: ${topic}`,
    description: `The customer text leaves this point open: "${statement.text}" It must be confirmed before the affected scope and estimate are baselined.`,
    priority,
    provenance: 'customer-stated',
    source,
    affectsInputs,
    critical,
  });
  const questionId = book.add('question', {
    title: questionTitle(topic, classification.isQuestion),
    description: classification.isQuestion
      ? `The customer asks: "${statement.text}" A response is needed from the delivery team, and any scope implication must be agreed with the customer.`
      : `The requirements state "${statement.text}" What is the confirmed position, and who on the customer side owns the decision?`,
    priority,
    provenance: 'ai-inferred',
    source,
    affectsInputs,
    critical,
  });
  book.link(gapId, questionId);
  return { id: gapId, kind: 'gap', statement, signals: detectSignals(statement.text) };
}

function addStatedItem(book: DraftBook, statement: Statement, classification: Classification): ExtractedItem {
  const id = book.add(classification.kind, {
    title: buildTitle(statement.text),
    description: asSentence(statement.text),
    priority: derivePriority(statement.normalized),
    provenance: 'customer-stated',
    source: sourceFromStatement(statement),
  });
  return { id, kind: classification.kind, statement, signals: detectSignals(statement.text) };
}

function hasRequirement(items: readonly ExtractedItem[]): boolean {
  return items.some((item) => REQUIREMENT_KINDS.includes(item.kind));
}

/**
 * Text with no recognisable cue (another language, terse notes) still describes what the customer
 * wants, so its opening statements are kept as functional requirements for the reviewer to refine.
 */
function addFallbackRequirements(book: DraftBook, statements: readonly Statement[]): ExtractedItem[] {
  return statements
    .slice(0, FALLBACK_STATEMENT_LIMIT)
    .map((statement) => addStatedItem(book, statement, { kind: 'functional', cue: 'fallback', isQuestion: false }));
}

/** Customer-stated items (and customer-raised open points) for every classifiable statement. */
export function extractStatedItems(statements: readonly Statement[], book: DraftBook): ExtractedItem[] {
  const extracted: ExtractedItem[] = [];
  const unclassified: Statement[] = [];
  for (const statement of statements) {
    const classification = classifyStatement(statement);
    if (classification === null) {
      unclassified.push(statement);
    } else if (classification.kind === 'gap') {
      extracted.push(addOpenPoint(book, statement, classification));
    } else {
      extracted.push(addStatedItem(book, statement, classification));
    }
  }
  return hasRequirement(extracted) ? extracted : [...extracted, ...addFallbackRequirements(book, unclassified)];
}
