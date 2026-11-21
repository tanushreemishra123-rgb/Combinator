/**
 * Reads concrete service names straight off the reviewed architecture's components instead of a
 * hardcoded per-cloud list, so a platform switch (AWS/Azure/GCP) changes every strategy paragraph
 * that cites a service without any strategy-side lookup table to keep in sync.
 */
import type { ArchitectureArea, ArchitectureComponent } from '../domain';

export interface ComponentQuery {
  /** Architecture areas to search, e.g. ['data-storage']. */
  areas: readonly ArchitectureArea[];
  /** Prefer components whose logical component / name / service contains one of these (case-insensitive). */
  includeKeywords?: readonly string[];
  /** Drop components whose logical component / name / service contains one of these first. */
  excludeKeywords?: readonly string[];
  /**
   * When true and `includeKeywords` matches nothing, return no components instead of falling back
   * to every component left in the area - so a topic that needs a genuinely dedicated service (an
   * analytical store, a reporting service) says no such service is selected yet rather than naming
   * an unrelated one (e.g. a BI tool or a cache) that merely happens to sit in the same area.
   */
  strict?: boolean;
}

function searchableText(component: ArchitectureComponent): string {
  return `${component.logicalComponent} ${component.name} ${component.service}`.toLowerCase();
}

function excludeByKeyword(components: readonly ArchitectureComponent[], keywords: readonly string[]): ArchitectureComponent[] {
  if (keywords.length === 0) {
    return [...components];
  }
  return components.filter((component) => !keywords.some((keyword) => searchableText(component).includes(keyword)));
}

/** Keyword filter that falls back to the unfiltered set rather than returning nothing, unless `strict` says a query with no match should return nothing instead of an unrelated component. */
function preferByKeyword(components: readonly ArchitectureComponent[], keywords: readonly string[], strict: boolean): ArchitectureComponent[] {
  if (keywords.length === 0) {
    return [...components];
  }
  const matched = components.filter((component) => keywords.some((keyword) => searchableText(component).includes(keyword)));
  if (matched.length > 0) {
    return matched;
  }
  return strict ? [] : [...components];
}

/**
 * Components matching an area/keyword query. Falls back progressively (drop include-keywords, then
 * exclude-keywords) so a sparse architecture still surfaces the closest component rather than none,
 * which keeps generated paragraphs grounded in the design instead of falling back to filler text.
 */
export function findComponents(components: readonly ArchitectureComponent[], query: ComponentQuery): ArchitectureComponent[] {
  const inArea = components.filter((component) => query.areas.includes(component.area));
  const afterExclude = excludeByKeyword(inArea, query.excludeKeywords ?? []);
  return preferByKeyword(afterExclude, query.includeKeywords ?? [], query.strict ?? false);
}

/** Distinct concrete service names for a set of components, in encounter order. */
export function serviceNames(components: readonly ArchitectureComponent[]): string[] {
  return Array.from(new Set(components.map((component) => component.service)));
}

export function componentIdsOf(components: readonly ArchitectureComponent[]): string[] {
  return components.map((component) => component.id);
}
