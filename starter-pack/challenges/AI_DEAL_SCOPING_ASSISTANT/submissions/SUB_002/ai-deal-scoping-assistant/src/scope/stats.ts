/** Summary counts the review workspace and the exported package header can render directly. */
import type { Provenance, ReviewStatus, ScopeItemKind, ScopeModel } from '../domain';
import {
  kindLabel,
  PROVENANCE_ORDER,
  provenanceLabel,
  REVIEW_STATUS_ORDER,
  reviewLabel,
  SCOPE_KIND_ORDER,
} from './labels';
import { isScopeApproved } from './model';
import { getExcludedRequirements, getOpenGaps, getOpenQuestions, getRequirements, getUnvalidatedAssumptions } from './selectors';

export interface ScopeCountByKind {
  kind: ScopeItemKind;
  label: string;
  count: number;
}

export interface ScopeCountByProvenance {
  provenance: Provenance;
  label: string;
  count: number;
}

export interface ScopeCountByReview {
  review: ReviewStatus;
  label: string;
  count: number;
}

export interface ScopeStats {
  totalItems: number;
  byKind: ScopeCountByKind[];
  byProvenance: ScopeCountByProvenance[];
  byReview: ScopeCountByReview[];
  requirementCount: number;
  excludedRequirementCount: number;
  openQuestionCount: number;
  unvalidatedAssumptionCount: number;
  openGapCount: number;
  approved: boolean;
}

function countBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, number> {
  const counts = new Map<K, number>();
  for (const item of items) {
    const key = keyOf(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Rolls the model up into the counts the review workspace and package header show: how many items
 * of each kind/provenance/review status exist, plus the outstanding-work counts (excluded
 * requirements, open questions, unvalidated assumptions, open gaps) that tell a reviewer whether
 * the scope is ready to approve.
 */
export function scopeStats(scope: ScopeModel): ScopeStats {
  const kindCounts = countBy(scope.items, (item) => item.kind);
  const provenanceCounts = countBy(scope.items, (item) => item.provenance);
  const reviewCounts = countBy(scope.items, (item) => item.review);

  return {
    totalItems: scope.items.length,
    byKind: SCOPE_KIND_ORDER.map((kind) => ({ kind, label: kindLabel(kind), count: kindCounts.get(kind) ?? 0 })),
    byProvenance: PROVENANCE_ORDER.map((provenance) => ({
      provenance,
      label: provenanceLabel(provenance),
      count: provenanceCounts.get(provenance) ?? 0,
    })),
    byReview: REVIEW_STATUS_ORDER.map((review) => ({ review, label: reviewLabel(review), count: reviewCounts.get(review) ?? 0 })),
    requirementCount: getRequirements(scope).length,
    excludedRequirementCount: getExcludedRequirements(scope).length,
    openQuestionCount: getOpenQuestions(scope).length,
    unvalidatedAssumptionCount: getUnvalidatedAssumptions(scope).length,
    openGapCount: getOpenGaps(scope).length,
    approved: isScopeApproved(scope),
  };
}
