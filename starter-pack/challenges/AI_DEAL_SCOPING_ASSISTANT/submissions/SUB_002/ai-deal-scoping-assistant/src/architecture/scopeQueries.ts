/**
 * Small, reusable read-only queries over the reviewed scope model. Both the platform recommender
 * and the architecture planner key off deterministic signals (see src/domain/signals.ts) rather
 * than free text, so every derived output stays traceable back to specific scope item ids.
 */
import type { ScopeItem, ScopeItemKind, ScopeModel, SignalGroup } from '../domain';
import { hasSignalInGroup } from '../domain';

/** In-scope items only - excluded items never justify a generated output. */
export function inScopeItems(scope: ScopeModel): ScopeItem[] {
  return scope.items.filter((item) => item.inScope);
}

export function itemsOfKind(scope: ScopeModel, kind: ScopeItemKind): ScopeItem[] {
  return inScopeItems(scope).filter((item) => item.kind === kind);
}

/** In-scope items whose kind is any of the given kinds. */
export function itemsOfKinds(scope: ScopeModel, kinds: readonly ScopeItemKind[]): ScopeItem[] {
  return inScopeItems(scope).filter((item) => kinds.includes(item.kind));
}

/** In-scope items carrying at least one signal from the given group (e.g. any 'ai:*' signal). */
export function itemsInSignalGroup(scope: ScopeModel, group: SignalGroup): ScopeItem[] {
  return inScopeItems(scope).filter((item) => hasSignalInGroup(item.signals, group));
}

/** In-scope items carrying a signal from any of the given groups. */
export function itemsInAnySignalGroup(scope: ScopeModel, groups: readonly SignalGroup[]): ScopeItem[] {
  return inScopeItems(scope).filter((item) => groups.some((group) => hasSignalInGroup(item.signals, group)));
}

/** In-scope items carrying any of the given exact signal ids. */
export function itemsWithAnySignal(scope: ScopeModel, signalIds: readonly string[]): ScopeItem[] {
  return inScopeItems(scope).filter((item) => item.signals.some((signal) => signalIds.includes(signal)));
}

export function idsOf(items: readonly ScopeItem[]): string[] {
  return items.map((item) => item.id);
}

/** Reviewed (approved) assumptions, used as the last-resort justification for a component. */
export function reviewedAssumptions(scope: ScopeModel): ScopeItem[] {
  return itemsOfKind(scope, 'assumption').filter((item) => item.review === 'approved');
}

function sharedSignalCount(a: ScopeItem, b: ScopeItem): number {
  return a.signals.filter((signal) => b.signals.includes(signal)).length;
}

/**
 * existingSystem items sharing a signal with the given item - the concrete system(s) it talks to -
 * most specific (most shared signals) first, so a caller that takes only the top match (buildFlows)
 * lands on the system this item actually resembles rather than the first one in scope order that
 * happens to share a single generic signal (e.g. a broad 'capability:forms' tag).
 */
export function matchingExternalSystems(scope: ScopeModel, item: ScopeItem): ScopeItem[] {
  return itemsOfKind(scope, 'existingSystem')
    .map((system) => ({ system, shared: sharedSignalCount(item, system) }))
    .filter((match) => match.shared > 0)
    .sort((a, b) => b.shared - a.shared)
    .map((match) => match.system);
}

/**
 * Titles of the existingSystem items related to any of the given items, deduplicated by the
 * underlying system so the same real system is never listed twice under two different labels (once
 * plain, once with a '(later phase)' suffix) just because two different citing items both happen to
 * match it. A system is flagged later-phase when any item that matches it is itself later-phase. This
 * is the only external-system detail a component's Dependencies column may show, alongside other
 * architecture component names - never a dependency/risk item's own narrative title (spec section 3:
 * a component's dependencies name other components or named systems, not a free-text note).
 */
export function relatedExternalSystemTitles(scope: ScopeModel, items: readonly ScopeItem[]): string[] {
  const laterPhaseBySystemId = new Map<string, boolean>();
  const orderedSystemIds: string[] = [];
  for (const item of items) {
    for (const system of matchingExternalSystems(scope, item)) {
      const alreadyLaterPhase = laterPhaseBySystemId.get(system.id) ?? false;
      if (!laterPhaseBySystemId.has(system.id)) {
        orderedSystemIds.push(system.id);
      }
      laterPhaseBySystemId.set(system.id, alreadyLaterPhase || isLaterPhase(item));
    }
  }
  const systemById = new Map(itemsOfKind(scope, 'existingSystem').map((system) => [system.id, system]));
  return orderedSystemIds.map((systemId) => {
    const title = systemById.get(systemId)?.title ?? '';
    return (laterPhaseBySystemId.get(systemId) ?? false) ? appendPhaseSuffix(title) : title;
  });
}

/** True when any in-scope item carries a signal starting with one of the given prefixes. */
export function hasAnySignal(scope: ScopeModel, signalIds: readonly string[]): boolean {
  return itemsWithAnySignal(scope, signalIds).length > 0;
}

/**
 * Terms that mark a persona as an external end user (a customer, member, patient and so on) rather
 * than internal staff of the organisation commissioning the solution. When no reviewed persona
 * mentions any of these, the generated narrative avoids default consumer-facing language (spec
 * section 3: match the wording to the audience the customer actually described).
 */
const EXTERNAL_PERSONA_TERMS: readonly string[] = [
  'customer',
  'member',
  'patient',
  'client',
  'citizen',
  'shopper',
  'buyer',
  'guest',
  'public',
  'consumer',
  'subscriber',
  'resident',
  'applicant',
  'policyholder',
];

function mentionsExternalAudience(persona: ScopeItem): boolean {
  const text = `${persona.title} ${persona.description}`.toLowerCase();
  return EXTERNAL_PERSONA_TERMS.some((term) => text.includes(term));
}

/** True only when every reviewed persona reads as internal staff; never true when no persona exists yet. */
export function isInternalOnlyAudience(scope: ScopeModel): boolean {
  const personas = itemsOfKind(scope, 'persona');
  return personas.length > 0 && personas.every((persona) => !mentionsExternalAudience(persona));
}

/** Phrases the analysis stage appends to a title/description when a requirement is explicitly deferred. */
const LATER_PHASE_TERMS: readonly string[] = ['later phase', 'not required for go-live', 'future candidate', 'not in scope for this phase'];

/** True when the item's own text already marks it as deferred past go-live. */
export function isLaterPhase(item: ScopeItem): boolean {
  const text = `${item.title} ${item.description}`.toLowerCase();
  return LATER_PHASE_TERMS.some((term) => text.includes(term));
}

/** Appends '(later phase)' to a label, unless it already reads that way. */
function appendPhaseSuffix(label: string): string {
  return label.toLowerCase().includes('later phase') ? label : `${label} (later phase)`;
}

/** Appends a '(later phase)' note to a label when its driving item is deferred and the label does not already say so. */
export function labelWithPhaseNote(label: string, item: ScopeItem): string {
  return isLaterPhase(item) ? appendPhaseSuffix(label) : label;
}

/** Joins strings the way generated narrative lists them: "a", "a and b", or "a, b and c". */
export function formatList(parts: readonly string[]): string {
  if (parts.length <= 1) {
    return parts.at(0) ?? '';
  }
  if (parts.length === 2) {
    return `${parts.at(0)} and ${parts.at(1)}`;
  }
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}
