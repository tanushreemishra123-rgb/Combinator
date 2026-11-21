/**
 * "Requirement summary" package section (spec 6): counts by kind, priority and provenance, the
 * per-requirement table every other section's requirement IDs can be cross-checked against, and the
 * context items (personas, existing systems, technology preferences, delivery constraints and
 * dependencies) that architecture and estimate rows cite by ID.
 */
import type { DocBlock, PackageSection, Priority, Provenance, ScopeItem, ScopeItemKind, ScopeModel, ScopingSession } from '../../domain';
import { PrioritySchema, ProvenanceSchema } from '../../domain';
import {
  compareScopeItems,
  getActiveItems,
  getInScopeItemsByKind,
  getRequirements,
  kindLabel,
  provenanceLabel,
  SCOPE_KIND_ORDER,
} from '../../scope';
import { headingBlock, notGeneratedCallout, refsCell, sourceReferenceText, tableOrParagraph } from '../text';

/** One row per distinct value actually present, in the vocabulary's canonical display order. */
function orderedCounts<T extends string>(values: readonly T[], order: readonly T[], labelOf: (value: T) => string): DocBlock {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  const rows = order.filter((value) => counts.has(value)).map((value): string[] => [labelOf(value), String(counts.get(value) ?? 0)]);
  return tableOrParagraph(['Category', 'Count'], rows, 'Nothing to count yet.');
}

const TABLE_COLUMNS = ['ID', 'Type', 'Priority', 'Provenance', 'Source reference', 'Related IDs'] as const;
const CONTEXT_COLUMNS = ['ID', 'Type', 'Title: description', 'Provenance', 'Source reference'] as const;

/** Scope kinds that frame the requirements rather than being delivered: listed so every cited ID is defined. */
const CONTEXT_KINDS: readonly ScopeItemKind[] = ['persona', 'existingSystem', 'technology', 'constraint', 'dependency'];

function contextItems(scope: ScopeModel): ScopeItem[] {
  return CONTEXT_KINDS.flatMap((kind) => getInScopeItemsByKind(scope, kind)).sort(compareScopeItems);
}

function contextRow(item: ScopeItem): string[] {
  return [item.id, kindLabel(item.kind), `${item.title}: ${item.description}`, provenanceLabel(item.provenance), sourceReferenceText(item.source)];
}

/** Provenance over every in-scope item, so AI-inferred personas and assumed items are counted too. */
function provenanceOfScope(scope: ScopeModel): Provenance[] {
  return getActiveItems(scope)
    .filter((item) => item.inScope)
    .map((item) => item.provenance);
}

export function buildRequirementSummarySection(session: ScopingSession): PackageSection {
  if (session.scope === null) {
    return {
      id: 'requirement-summary',
      title: 'Requirement summary',
      blocks: [notGeneratedCallout('no requirements have been analysed and approved yet')],
    };
  }
  const requirements = [...getRequirements(session.scope)].sort(compareScopeItems);
  const rows = requirements.map((item) => [
    item.id,
    kindLabel(item.kind),
    item.priority,
    provenanceLabel(item.provenance),
    sourceReferenceText(item.source),
    refsCell(item.relatedIds),
  ]);
  return {
    id: 'requirement-summary',
    title: 'Requirement summary',
    blocks: [
      headingBlock(3, 'Counts by requirement type'),
      orderedCounts<ScopeItemKind>(requirements.map((item) => item.kind), SCOPE_KIND_ORDER, kindLabel),
      headingBlock(3, 'Counts by priority'),
      orderedCounts<Priority>(requirements.map((item) => item.priority), PrioritySchema.options, (priority) => priority),
      headingBlock(3, 'Counts by provenance (all in-scope items)'),
      orderedCounts<Provenance>(provenanceOfScope(session.scope), ProvenanceSchema.options, provenanceLabel),
      headingBlock(3, 'Reviewed requirements'),
      tableOrParagraph([...TABLE_COLUMNS], rows, 'No requirements were approved into scope.'),
      headingBlock(3, 'Context and constraints'),
      tableOrParagraph([...CONTEXT_COLUMNS], contextItems(session.scope).map(contextRow), 'No personas, existing systems, technology preferences, constraints or dependencies were recorded.'),
    ],
  };
}
