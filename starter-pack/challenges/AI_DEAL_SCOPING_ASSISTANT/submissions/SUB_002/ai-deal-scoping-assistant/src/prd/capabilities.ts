/**
 * Groups reviewed requirements into capabilities using the signal -> capability catalog
 * (capabilityCatalog.data.ts). A requirement can carry several signals (e.g. a functional
 * requirement tagged both `capability:identity` and `security:sso`) and is cited by every
 * capability its signals resolve to; a requirement with no matching signal is cited by
 * `Core Platform Services` so nothing in the reviewed scope is left out of the functional scope.
 */
import { detectSignals } from '../analysis/signals';
import { formatId } from '../domain/ids';
import type { Capability, ContentLabel, Priority, ScopeItem, ScopeItemKind, ScopeModel } from '../domain';
import { getInScopeItemsByKind, getRequirements } from '../scope';
import type { CapabilityCatalogEntry } from './capabilityCatalog.data';
import { CORE_PLATFORM_CAPABILITY, findCatalogEntry } from './capabilityCatalog.data';
import { higherPriority } from './priority';

interface CapabilityDraft {
  entry: CapabilityCatalogEntry;
  requirementIds: string[];
}

function findScopeItem(scope: ScopeModel, id: string): ScopeItem | undefined {
  return scope.items.find((item) => item.id === id);
}

/**
 * Which requirement kinds may drive each signal group's capabilities: a product capability signal
 * (`capability:*`, `ai:*`) only means something when a functional or business item actually asks
 * for it, an `integration:*` signal only when an integration item describes the exchange, a
 * `data:*` signal only when a data item describes the domain, and a `security:*` signal only when
 * a security or non-functional item states the control. Without this gate, a word like "portal" or
 * "classify" used in passing inside an unrelated NFR, integration or data item force-fits a whole
 * product capability onto a requirement that never asked for one.
 */
const SIGNAL_GROUP_KINDS: ReadonlyMap<string, readonly ScopeItemKind[]> = new Map([
  ['capability', ['functional', 'business']],
  ['ai', ['functional', 'business']],
  ['integration', ['integration']],
  ['data', ['data']],
  ['security', ['security', 'nonFunctional']],
]);

/** True when a signal's group is allowed to drive a capability for this requirement's kind (an unlisted group, e.g. `nfr:`, is never routed at all). */
function signalMatchesKind(signal: string, kind: ScopeItemKind): boolean {
  const group = signal.split(':').at(0) ?? '';
  const allowedKinds = SIGNAL_GROUP_KINDS.get(group);
  return allowedKinds !== undefined && allowedKinds.includes(kind);
}

function catalogEntriesFor(signals: readonly string[], kind: ScopeItemKind): CapabilityCatalogEntry[] {
  return signals
    .filter((signal) => signalMatchesKind(signal, kind))
    .map((signal) => findCatalogEntry(signal))
    .filter((entry): entry is CapabilityCatalogEntry => entry !== undefined);
}

/** Kinds whose description routinely mentions neighbouring features, so their title decides the capability when it can. */
const TITLE_FIRST_KINDS: readonly ScopeItemKind[] = ['functional', 'business'];

/**
 * Resolves the catalog entries a requirement belongs to. For functional and business items the
 * title names what the requirement is about, while the description often mentions neighbouring
 * things ("...photos, estimates and police reports"), so signals found in the title decide alone
 * when there are any. Security, data and integration statements legitimately bundle several
 * controls in one sentence, so all of their signals count. Core Platform Services catches a
 * requirement that matches nothing.
 */
function entriesForRequirement(requirement: ScopeItem): CapabilityCatalogEntry[] {
  if (TITLE_FIRST_KINDS.includes(requirement.kind)) {
    const titleSignals = detectSignals(requirement.title).filter((signal) => requirement.signals.includes(signal));
    const fromTitle = catalogEntriesFor(titleSignals, requirement.kind);
    if (fromTitle.length > 0) {
      return fromTitle;
    }
  }
  const matches = catalogEntriesFor(requirement.signals, requirement.kind);
  return matches.length > 0 ? matches : [CORE_PLATFORM_CAPABILITY];
}

/** Signature used to detect two capability drafts citing the exact same requirement set. */
function requirementSignature(requirementIds: readonly string[]): string {
  return [...requirementIds].sort().join('|');
}

/**
 * Folds a "broad" catalog entry (see `CapabilityCatalogEntry.broadSignal`) into a sibling capability
 * once both cite the identical requirement set: the broad signal is then a loose secondary keyword
 * hit on a requirement whose primary ask the one specific sibling already names (for example one Okta requirement fanning into both "Identity Provider Integration" and "Data
 * Warehouse and BI Integration"). A signature with zero or several specific siblings is left alone -
 * there is no single more-specific capability to fold the others into.
 */
function foldDuplicateSignatures(drafts: Map<string, CapabilityDraft>): Map<string, CapabilityDraft> {
  const bySignature = new Map<string, CapabilityDraft[]>();
  for (const draft of drafts.values()) {
    const signature = requirementSignature(draft.requirementIds);
    const group = bySignature.get(signature) ?? [];
    group.push(draft);
    bySignature.set(signature, group);
  }
  const namesToDrop = new Set<string>();
  for (const group of bySignature.values()) {
    const specific = group.filter((draft) => draft.entry.broadSignal !== true);
    if (group.length < 2 || specific.length !== 1) {
      continue;
    }
    for (const draft of group) {
      if (draft.entry.broadSignal === true) {
        namesToDrop.add(draft.entry.capabilityName);
      }
    }
  }
  if (namesToDrop.size === 0) {
    return drafts;
  }
  return new Map([...drafts].filter(([name]) => !namesToDrop.has(name)));
}

/** Groups requirements by the capability name their signals resolve to (merges shared-name entries such as ai:assistant/ai:rag). */
function draftCapabilities(requirements: readonly ScopeItem[]): Map<string, CapabilityDraft> {
  const drafts = new Map<string, CapabilityDraft>();
  for (const requirement of requirements) {
    for (const entry of entriesForRequirement(requirement)) {
      const existing = drafts.get(entry.capabilityName);
      if (existing === undefined) {
        drafts.set(entry.capabilityName, { entry, requirementIds: [requirement.id] });
      } else if (!existing.requirementIds.includes(requirement.id)) {
        existing.requirementIds.push(requirement.id);
      }
    }
  }
  if (drafts.size === 0) {
    // No reviewed requirements at all: keep a well-formed, empty Core Platform Services capability
    // rather than an empty capability list (the PRD output schema requires at least one).
    drafts.set(CORE_PLATFORM_CAPABILITY.capabilityName, { entry: CORE_PLATFORM_CAPABILITY, requirementIds: [] });
    return drafts;
  }
  return foldDuplicateSignatures(drafts);
}

/** True when a requirement's grounding, or an assumption it depends on, has not been confirmed yet. */
function reliesOnUnresolvedAssumption(scope: ScopeModel, requirement: ScopeItem): boolean {
  if (requirement.provenance === 'assumed' && !requirement.resolved) {
    return true;
  }
  return requirement.relatedIds.some((relatedId) => {
    const related = findScopeItem(scope, relatedId);
    return related !== undefined && related.kind === 'assumption' && !related.resolved;
  });
}

/** assumption-to-confirm outranks ai-interpretation, which outranks the customer-requested default. */
function labelFor(scope: ScopeModel, requirementIds: readonly string[]): ContentLabel {
  const items = requirementIds.map((id) => findScopeItem(scope, id)).filter((item): item is ScopeItem => item !== undefined);
  if (items.some((item) => reliesOnUnresolvedAssumption(scope, item))) {
    return 'assumption-to-confirm';
  }
  if (items.some((item) => item.provenance === 'ai-inferred')) {
    return 'ai-interpretation';
  }
  return 'customer-requested';
}

function priorityFor(scope: ScopeModel, requirementIds: readonly string[]): Priority {
  let priority: Priority = 'Low';
  for (const id of requirementIds) {
    const item = findScopeItem(scope, id);
    if (item !== undefined) {
      priority = higherPriority(priority, item.priority);
    }
  }
  return priority;
}

/** Titles of dependency/existing-system items referenced (via relatedIds) by any requirement in the capability. */
function dependencyTitlesFor(scope: ScopeModel, requirementIds: readonly string[]): string[] {
  const titles = new Set<string>();
  for (const id of requirementIds) {
    const item = findScopeItem(scope, id);
    if (item === undefined) {
      continue;
    }
    for (const relatedId of item.relatedIds) {
      const related = findScopeItem(scope, relatedId);
      if (related !== undefined && (related.kind === 'dependency' || related.kind === 'existingSystem')) {
        titles.add(related.title);
      }
    }
  }
  return Array.from(titles);
}

/** Existing-system items that carry the same signal as this capability entry, i.e. the named systems it touches. */
function systemNamesFor(scope: ScopeModel, entry: CapabilityCatalogEntry): string[] {
  if (entry.signal === CORE_PLATFORM_CAPABILITY.signal) {
    return [];
  }
  const names = getInScopeItemsByKind(scope, 'existingSystem')
    .filter((system) => system.signals.includes(entry.signal))
    .map((system) => system.title);
  return Array.from(new Set(names));
}

function buildScopeParagraph(scope: ScopeModel, entry: CapabilityCatalogEntry, requirementIds: readonly string[]): string {
  const titles = requirementIds
    .map((id) => findScopeItem(scope, id))
    .filter((item): item is ScopeItem => item !== undefined)
    .map((item) => `${item.id} (${item.title})`);
  const requirementSentence = titles.length > 0 ? ` It delivers: ${titles.join(', ')}.` : '';
  const systemNames = systemNamesFor(scope, entry);
  const systemSentence = systemNames.length > 0 ? ` It connects to ${systemNames.join(', ')}.` : '';
  return `${entry.scopeIntro}${requirementSentence}${systemSentence}`;
}

function compareDrafts(a: CapabilityDraft, b: CapabilityDraft): number {
  const byPackage = a.entry.deliveryPackage.localeCompare(b.entry.deliveryPackage);
  if (byPackage !== 0) {
    return byPackage;
  }
  const byModule = a.entry.module.localeCompare(b.entry.module);
  return byModule !== 0 ? byModule : a.entry.capabilityName.localeCompare(b.entry.capabilityName);
}

/** Builds the capability list for the reviewed scope: every requirement is cited by at least one capability. */
export function buildCapabilities(scope: ScopeModel): Capability[] {
  const requirements = getRequirements(scope);
  const drafts = Array.from(draftCapabilities(requirements).values()).sort(compareDrafts);
  return drafts.map((draft, index) => ({
    id: formatId('CAP', index + 1),
    name: draft.entry.capabilityName,
    scope: buildScopeParagraph(scope, draft.entry, draft.requirementIds),
    requirementIds: draft.requirementIds,
    priority: priorityFor(scope, draft.requirementIds),
    dependencies: dependencyTitlesFor(scope, draft.requirementIds),
    label: labelFor(scope, draft.requirementIds),
    module: draft.entry.module,
    workstream: draft.entry.workstream,
    deliveryPackage: draft.entry.deliveryPackage,
    acceptance: [...draft.entry.acceptanceHints],
  }));
}
