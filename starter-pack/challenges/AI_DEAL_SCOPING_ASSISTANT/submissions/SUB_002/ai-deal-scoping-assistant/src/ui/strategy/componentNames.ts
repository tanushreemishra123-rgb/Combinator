/**
 * Resolves architecture component ids (as cited by an integration's `componentIds`) to their
 * design-time name and service, so the integration inventory never shows a bare "ARC_04" to a
 * reviewer.
 */
import type { ArchitectureComponent, ArchitectureDesign } from '../../domain';

export function buildComponentLookup(design: ArchitectureDesign | null): ReadonlyMap<string, ArchitectureComponent> {
  if (design === null) {
    return new Map();
  }
  return new Map(design.components.map((component) => [component.id, component]));
}

/** Readable "Name (Service)" labels for known ids; an id the design no longer has is dropped, not shown raw. */
export function componentLabelsFor(ids: readonly string[], lookup: ReadonlyMap<string, ArchitectureComponent>): string[] {
  const labels: string[] = [];
  for (const id of ids) {
    const component = lookup.get(id);
    if (component !== undefined) {
      labels.push(`${component.name} (${component.service})`);
    }
  }
  return labels;
}
