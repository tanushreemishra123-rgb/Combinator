/** Resolves a scope-item id (typically an assumption cited by an architecture component) to a
 * readable "ID - Title" label instead of showing a bare id to the reviewer. */
import type { ScopeModel } from '../../domain';

export function resolveScopeItemLabel(scope: ScopeModel | null, id: string): string {
  const item = scope?.items.find((candidate) => candidate.id === id);
  return item === undefined ? id : `${item.id} - ${item.title}`;
}
