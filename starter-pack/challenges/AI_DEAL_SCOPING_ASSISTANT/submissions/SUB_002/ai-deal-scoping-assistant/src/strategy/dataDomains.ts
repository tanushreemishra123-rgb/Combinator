/**
 * Named data domains (DD_01, DD_02, ...): one per reviewed `data`-kind scope item, named and
 * described from that item's own text rather than a generic label (spec 4, "Major data domains").
 * Sources are grounded in two ways only - the item's own `relatedIds` (directly, or one hop through
 * a related integration) and an existing system's name literally appearing in the item's own text -
 * never a loosely shared taxonomy tag, which is what previously pulled in unrelated systems that
 * merely share a generic capability. Data the new solution
 * produces itself (conversation logs, audit logs, extraction results) is labelled as solution-sourced
 * instead of guessing an upstream system for it.
 */
import type { DataDomain, ScopeItem, ScopeModel } from '../domain';
import { hasSignalInGroup } from '../domain';
import { findScopeItem, idSequence } from './shared';

const NO_SOURCE_IDENTIFIED =
  'No existing system was named for this domain in the reviewed scope; treat it as captured directly by the new solution until the customer confirms an upstream source.';

const SOLUTION_PRODUCED_SOURCE =
  'Produced by the new solution itself as it runs (for example its own conversation, audit or extraction records); no upstream system holds this data today, so it is sourced from the application rather than an existing system.';

/** Phrases in a system's own text that mark it as being retired by this engagement rather than kept as an ongoing source. */
const RETIREMENT_PHRASES: readonly string[] = [
  'being replaced',
  'to be replaced',
  'being retired',
  'being decommissioned',
  'being sunset',
  'being phased out',
  'wants it eliminated',
  'wants eliminated',
  'eliminated entirely',
];

/** Phrases that mark a data item as something the new solution itself generates, not something an existing system already holds. */
const SOLUTION_PRODUCED_PHRASES: readonly string[] = ['conversation log', 'audit log', 'extraction result', 'session log', 'chat log', 'call transcript'];

const DATA_SIGNAL_PREFIX = 'data:';
/** Too common across unrelated domains to indicate a real sourcing relationship on its own. */
const EXCLUDED_DATA_SIGNALS: ReadonlySet<string> = new Set(['data:pii']);

/** Lower-cased title + description + source quote, with hyphens folded to spaces so "Conversation-log" still matches "conversation log". */
function searchableText(item: ScopeItem): string {
  const quote = item.source?.quote ?? '';
  return `${item.title} ${item.description} ${quote}`.toLowerCase().split('-').join(' ');
}

function isRetiring(system: ScopeItem): boolean {
  const text = searchableText(system);
  return RETIREMENT_PHRASES.some((phrase) => text.includes(phrase));
}

function isSolutionProduced(item: ScopeItem): boolean {
  const text = searchableText(item);
  return SOLUTION_PRODUCED_PHRASES.some((phrase) => text.includes(phrase));
}

/** A retiring system contributes a one-off migration source, never an ongoing one (spec: never invent an ongoing integration with a system the customer is retiring). */
function formatSource(system: ScopeItem): string {
  return isRetiring(system)
    ? `${system.title} (being retired by this engagement - contributes a one-off migration source only, not an ongoing feed)`
    : system.title;
}

function resolveSystem(scope: ScopeModel, candidate: ScopeItem): ScopeItem | undefined {
  if (candidate.kind === 'existingSystem') {
    return candidate;
  }
  if (candidate.kind !== 'integration') {
    return undefined;
  }
  for (const id of candidate.relatedIds) {
    const nested = findScopeItem(scope, id);
    if (nested !== undefined && nested.kind === 'existingSystem') {
      return nested;
    }
  }
  return undefined;
}

/** Existing systems this data item's own `relatedIds` name, directly or one hop through a related integration item. */
function relatedSystems(scope: ScopeModel, item: ScopeItem): ScopeItem[] {
  const systems: ScopeItem[] = [];
  for (const id of item.relatedIds) {
    const candidate = findScopeItem(scope, id);
    const system = candidate === undefined ? undefined : resolveSystem(scope, candidate);
    if (system !== undefined) {
      systems.push(system);
    }
  }
  return systems;
}

/** An existing system whose own title literally appears in this data item's title, description or source quote. */
function namedSystems(scope: ScopeModel, item: ScopeItem): ScopeItem[] {
  const text = searchableText(item);
  return scope.items.filter((candidate) => candidate.kind === 'existingSystem' && text.includes(candidate.title.toLowerCase()));
}

/** A single existing system uniquely tied to this data item through a shared, content-specific `data:*` signal; ambiguous (more than one candidate) is treated as no match, never a guess. */
function uniqueSignalSystem(scope: ScopeModel, item: ScopeItem): ScopeItem | undefined {
  const contentSignals = item.signals.filter((signal) => signal.startsWith(DATA_SIGNAL_PREFIX) && !EXCLUDED_DATA_SIGNALS.has(signal));
  if (contentSignals.length === 0) {
    return undefined;
  }
  const matched = new Map<string, ScopeItem>();
  for (const candidate of scope.items) {
    if (candidate.id === item.id || (candidate.kind !== 'existingSystem' && candidate.kind !== 'integration')) {
      continue;
    }
    if (!candidate.signals.some((signal) => contentSignals.includes(signal))) {
      continue;
    }
    const system = resolveSystem(scope, candidate);
    if (system !== undefined) {
      matched.set(system.id, system);
    }
  }
  const distinct = Array.from(matched.values());
  return distinct.length === 1 ? distinct.at(0) : undefined;
}

function dedupeSystems(systems: readonly ScopeItem[]): ScopeItem[] {
  const seen = new Map<string, ScopeItem>();
  for (const system of systems) {
    seen.set(system.id, system);
  }
  return Array.from(seen.values());
}

/** Existing systems and integrations that plausibly source this data domain, honestly empty when none is grounded. */
function sourcesFor(scope: ScopeModel, item: ScopeItem): string[] {
  const grounded = dedupeSystems([...relatedSystems(scope, item), ...namedSystems(scope, item)]);
  if (grounded.length > 0) {
    return grounded.map(formatSource);
  }
  if (isSolutionProduced(item)) {
    return [SOLUTION_PRODUCED_SOURCE];
  }
  const unique = uniqueSignalSystem(scope, item);
  return unique === undefined ? [NO_SOURCE_IDENTIFIED] : [formatSource(unique)];
}

export function classificationFor(item: ScopeItem): DataDomain['classification'] {
  const isRegulated = item.signals.includes('data:pii') || hasSignalInGroup(item.signals, 'compliance');
  return isRegulated ? 'regulated' : 'internal';
}

/** A trailing "(...)" qualifier duplicates information the description already carries, so the domain name drops it and stays short. */
const TRAILING_QUALIFIER = /\s*\([^)]+\)\s*$/;

/** Domain name derived from the item's own title, kept short by dropping a trailing parenthetical qualifier. */
export function domainNameFor(item: ScopeItem): string {
  const stripped = item.title.replace(TRAILING_QUALIFIER, '');
  return stripped.length > 0 ? stripped : item.title;
}

/** One named data domain per reviewed `data` item; falls back to a single platform-wide domain when none is reviewed yet. */
export function buildDataDomains(scope: ScopeModel, items: readonly ScopeItem[]): DataDomain[] {
  const nextId = idSequence('DD');
  const dataItems = items.filter((item) => item.kind === 'data');
  if (dataItems.length === 0) {
    return [
      {
        id: nextId(),
        name: 'Application Data',
        description:
          'No `data`-kind requirement has been reviewed yet; this placeholder domain covers whatever transactional data the reviewed functional and integration requirements imply until a dedicated data requirement is captured and approved.',
        sources: [NO_SOURCE_IDENTIFIED],
        owner: 'To be confirmed with customer',
        classification: 'internal',
        requirementIds: [],
      },
    ];
  }
  return dataItems.map((item) => ({
    id: nextId(),
    name: domainNameFor(item),
    description: item.description,
    sources: sourcesFor(scope, item),
    owner: 'To be confirmed with customer',
    classification: classificationFor(item),
    requirementIds: [item.id],
  }));
}
