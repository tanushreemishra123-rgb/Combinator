/**
 * Pure, immutable scope-model management: the review, edit and approval workflow for the shared
 * scope model (spec section 1) plus the selectors and coverage-adjacent helpers every downstream
 * module reads it through (spec section 2). See `model.ts` for the mutating functions and their
 * versioning/approval rules, `selectors.ts` for the read-only views, `stats.ts` for the review
 * workspace summary, and `labels.ts` for the shared display vocabulary.
 */
export * from './errors';
export * from './exclusion';
export * from './labels';
export * from './model';
export * from './selectors';
export * from './stats';
export type { NewScopeItemFields, ScopeDraftInput, ScopeItemPatch } from './types';
