/**
 * Display vocabulary for the scope model. Labels follow the wording of the challenge specification
 * so the review workspace, the coverage view and the exported package all use the same nouns.
 */
import { ScopeItemKindSchema } from '../domain';
import type { Provenance, ReviewStatus, ScopeItem, ScopeItemKind } from '../domain';

interface KindVocabulary {
  /** Label of a single item, e.g. in a table cell or badge. */
  singular: string;
  /** Heading of the group of items, matching the specification's analysis checklist. */
  group: string;
}

const KIND_VOCABULARY: ReadonlyMap<ScopeItemKind, KindVocabulary> = new Map([
  ['business', { singular: 'Business objective', group: 'Business objectives' }],
  ['persona', { singular: 'Persona', group: 'Target users and personas' }],
  ['functional', { singular: 'Functional requirement', group: 'Functional requirements' }],
  ['nonFunctional', { singular: 'Non-functional requirement', group: 'Non-functional requirements' }],
  ['existingSystem', { singular: 'Existing system', group: 'Existing systems' }],
  ['integration', { singular: 'Integration', group: 'Integrations' }],
  ['data', { singular: 'Data requirement', group: 'Data requirements' }],
  ['security', { singular: 'Security and compliance', group: 'Security and compliance expectations' }],
  ['technology', { singular: 'Technology preference', group: 'Technology preferences' }],
  ['constraint', { singular: 'Delivery constraint', group: 'Delivery constraints' }],
  ['dependency', { singular: 'Dependency', group: 'Dependencies' }],
  ['risk', { singular: 'Risk', group: 'Risks' }],
  ['gap', { singular: 'Missing information', group: 'Missing information' }],
  ['assumption', { singular: 'Assumption', group: 'Assumptions' }],
  ['question', { singular: 'Clarification question', group: 'Clarification questions' }],
]);

const PROVENANCE_LABELS: ReadonlyMap<Provenance, string> = new Map([
  ['customer-stated', 'Customer-stated'],
  ['ai-inferred', 'AI-inferred'],
  ['assumed', 'Assumed'],
]);

const REVIEW_LABELS: ReadonlyMap<ReviewStatus, string> = new Map([
  ['pending', 'Pending review'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
]);

/** Canonical display order of the kinds: the order of the specification's analysis checklist. */
export const SCOPE_KIND_ORDER: readonly ScopeItemKind[] = ScopeItemKindSchema.options;

export const PROVENANCE_ORDER: readonly Provenance[] = ['customer-stated', 'ai-inferred', 'assumed'];

export const REVIEW_STATUS_ORDER: readonly ReviewStatus[] = ['pending', 'approved', 'rejected'];

export function kindLabel(kind: ScopeItemKind): string {
  return KIND_VOCABULARY.get(kind)?.singular ?? 'Scope item';
}

/** Plural heading for a group of items of one kind (e.g. 'Clarification questions'). */
export function kindGroupLabel(kind: ScopeItemKind): string {
  return KIND_VOCABULARY.get(kind)?.group ?? 'Scope items';
}

export function provenanceLabel(provenance: Provenance): string {
  return PROVENANCE_LABELS.get(provenance) ?? 'Assumed';
}

export function reviewLabel(review: ReviewStatus): string {
  return REVIEW_LABELS.get(review) ?? 'Pending review';
}

/**
 * Sort comparator: specification kind order first, then structured ID. The ID comparison is
 * numeric-aware so FR_9 sorts before FR_10 and FR_100 after FR_99.
 */
export function compareScopeItems(a: Pick<ScopeItem, 'id' | 'kind'>, b: Pick<ScopeItem, 'id' | 'kind'>): number {
  const kindDelta = SCOPE_KIND_ORDER.indexOf(a.kind) - SCOPE_KIND_ORDER.indexOf(b.kind);
  return kindDelta !== 0 ? kindDelta : a.id.localeCompare(b.id, 'en', { numeric: true });
}
