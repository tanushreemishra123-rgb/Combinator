/** Input shapes accepted by the scope-model management functions. */
import type { ScopeItem, ScopeItemDraft } from '../domain';

/**
 * Fields a reviewer may change on an existing scope item. `signals` is included so the caller can
 * refresh the taxonomy tags (analysis `detectSignals`) after a wording change; identity (`id`,
 * `kind`), review state and resolution are changed through their dedicated functions instead.
 */
export type ScopeItemPatch = Partial<
  Pick<
    ScopeItem,
    'title' | 'description' | 'priority' | 'provenance' | 'relatedIds' | 'inScope' | 'critical' | 'affectsInputs' | 'signals'
  >
>;

/** An analysis draft, optionally already tagged with taxonomy signals by the analysis stage. */
export type ScopeDraftInput = ScopeItemDraft & { readonly signals?: readonly string[] };

/** Fields for an item the reviewer adds by hand; only title, description and priority are required. */
export type NewScopeItemFields = Pick<ScopeItem, 'title' | 'description' | 'priority'> &
  Partial<Pick<ScopeItem, 'relatedIds' | 'critical' | 'affectsInputs' | 'signals'>>;
