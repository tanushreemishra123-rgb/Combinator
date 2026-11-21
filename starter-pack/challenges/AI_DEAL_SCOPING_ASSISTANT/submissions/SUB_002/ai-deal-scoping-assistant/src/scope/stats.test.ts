import { describe, expect, it } from 'vitest';
import { fixtureScope } from '../test/fixtures';
import { setItemReview } from './model';
import { scopeStats } from './stats';

describe('scopeStats', () => {
  it('counts every kind, provenance and review status, including zero counts', () => {
    const stats = scopeStats(fixtureScope());
    expect(stats.totalItems).toBe(fixtureScope().items.length);
    // fixtureScope has no 'existingSystem'-kind rejection, but every kind must still appear.
    expect(stats.byKind.map((row) => row.kind)).toContain('existingSystem');
    expect(stats.byKind.find((row) => row.kind === 'functional')?.count).toBe(3);
    expect(stats.byReview.find((row) => row.review === 'rejected')?.count).toBe(0);
    expect(stats.byProvenance.find((row) => row.provenance === 'assumed')?.count).toBeGreaterThan(0);
  });

  it('rolls up the outstanding-work counts used by the review workspace', () => {
    const stats = scopeStats(fixtureScope());
    expect(stats.openQuestionCount).toBe(2);
    expect(stats.unvalidatedAssumptionCount).toBe(1);
    expect(stats.openGapCount).toBe(1);
    expect(stats.requirementCount).toBeGreaterThan(0);
    expect(stats.excludedRequirementCount).toBe(0);
  });

  it('reflects the approval state', () => {
    expect(scopeStats(fixtureScope()).approved).toBe(true);

    const unapproved = setItemReview(fixtureScope(), 'FR_02', 'approved');
    expect(scopeStats(unapproved).approved).toBe(false);
  });
});
