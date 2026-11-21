/**
 * Builds the ten DATA_TOPIC plans (spec 4, "Data Strategy") from the reviewed scope and the
 * architecture's own components, so every topic paragraph cites only the domains and requirements
 * relevant to that specific topic (reusing each topic's own `signalKeywords`, which previously drove
 * only `requirementIds` while the narrative still recited every domain regardless of relevance) and names the platform services actually selected for this
 * engagement.
 */
import type { CloudPlatform, DataTopicPlan, ScopeItem } from '../domain';
import { hasSignalInGroup, signalLabel } from '../domain';
import type { ArchitectureComponent } from '../domain';
import { findComponents, serviceNames } from './componentLookup';
import { domainNameFor } from './dataDomains';
import type { TopicEvidenceItem } from './dataTopics.data';
import { DATA_TOPIC_DEFS } from './dataTopics.data';
import { uniqueIds } from './shared';

/** Kinds that can state a data-strategy fact directly (a customer requirement, not the data domain itself), so a fallback with no matching `data` item can still cite one instead of denying the fact exists. */
const EVIDENCE_KINDS: ReadonlySet<ScopeItem['kind']> = new Set(['functional', 'nonFunctional', 'security', 'business']);

const PLATFORM_LABELS: ReadonlyMap<CloudPlatform, string> = new Map([
  ['aws', 'AWS'],
  ['azure', 'Microsoft Azure'],
  ['gcp', 'Google Cloud Platform'],
]);

/** The customer-facing cloud name for a platform id (never the raw enum value, which reads like an internal code, e.g. "AZURE"). */
export function platformLabel(platform: CloudPlatform): string {
  return PLATFORM_LABELS.get(platform) ?? platform;
}

function signalSuffix(signal: string): string {
  const parts = signal.split(':');
  return parts.length > 1 ? (parts.at(1) ?? signal) : signal;
}

function matchesKeyword(item: ScopeItem, keywords: readonly string[]): boolean {
  return keywords.length > 0 && item.signals.some((signal) => keywords.includes(signalSuffix(signal)));
}

/** "Regulation (id, id, ...)" for every compliance regime a reviewed item names, grouping every citing item under its regulation once rather than repeating the regulation name per item. */
function regulationCitations(items: readonly ScopeItem[]): string[] {
  const idsByRegulation = new Map<string, string[]>();
  for (const item of items) {
    for (const signal of item.signals) {
      if (!hasSignalInGroup([signal], 'compliance')) {
        continue;
      }
      const label = signalLabel(signal);
      const ids = idsByRegulation.get(label) ?? [];
      if (!ids.includes(item.id)) {
        ids.push(item.id);
      }
      idsByRegulation.set(label, ids);
    }
  }
  return Array.from(idsByRegulation.entries()).map(([label, ids]) => `${label} (${ids.join(', ')})`);
}

/**
 * Domain names a topic's own keywords select. An empty-keyword topic (ownership, transactional
 * storage) is domain-agnostic and applies to every reviewed domain; when no `data` item has been
 * reviewed yet it falls back to the planner's own placeholder domain name instead of an empty list.
 */
function relevantDomainNames(items: readonly ScopeItem[], keywords: readonly string[], placeholderNames: readonly string[]): string[] {
  const dataItems = items.filter((item) => item.kind === 'data');
  if (dataItems.length === 0) {
    return keywords.length === 0 ? [...placeholderNames] : [];
  }
  const relevant = keywords.length === 0 ? dataItems : dataItems.filter((item) => matchesKeyword(item, keywords));
  return relevant.map(domainNameFor);
}

/** When no domain matches a topic's keywords, name the open gap or question that explains why, so the topic states a fact instead of the unrelated full domain list. */
function unresolvedNoteFor(items: readonly ScopeItem[], keywords: readonly string[]): string | undefined {
  const flagged = items.find((item) => (item.kind === 'gap' || item.kind === 'question') && matchesKeyword(item, keywords));
  if (flagged === undefined) {
    return undefined;
  }
  const kind = flagged.kind === 'gap' ? 'gap' : 'open question';
  return `${flagged.id} (${flagged.title}) is the open ${kind} tracking this`;
}

/** Requirement ids offered as evidence for a topic: every reviewed data item plus any item matching its keywords. */
function requirementIdsFor(items: readonly ScopeItem[], dataItemIds: readonly string[], keywords: readonly string[]): string[] {
  const keywordIds = items.filter((item) => matchesKeyword(item, keywords)).map((item) => item.id);
  return uniqueIds(dataItemIds, keywordIds);
}

/** The keyword-matched, non-`data` requirements a topic's fallback can cite when no `data`-kind item matches: the same items `requirementIds` already includes as evidence, so the narrative never denies a fact one of them already states. */
function narrativeEvidenceFor(items: readonly ScopeItem[], keywords: readonly string[]): TopicEvidenceItem[] {
  return items.filter((item) => EVIDENCE_KINDS.has(item.kind) && matchesKeyword(item, keywords)).map((item) => ({ id: item.id, title: item.title }));
}

/** All ten data-topic plans; every one is present even when the architecture or scope is sparse. */
export function buildDataTopics(
  items: readonly ScopeItem[],
  components: readonly ArchitectureComponent[],
  platform: CloudPlatform,
  domainNames: readonly string[],
  customerName: string,
): DataTopicPlan[] {
  const dataItemIds = items.filter((item) => item.kind === 'data').map((item) => item.id);
  const regulations = regulationCitations(items);
  const label = platformLabel(platform);

  return DATA_TOPIC_DEFS.map((def) => {
    const matched = findComponents(components, def.query);
    const services = serviceNames(matched);
    return {
      topic: def.topic,
      approach: def.approach({
        platformLabel: label,
        services,
        domainNames: relevantDomainNames(items, def.signalKeywords, domainNames),
        unresolvedNote: unresolvedNoteFor(items, def.signalKeywords),
        customerName,
        regulationLabels: regulations,
        evidence: narrativeEvidenceFor(items, def.signalKeywords),
      }),
      services,
      requirementIds: requirementIdsFor(items, dataItemIds, def.signalKeywords),
    };
  });
}
