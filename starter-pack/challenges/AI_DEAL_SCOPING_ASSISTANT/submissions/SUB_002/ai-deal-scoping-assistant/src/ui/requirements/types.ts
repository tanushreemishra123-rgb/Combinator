/** Local, workspace-only types (filters, kind groups, step ids) - never part of the shared session shape. */
import type { EstimationInputKey, Priority, Provenance, ReviewStatus, ScopeItemKind } from '../../domain';

/** The four spec-named steps this workspace walks the reviewer through. */
export type RequirementsStepId = 'understand' | 'review' | 'clarify' | 'approve';

export interface RequirementsStepDef {
  id: RequirementsStepId;
  label: string;
}

export const REQUIREMENTS_STEPS: readonly RequirementsStepDef[] = [
  { id: 'understand', label: 'Understand the customer need' },
  { id: 'review', label: 'Review the extracted scope' },
  { id: 'clarify', label: 'Clarify missing information' },
  { id: 'approve', label: 'Approve the requirements' },
];

/** The three kind-group tabs the "Review the extracted scope" step filters by. */
export type ScopeKindGroupId = 'requirements' | 'context' | 'missing';

export interface ScopeKindGroupDef {
  id: ScopeKindGroupId;
  label: string;
  kinds: readonly ScopeItemKind[];
}

export const SCOPE_KIND_GROUPS: readonly ScopeKindGroupDef[] = [
  { id: 'requirements', label: 'Requirements', kinds: ['business', 'functional', 'nonFunctional', 'integration', 'data', 'security'] },
  { id: 'context', label: 'Context', kinds: ['persona', 'existingSystem', 'technology', 'constraint', 'dependency', 'risk'] },
  { id: 'missing', label: 'Missing information', kinds: ['gap', 'assumption', 'question'] },
];

export function groupForKind(kind: ScopeItemKind): ScopeKindGroupId {
  const group = SCOPE_KIND_GROUPS.find((candidate) => candidate.kinds.includes(kind));
  return group?.id ?? 'requirements';
}

export const PROVENANCE_FILTER_OPTIONS: readonly Provenance[] = ['customer-stated', 'ai-inferred', 'assumed'];
export const PRIORITY_FILTER_OPTIONS: readonly Priority[] = ['High', 'Medium', 'Low'];
export const REVIEW_FILTER_OPTIONS: readonly ReviewStatus[] = ['pending', 'approved', 'rejected'];

export type FilterValue<T extends string> = T | 'all';

export interface ScopeFilterState {
  kindGroup: ScopeKindGroupId;
  provenance: FilterValue<Provenance>;
  priority: FilterValue<Priority>;
  review: FilterValue<ReviewStatus>;
  search: string;
}

export function defaultScopeFilterState(kindGroup: ScopeKindGroupId = 'requirements'): ScopeFilterState {
  return { kindGroup, provenance: 'all', priority: 'all', review: 'all', search: '' };
}

/** Human labels for the estimation/design inputs a gap or open question can leave unknown. */
const ESTIMATION_INPUT_LABELS: ReadonlyMap<EstimationInputKey, string> = new Map([
  ['expectedUsers', 'Expected users'],
  ['environments', 'Environments'],
  ['deliveryDeadline', 'Delivery deadline'],
  ['integrationReadiness', 'Integration readiness'],
  ['dataVolume', 'Data volume'],
  ['complianceScope', 'Compliance scope'],
  ['aiDataAvailability', 'AI data availability'],
  ['targetRegions', 'Target regions'],
]);

export function estimationInputLabel(key: EstimationInputKey): string {
  return ESTIMATION_INPUT_LABELS.get(key) ?? 'Estimation input';
}
