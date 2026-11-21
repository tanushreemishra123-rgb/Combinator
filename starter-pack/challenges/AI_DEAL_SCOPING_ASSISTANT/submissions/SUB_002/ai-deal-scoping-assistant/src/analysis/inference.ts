/**
 * Stage 4 of the heuristic engine: items the customer did not state but that follow from what they
 * did state. Everything here is labelled 'ai-inferred', cites the source line that triggered it
 * and lists the requirement IDs it relates to, so a reviewer can accept or reject the reasoning.
 */
import { hasSignalInGroup } from '../domain';
import type { ScopeItemKind } from '../domain';
import { sourceFromStatement } from './draftBook';
import type { DraftBook, ExtractedItem } from './draftBook';
import { GENERIC_PERSONA, PERSONA_RULES, RISK_RULES } from './inference.data';
import type { PersonaRule, RiskRule } from './inference.data';
import { resolveSystemNames } from './systemNames';
import { containsAnyTerm, normalizeForMatch } from './textMatch';

export const MAX_PERSONAS = 6;
export const MAX_INFERRED_DEPENDENCIES = 12;
/** Related IDs listed on an inferred item; more would bury the reviewer rather than help. */
export const MAX_RELATED_IDS = 6;

const PERSONA_SOURCE_KINDS: ReadonlySet<ScopeItemKind> = new Set<ScopeItemKind>([
  'business', 'functional', 'nonFunctional', 'integration', 'data', 'security',
]);

/** One integrated system of an integration, with the dependency and existing-system items derived from it. */
export interface IntegrationLink {
  integration: ExtractedItem;
  systemName: string;
  relatedIds: string[];
}

/** Used when the text names no system: the requirement ID keeps the inferred items distinguishable. */
function unnamedSystem(integration: ExtractedItem): string {
  return `the ${integration.id} target system`;
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatIdList(ids: readonly string[]): string {
  return ids.slice(0, MAX_RELATED_IDS).join(', ');
}

function addPersona(book: DraftBook, rule: PersonaRule, mentions: readonly ExtractedItem[]): void {
  const first = mentions.at(0);
  if (first === undefined) {
    return;
  }
  const relatedIds = mentions.slice(0, MAX_RELATED_IDS).map((item) => item.id);
  const id = book.add('persona', {
    title: rule.label,
    description: `${rule.label} is referenced as a user of the solution in ${formatIdList(relatedIds)}. Goals, user numbers and access rights for this persona need to be validated with the customer.`,
    priority: 'Medium',
    provenance: 'ai-inferred',
    source: sourceFromStatement(first.statement),
  });
  book.linkAll(id, relatedIds);
}

/** Personas from the user nouns of requirement statements; the generic end user is a last resort. */
export function inferPersonas(extracted: readonly ExtractedItem[], book: DraftBook): void {
  const candidates = extracted.filter((item) => PERSONA_SOURCE_KINDS.has(item.kind));
  const mentionsOf = (rule: PersonaRule): ExtractedItem[] =>
    candidates.filter((item) => containsAnyTerm(item.statement.normalized, rule.terms));
  const found = PERSONA_RULES.map((rule) => ({ rule, mentions: mentionsOf(rule) })).filter((entry) => entry.mentions.length > 0);
  if (found.length === 0) {
    addPersona(book, GENERIC_PERSONA, mentionsOf(GENERIC_PERSONA));
    return;
  }
  for (const entry of found.slice(0, MAX_PERSONAS)) {
    addPersona(book, entry.rule, entry.mentions);
  }
}

function findStatedSystem(extracted: readonly ExtractedItem[], systemName: string): ExtractedItem | undefined {
  const needle = normalizeForMatch(systemName);
  return extracted.find((item) => item.kind === 'existingSystem' && item.statement.normalized.includes(needle));
}

function ensureExistingSystem(book: DraftBook, extracted: readonly ExtractedItem[], integration: ExtractedItem, systemName: string, known: Map<string, string>): string {
  const knownId = known.get(systemName) ?? findStatedSystem(extracted, systemName)?.id;
  if (knownId !== undefined) {
    known.set(systemName, knownId);
    return knownId;
  }
  const id = book.add('existingSystem', {
    title: capitalizeFirst(systemName),
    description: `The customer references ${systemName} as a system the solution must work with (see ${integration.id}). Its owner, version and available interfaces are to be confirmed during discovery.`,
    priority: 'Medium',
    provenance: 'ai-inferred',
    source: sourceFromStatement(integration.statement),
  });
  known.set(systemName, id);
  return id;
}

function addIntegrationDependency(book: DraftBook, integration: ExtractedItem, systemName: string): string {
  return book.add('dependency', {
    title: `${capitalizeFirst(systemName)} API access and sandbox`,
    description: `Delivery of ${integration.id} depends on the customer providing interface documentation, credentials and a non-production sandbox for ${systemName} before the integration build starts.`,
    priority: 'High',
    provenance: 'ai-inferred',
    source: sourceFromStatement(integration.statement),
  });
}

function linkIntegratedSystem(book: DraftBook, extracted: readonly ExtractedItem[], integration: ExtractedItem, systemName: string | undefined, known: Map<string, string>): IntegrationLink {
  const name = systemName ?? unnamedSystem(integration);
  const dependencyId = addIntegrationDependency(book, integration, name);
  const relatedIds = [dependencyId];
  if (systemName !== undefined) {
    relatedIds.push(ensureExistingSystem(book, extracted, integration, systemName, known));
  }
  book.linkAll(integration.id, relatedIds);
  book.linkAll(dependencyId, relatedIds);
  return { integration, systemName: name, relatedIds };
}

/**
 * For each system an integration names: an existing-system item (re-using one the customer already
 * described) and an access dependency, linked integration <-> existing system <-> dependency.
 */
export function inferSystemsAndDependencies(extracted: readonly ExtractedItem[], book: DraftBook): IntegrationLink[] {
  const knownSystems = new Map<string, string>();
  const links = extracted
    .filter((item) => item.kind === 'integration')
    .flatMap((integration) => {
      const names = resolveSystemNames(integration.statement, integration.signals);
      return (names.length === 0 ? [undefined] : names).map((systemName) => ({ integration, systemName }));
    })
    .slice(0, MAX_INFERRED_DEPENDENCIES);
  return links.map(({ integration, systemName }) => linkIntegratedSystem(book, extracted, integration, systemName, knownSystems));
}

function triggersRisk(rule: RiskRule, signals: readonly string[]): boolean {
  return rule.signalIds.some((id) => signals.includes(id)) || rule.groups.some((group) => hasSignalInGroup(signals, group));
}

/** Customer-raised risks need no echo, and an open point ("no launch date yet") is not a stated fact. */
const NON_TRIGGER_KINDS: ReadonlySet<ScopeItemKind> = new Set<ScopeItemKind>(['risk', 'gap']);

/** Delivery risks triggered by the signals of the extracted items (see RISK_RULES). */
export function inferRisks(extracted: readonly ExtractedItem[], book: DraftBook): void {
  for (const rule of RISK_RULES) {
    const triggers = extracted.filter((item) => !NON_TRIGGER_KINDS.has(item.kind) && triggersRisk(rule, item.signals));
    const first = triggers.at(0);
    if (first === undefined) {
      continue;
    }
    const relatedIds = triggers.slice(0, MAX_RELATED_IDS).map((item) => item.id);
    const id = book.add('risk', {
      title: rule.title,
      description: `${rule.exposure} ${formatIdList(relatedIds)}. Mitigation: ${rule.mitigation}`,
      priority: rule.priority,
      provenance: 'ai-inferred',
      source: sourceFromStatement(first.statement),
    });
    book.linkAll(id, relatedIds);
  }
}
