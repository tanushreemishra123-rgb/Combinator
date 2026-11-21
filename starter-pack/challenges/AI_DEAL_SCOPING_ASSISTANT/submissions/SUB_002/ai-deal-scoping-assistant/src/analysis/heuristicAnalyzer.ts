/**
 * Deterministic heuristic analysis engine - the mock provider's "model" for arbitrary pasted text.
 *
 * Pipeline: segment -> de-duplicate -> classify and extract customer-stated items -> infer implied
 * capabilities, personas, systems, dependencies and risks -> raise gaps, questions and working assumptions ->
 * verify every quote against the source. The same input always yields the same output; nothing is
 * keyed on a scenario id, so reviewers can paste their own text.
 */
import type { AnalyzeContext } from '../ai/types';
import type { AnalysisOutput } from '../domain';
import { DraftBook } from './draftBook';
import { extractStatedItems } from './extraction';
import { buildDocumentFacts, raiseAmbiguityAssumptions, raiseChecklistGaps, raiseIntegrationReadinessGaps } from './gaps';
import { groundScopeItems } from './grounding';
import { inferImpliedCapabilities } from './impliedCapabilities';
import { inferPersonas, inferRisks, inferSystemsAndDependencies } from './inference';
import { dedupeStatements, segmentDocument } from './segmentation';
import { rankSignalThemes } from './signals';
import { buildAnalysisSummary } from './summary';

const SUMMARY_THEME_LIMIT = 4;

/** Deterministic heuristic analysis engine used by the mock provider for arbitrary text. */
export function planAnalysis(context: AnalyzeContext): AnalysisOutput {
  const statements = dedupeStatements(segmentDocument(context.document));
  const book = new DraftBook();

  const extracted = extractStatedItems(statements, book);
  inferImpliedCapabilities(extracted, book);
  inferPersonas(extracted, book);
  const integrationLinks = inferSystemsAndDependencies(extracted, book);
  inferRisks(extracted, book);

  const facts = buildDocumentFacts(context.document, statements, context.customer);
  raiseIntegrationReadinessGaps(integrationLinks, book);
  raiseChecklistGaps(facts, extracted, book);
  raiseAmbiguityAssumptions(extracted, book);

  const items = groundScopeItems(book.toDrafts(), context.document).items;
  const statedSignals = extracted.filter((item) => item.kind !== 'gap').map((item) => item.signals);
  const themes = rankSignalThemes(statedSignals, SUMMARY_THEME_LIMIT);
  return {
    summary: buildAnalysisSummary({ customer: context.customer, items, statementCount: statements.length, themes }),
    items,
  };
}
