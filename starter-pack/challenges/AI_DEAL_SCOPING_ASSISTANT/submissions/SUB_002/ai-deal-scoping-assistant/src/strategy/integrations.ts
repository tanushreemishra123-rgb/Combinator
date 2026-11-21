/**
 * Integration inventory (IF_01, IF_02, ...): one entry per reviewed `integration` scope item, its
 * system resolved from the existing system it references (or, failing that, a named system found in
 * the customer's own text), plus one entry for any reviewed existing system that no integration item
 * references yet - so a system the customer names is never silently dropped from the inventory even
 * before its exchange is fully described (spec 4, "Integration Architecture").
 *
 * An "integration" here means a named system the new solution keeps exchanging data with going
 * forward. A system the customer says is being replaced, retired or run as a manual/paper process is
 * therefore not modelled as a permanent interface: it is left out entirely, unless the customer also
 * asks for a time-boxed parallel run, in which case it becomes a clearly named cutover interface.
 */
import type { ArchitectureComponent, EstimationInputKey, IntegrationSpec, ScopeItem, ScopeModel } from '../domain';
import { componentIdsOf, findComponents } from './componentLookup';
import {
  authenticationFor,
  categoryFor,
  catalogProtocolFor,
  complexityFor,
  CUSTOMER_OWNED_SIGNALS,
  dataSyncFor,
  errorHandlingFor,
  explicitPatternFromSignals,
  isCutoverText,
  isIdentityText,
  isLaterPhaseText,
  isManualProcessText,
  isRetirementText,
  isSaasOrPartnerText,
  knownIdentityProviderIn,
  knownPlatformIn,
  monitoringFrom,
  NOTIFICATION_SIGNALS,
  PATTERN_COMPONENT_AREA,
  protocolPhraseFor,
  protocolTokensIn,
  retryFor,
  systemNameFromTitle,
} from './integrationCatalog.data';
import { idSequence, joinList, shareSignalInGroup } from './shared';

/** Direction is read from the solution's point of view: data it takes in from the system versus data it delivers to it. */
const INBOUND_WORDS = ['import', 'ingest', 'receive', 'pull', 'inbound', 'fetch', 'extract', 'retrieve', 'read from', 'event stream', 'subscribe', 'consume', 'feed from'];
const OUTBOUND_WORDS = ['export', 'publish to', 'publishes', 'push', 'send', 'outbound', 'notify', 'post to', 'posts to', 'posting to', 'write back', 'write-back', 'hand off', 'handoff'];

function directionFor(text: string): IntegrationSpec['direction'] {
  const lower = text.toLowerCase();
  const inbound = INBOUND_WORDS.some((word) => lower.includes(word));
  const outbound = OUTBOUND_WORDS.some((word) => lower.includes(word));
  if (inbound && !outbound) {
    return 'inbound';
  }
  if (outbound && !inbound) {
    return 'outbound';
  }
  return 'bidirectional';
}

interface ResolvedPattern {
  pattern: IntegrationSpec['pattern'];
  explicit: boolean;
}

function resolvePattern(signals: readonly string[]): ResolvedPattern {
  const explicitPattern = explicitPatternFromSignals(signals);
  return explicitPattern === undefined ? { pattern: 'api', explicit: false } : { pattern: explicitPattern, explicit: true };
}

/** An open gap/question that leaves `inputKey` unresolved for `item` or the system it names - read the item, not just a boolean, so its id and wording can be cited. */
function relatedUnresolvedInput(scope: ScopeModel, item: ScopeItem, linkedSystem: ScopeItem | undefined, inputKey: EstimationInputKey): ScopeItem | undefined {
  return scope.items.find((candidate) => {
    if (candidate.kind !== 'gap' && candidate.kind !== 'question') {
      return false;
    }
    if (candidate.resolved || !candidate.affectsInputs.includes(inputKey)) {
      return false;
    }
    const relatesToItem = candidate.relatedIds.includes(item.id) || item.relatedIds.includes(candidate.id);
    const relatesToSystem = linkedSystem !== undefined && (candidate.relatedIds.includes(linkedSystem.id) || linkedSystem.relatedIds.includes(candidate.id));
    return relatesToItem || relatesToSystem;
  });
}

/** Any open gap/question related to `item`, regardless of what it affects - used to cite why a later-phase interface is still undecided. */
function relatedOpenItem(scope: ScopeModel, item: ScopeItem): ScopeItem | undefined {
  return scope.items.find(
    (candidate) => (candidate.kind === 'gap' || candidate.kind === 'question') && !candidate.resolved && (item.relatedIds.includes(candidate.id) || candidate.relatedIds.includes(item.id)),
  );
}

/** Protocol tokens confirmed by the pattern when the customer's text names none (a REST-pattern default counts as 'REST' for alternative filtering). */
function impliedTokens(confirmed: readonly string[], pattern: IntegrationSpec['pattern']): readonly string[] {
  return confirmed.length > 0 ? confirmed : pattern === 'api' ? ['REST'] : [];
}

/**
 * Protocol text: the customer's own words first (scanning the requirement and its linked system for
 * named protocols), the catalog default second, and - when a related gap/question is still open -
 * the alternative the discovery notes raised, named alongside its gap id.
 */
function resolveProtocol(item: ScopeItem, linkedSystem: ScopeItem | undefined, pattern: IntegrationSpec['pattern'], scope: ScopeModel): string {
  const ownTexts = [item.title, item.description, linkedSystem?.title ?? '', linkedSystem?.description ?? ''];
  const confirmed = protocolTokensIn(ownTexts);
  const base = confirmed.length > 0 ? joinList(confirmed.map(protocolPhraseFor)) : catalogProtocolFor(pattern);
  const openInput = relatedUnresolvedInput(scope, item, linkedSystem, 'integrationReadiness');
  if (openInput === undefined) {
    return base;
  }
  const alternatives = protocolTokensIn([openInput.title, openInput.description]).filter((token) => !impliedTokens(confirmed, pattern).includes(token));
  if (alternatives.length === 0) {
    return base;
  }
  return `${base} (unconfirmed - the discovery notes also raise ${joinList(alternatives.map(protocolPhraseFor))} as a possible alternative; see ${openInput.id})`;
}

function identityProvider(item: ScopeItem, linkedSystem: ScopeItem | undefined): boolean {
  return item.signals.includes('integration:identity-provider') || isIdentityText([item.title, item.description]) || (linkedSystem !== undefined && isIdentityText([linkedSystem.title, linkedSystem.description]));
}

/** The real system name: the linked existing system first, a named identity provider in the text second, a cleaned-up requirement label last resort. */
function resolveSystemName(item: ScopeItem, linkedSystem: ScopeItem | undefined, identity: boolean): string {
  if (linkedSystem !== undefined) {
    return linkedSystem.title;
  }
  if (identity) {
    return knownIdentityProviderIn([item.title, item.description]) ?? systemNameFromTitle(item.title);
  }
  return knownPlatformIn([item.title]) ?? item.title;
}

/**
 * A linked existing system is only actually internal when its own name does not itself mark it as a
 * third-party vendor, carrier network or partner exchange - being in the customer's own reviewed
 * systems inventory does not make it theirs to operate. Checked against the system's name only (not
 * its longer description, which can mention "partners" or similar words about who else uses it).
 */
function isLinkedSystemExternal(linkedSystem: ScopeItem): boolean {
  return knownPlatformIn([linkedSystem.title]) !== undefined || isSaasOrPartnerText([linkedSystem.title]);
}

function resolveSystemType(item: ScopeItem, linkedSystem: ScopeItem | undefined, identity: boolean, namedProvider: string | undefined): IntegrationSpec['systemType'] {
  if (identity) {
    return namedProvider === undefined ? 'internal' : 'external';
  }
  if (linkedSystem !== undefined) {
    return isLinkedSystemExternal(linkedSystem) ? 'external' : 'internal';
  }
  return item.signals.some((signal) => CUSTOMER_OWNED_SIGNALS.has(signal)) ? 'internal' : 'external';
}

function componentIdsFor(components: readonly ArchitectureComponent[], pattern: IntegrationSpec['pattern'], identity: boolean): string[] {
  if (identity) {
    const identityAndApi = [...findComponents(components, { areas: ['identity'] }), ...findComponents(components, { areas: ['api'] })];
    if (identityAndApi.length > 0) {
      return componentIdsOf(identityAndApi);
    }
  }
  const area = PATTERN_COMPONENT_AREA.get(pattern);
  const matched = area === undefined ? [] : findComponents(components, { areas: [area] });
  if (matched.length > 0) {
    return componentIdsOf(matched);
  }
  return componentIdsOf(findComponents(components, { areas: ['integration'] }));
}

/** Appends '(later phase)' once, never twice, when the name does not already carry it. */
function withLaterPhaseSuffix(name: string, laterPhase: boolean): string {
  if (!laterPhase || name.toLowerCase().includes('(later phase)')) {
    return name;
  }
  return `${name} (later phase)`;
}

function laterPhaseDataSyncNote(scope: ScopeModel, item: ScopeItem): string {
  const openItem = relatedOpenItem(scope, item);
  const citation = openItem === undefined ? '' : ` (see ${openItem.id})`;
  return ` This interface is not required for go-live and stays out of the initial cutover; it is enabled once its phase timing is confirmed${citation}.`;
}

/**
 * Text that says which way data moves: the interface item itself plus the functional and data
 * requirements tied to the same interface or system ("must ingest orders from SAP ECC"), because an
 * integration statement often names only the system and the mechanism.
 */
function directionEvidence(item: ScopeItem, linkedSystem: ScopeItem | undefined, scope: ScopeModel): string {
  const anchors = linkedSystem === undefined ? [item.id] : [item.id, linkedSystem.id];
  const related = scope.items.filter(
    (candidate) => candidate.inScope && (candidate.kind === 'functional' || candidate.kind === 'data') && candidate.relatedIds.some((id) => anchors.includes(id)),
  );
  return [item, ...related].map((entry) => `${entry.title} ${entry.description}`).join(' ');
}

/** Builds one interface for a reviewed `integration` requirement, or an unreferenced existing system's own connectivity. */
function buildSpec(id: string, baseName: string, item: ScopeItem, linkedSystem: ScopeItem | undefined, scope: ScopeModel, components: readonly ArchitectureComponent[]): IntegrationSpec {
  const identity = identityProvider(item, linkedSystem);
  const namedProvider = identity ? knownIdentityProviderIn([item.title, item.description]) : undefined;
  const system = resolveSystemName(item, linkedSystem, identity);
  const systemType = resolveSystemType(item, linkedSystem, identity, namedProvider);
  const { pattern, explicit } = resolvePattern(item.signals);
  const direction = identity ? 'inbound' : directionFor(directionEvidence(item, linkedSystem, scope));
  const notification = item.signals.some((signal) => NOTIFICATION_SIGNALS.has(signal));
  const category = categoryFor(pattern, direction, identity, notification);
  const laterPhase = isLaterPhaseText([item.title, item.description]);
  const apiConfirmed = explicit && pattern === 'api' && !identity;
  const requirementIds = linkedSystem === undefined ? [item.id] : [item.id, linkedSystem.id];
  const authentication = identity ? `User-delegated OIDC/SAML federation with ${system} (authorization-code flow): the signed-in user's own identity is carried through, never a machine-to-machine client-credentials grant.` : authenticationFor(pattern, item.signals);
  const dataSync = dataSyncFor(category, system, systemType) + (laterPhase ? laterPhaseDataSyncNote(scope, item) : '');

  return {
    id,
    name: withLaterPhaseSuffix(baseName, laterPhase),
    system,
    systemType,
    direction,
    pattern,
    protocol: identity ? `OIDC/SAML federation (browser redirect) with ${system} over HTTPS` : resolveProtocol(item, linkedSystem, pattern, scope),
    authentication,
    errorHandling: errorHandlingFor(category, system),
    retry: retryFor(category, system),
    monitoring: monitoringFrom(category, system, components),
    dataSync,
    requirementIds,
    componentIds: componentIdsFor(components, pattern, identity),
    complexity: complexityFor(item.signals, explicit),
    readiness: relatedUnresolvedInput(scope, item, linkedSystem, 'integrationReadiness') !== undefined ? 'unknown' : apiConfirmed ? 'confirmed' : 'unknown',
  };
}

function normalizedForMatch(text: string): string {
  return text.toLowerCase().split('-').join(' ');
}

/**
 * The existing system a requested integration is really about: an explicit relatedIds/signal link
 * first, and - only when neither exists - a system whose own name is named in the requirement's own
 * text, so an integration is never given a second, duplicate connectivity entry once the customer's
 * system also appears as its own reviewed existing-system item.
 */
function findLinkedSystem(item: ScopeItem, existingSystems: readonly ScopeItem[]): ScopeItem | undefined {
  const direct = existingSystems.find(
    (system) => item.relatedIds.includes(system.id) || system.relatedIds.includes(item.id) || shareSignalInGroup(item, system, 'integration:'),
  );
  if (direct !== undefined) {
    return direct;
  }
  const text = normalizedForMatch(`${item.title} ${item.description}`);
  return existingSystems.find((system) => system.title.length > 3 && text.includes(normalizedForMatch(system.title)));
}

/** A related item's text mentioning a time-boxed parallel run - the one case a retiring system still gets a (cutover) interface. */
function findCutoverSignal(scope: ScopeModel, system: ScopeItem): ScopeItem | undefined {
  return scope.items.find((candidate) => {
    const related = candidate.relatedIds.includes(system.id) || system.relatedIds.includes(candidate.id);
    return related && isCutoverText([candidate.title, candidate.description]);
  });
}

/** A minimal, honest interface for a system being retired only for the duration of its customer-requested parallel run. */
function buildCutoverSpec(id: string, system: ScopeItem, cutover: ScopeItem, components: readonly ArchitectureComponent[]): IntegrationSpec {
  const pattern: IntegrationSpec['pattern'] = 'api';
  return {
    id,
    name: `${system.title} (parallel-run cutover)`,
    system: system.title,
    systemType: 'internal',
    direction: 'bidirectional',
    pattern,
    protocol: catalogProtocolFor(pattern),
    authentication: authenticationFor(pattern, system.signals),
    errorHandling: errorHandlingFor('sync-bidirectional', system.title),
    retry: retryFor('sync-bidirectional', system.title),
    monitoring: monitoringFrom('sync-bidirectional', system.title, components),
    dataSync: `This is a time-boxed parallel-run interface, not a permanent integration: ${system.title} keeps operating alongside the new platform only until cutover is confirmed (see ${cutover.id}), after which this connectivity is retired.`,
    requirementIds: [system.id, cutover.id],
    componentIds: componentIdsFor(components, pattern, false),
    complexity: 'High',
    readiness: 'unknown',
  };
}

/** An unreferenced existing system's own connectivity: excluded when it is a manual process or a retiring system with no requested parallel run. */
function buildSystemConnectivity(nextId: () => string, system: ScopeItem, scope: ScopeModel, components: readonly ArchitectureComponent[]): IntegrationSpec[] {
  if (isManualProcessText([system.title, system.description])) {
    return [];
  }
  if (isRetirementText([system.title, system.description])) {
    const cutover = findCutoverSignal(scope, system);
    return cutover === undefined ? [] : [buildCutoverSpec(nextId(), system, cutover, components)];
  }
  return [buildSpec(nextId(), `${system.title} Connectivity`, system, undefined, scope, components)];
}

/**
 * Systems tied to an integration the customer or reviewer took out of scope. The exclusion covers
 * the system too, so it must not come back as a fallback connectivity interface.
 */
function excludedIntegrationSystemIds(scope: ScopeModel, existingSystems: readonly ScopeItem[]): Set<string> {
  const excluded = scope.items.filter((item) => item.kind === 'integration' && (!item.inScope || item.review === 'rejected'));
  return new Set(excluded.flatMap((item) => findLinkedSystem(item, existingSystems)?.id ?? []));
}

/** Builds the integration inventory: one entry per reviewed integration item, plus unreferenced existing systems that are still live interfaces. */
export function buildIntegrations(scope: ScopeModel, items: readonly ScopeItem[], components: readonly ArchitectureComponent[]): IntegrationSpec[] {
  const nextId = idSequence('IF');
  const integrationItems = items.filter((item) => item.kind === 'integration');
  const existingSystems = items.filter((item) => item.kind === 'existingSystem');
  const referencedSystemIds = excludedIntegrationSystemIds(scope, existingSystems);

  const fromIntegrations = integrationItems.map((item) => {
    const linkedSystem = findLinkedSystem(item, existingSystems);
    if (linkedSystem !== undefined) {
      referencedSystemIds.add(linkedSystem.id);
    }
    return buildSpec(nextId(), item.title, item, linkedSystem, scope, components);
  });

  const unreferencedSystems = existingSystems.filter((system) => !referencedSystemIds.has(system.id));
  const fromSystems = unreferencedSystems.flatMap((system) => buildSystemConnectivity(nextId, system, scope, components));

  return [...fromIntegrations, ...fromSystems];
}
