/** Maps a scope item's grounding provenance to the content label shown on generated statements. */
import type { ContentLabel, Provenance, ScopeItem, ScopeItemKind, TracedStatement } from '../domain';

const PROVENANCE_TO_LABEL: ReadonlyMap<Provenance, ContentLabel> = new Map([
  ['customer-stated', 'customer-requested'],
  ['ai-inferred', 'ai-interpretation'],
  ['assumed', 'assumption-to-confirm'],
]);

/** How a reviewer's resolution reads for each resolvable kind. */
const RESOLUTION_WORDS: ReadonlyMap<ScopeItemKind, string> = new Map([
  ['question', 'Answered'],
  ['assumption', 'Validated'],
  ['gap', 'Closed'],
]);

export function labelForProvenance(provenance: Provenance): ContentLabel {
  return PROVENANCE_TO_LABEL.get(provenance) ?? 'ai-interpretation';
}

/**
 * The PRD statement for one scope item. A question the reviewer answered, an assumption they
 * validated or a gap they closed carries that resolution and is no longer labelled as an
 * assumption to confirm, so a regenerated PRD never presents settled points as still open.
 */
export function statementForScopeItem(item: ScopeItem): TracedStatement {
  const text = `${item.id} - ${item.title}: ${item.description}`;
  const label = labelForProvenance(item.provenance);
  const word = RESOLUTION_WORDS.get(item.kind);
  if (!item.resolved || word === undefined) {
    return { text, refs: [item.id], label };
  }
  const resolution = item.resolution.trim();
  const tail = resolution.length > 0 ? `${word}: ${resolution}` : `${word} by the reviewer.`;
  return { text: `${text} ${tail}`, refs: [item.id], label: label === 'assumption-to-confirm' ? 'ai-interpretation' : label };
}
