/**
 * One row per DATA_TOPIC (src/domain/strategy.ts): which architecture areas hold the service that
 * implements it, the signal keywords that select which domains and requirements are actually
 * relevant to it, and the paragraph builder that turns those into a scope-specific approach. Kept
 * as a data table so every topic is produced the same way
 * instead of ten hand-written conditional branches.
 *
 * Each `approach` opens with only the domains `signalKeywords` selects for that topic (empty
 * keywords - ownership, transactional storage - genuinely apply to every domain); when nothing
 * matches, it names the open gap/question instead of reciting the full, unrelated domain list.
 */
import type { ArchitectureArea, DataTopic } from '../domain';
import type { ComponentQuery } from './componentLookup';
import { joinList } from './shared';

/** A reviewed, non-`data`-kind requirement (functional, non-functional, security or business) whose own wording already answers a topic's question, so a fallback can cite it instead of denying the topic. */
export interface TopicEvidenceItem {
  id: string;
  title: string;
}

export interface TopicNarrativeInput {
  platformLabel: string;
  /** Concrete service names resolved from the reviewed architecture's components. */
  services: readonly string[];
  /** Names of the data domains this specific topic's signal keywords select (empty when none match). */
  domainNames: readonly string[];
  customerName: string;
  /** "Regulation (requirement id)" for every compliance regime a reviewed item names. */
  regulationLabels: readonly string[];
  /** When no domain matches this topic, the open gap/question that explains why (undefined when none exists either). */
  unresolvedNote: string | undefined;
  /** Reviewed non-data requirements that match this topic's own keywords, so a no-domain fallback can cite the requirement that already states the fact instead of denying one exists. */
  evidence: readonly TopicEvidenceItem[];
}

export interface DataTopicDef {
  topic: DataTopic;
  heading: string;
  query: ComponentQuery;
  /** Signal id suffixes (the part after ':') that make a data item relevant to this topic; empty means every domain applies. */
  signalKeywords: readonly string[];
  approach(input: TopicNarrativeInput): string;
}

const STORAGE: readonly ArchitectureArea[] = ['data-storage'];
const ANALYTIC_KEYWORDS = ['warehouse', 'analytic', 'lake', 'olap'];
/** Components a transactional-storage query must never surface: a BI/reporting tool, an ETL/pipeline service, a cache or a search index all sit in the same storage area but serve none of it as the system of record. */
const TRANSACTIONAL_EXCLUDE_KEYWORDS = [...ANALYTIC_KEYWORDS, 'bi', 'reporting', 'etl', 'pipeline', 'cache', 'search'];
/** A retention rule belongs on a persistent store, never an in-memory cache. */
const NON_PERSISTENT_KEYWORDS = ['cache'];
/** A notification service is an outbound effect of ingestion, not a channel data is ingested through. */
const NON_INGESTION_KEYWORDS = ['notification'];

function serviceClause(input: TopicNarrativeInput, verb: string): string {
  if (input.services.length === 0) {
    return `no dedicated service is selected in the current ${input.platformLabel} architecture yet; add one during detailed design`;
  }
  return `${verb} ${joinList([...input.services])} on ${input.platformLabel}`;
}

/** The topic-relevant domains as a list, or the open gap/question (or a caller-supplied neutral note) when none match. */
function domainsOrNote(input: TopicNarrativeInput, noEvidenceFallback: string): string {
  if (input.domainNames.length > 0) {
    return joinList(input.domainNames);
  }
  return input.unresolvedNote ?? noEvidenceFallback;
}

/** "id (title)" for every requirement offered as evidence, so a grounded sentence names exactly what the customer stated. */
function citeEvidence(evidence: readonly TopicEvidenceItem[]): string {
  return joinList(evidence.map((item) => `${item.id} (${item.title})`));
}

/** The regular verb form to agree with a joined list acting as its subject: singular for one item, plural for several. Every verb these grounded sentences use is a regular one formed by dropping the trailing 's'. */
function verbFor(subjectCount: number, thirdPersonSingular: string): string {
  return subjectCount === 1 ? thirdPersonSingular : thirdPersonSingular.slice(0, -1);
}

/**
 * A topic whose keywords match no reviewed data domain: when a functional, non-functional, security
 * or business requirement already states the fact directly (`evidence`), the sentence built from it
 * replaces the whole denial (including its own trailing clause, which would otherwise contradict the
 * evidence it now cites) rather than being spliced into the denial's sentence. Falls back to the
 * caller's denial sentence - which itself still prefers an open gap/question - when there is none.
 */
function domainlessTopicText(input: TopicNarrativeInput, groundedSentence: (cite: string) => string, denialSentence: string): string {
  return input.evidence.length > 0 ? groundedSentence(citeEvidence(input.evidence)) : denialSentence;
}

export const DATA_TOPIC_DEFS: readonly DataTopicDef[] = [
  {
    topic: 'ownership',
    heading: 'Data Ownership',
    query: { areas: ['security', 'identity'] },
    signalKeywords: [],
    approach: (input) => {
      const domains = input.domainNames.length > 0 ? joinList(input.domainNames) : 'no data domain reviewed yet';
      return `Ownership of ${domains} sits with the ${input.customerName} business function that originates each one; until a data steward is named per domain the assistant records the owner as "To be confirmed with customer" rather than assuming one, and access to each domain is governed through the same identity and access controls as the rest of the platform.`;
    },
  },
  {
    topic: 'ingestion',
    heading: 'Data Ingestion',
    query: { areas: ['integration', 'messaging'], excludeKeywords: NON_INGESTION_KEYWORDS },
    signalKeywords: ['realtime', 'batch', 'file', 'streaming', 'etl', 'migration'],
    approach: (input) => {
      if (input.domainNames.length === 0) {
        return domainlessTopicText(
          input,
          (cite) => `${cite} already ${verbFor(input.evidence.length, 'states')} how this data enters the platform, though no data-domain item has been reviewed for it yet; ingestion is built to that requirement.`,
          `Data ingestion: ${domainsOrNote(input, 'no reviewed data item states how this data enters the platform yet')}; new data is captured directly by the application until an upstream feed is confirmed.`,
        );
      }
      return `${joinList(input.domainNames)} ${verbFor(input.domainNames.length, 'enters')} the platform through the integration layer rather than manual re-entry: inbound records are ${serviceClause(input, 'ingested via')}, validated against the target schema, and rejected records are quarantined for review instead of silently dropped.`;
    },
  },
  {
    topic: 'transactional-storage',
    heading: 'Transactional Storage',
    query: { areas: STORAGE, excludeKeywords: TRANSACTIONAL_EXCLUDE_KEYWORDS },
    signalKeywords: [],
    approach: (input) => {
      const domains = input.domainNames.length > 0 ? joinList(input.domainNames) : "the application's own operational data";
      return `Operational reads and writes for ${domains} are ${serviceClause(input, 'served from')}, sized and indexed for the transactional access patterns the reviewed functional requirements describe, separate from the analytical copy used for reporting.`;
    },
  },
  {
    topic: 'analytical-storage',
    heading: 'Analytical Storage',
    query: { areas: STORAGE, includeKeywords: ANALYTIC_KEYWORDS, strict: true },
    signalKeywords: ['warehouse', 'reporting', 'telemetry'],
    approach: (input) => {
      if (input.domainNames.length === 0) {
        return domainlessTopicText(
          input,
          (cite) => `${cite} already ${verbFor(input.evidence.length, 'asks')} for analytical or reporting access to this data, though no data-domain item has been reviewed for it yet; a read-optimised analytical copy is scoped to that requirement.`,
          `Analytical storage: ${domainsOrNote(input, 'no reviewed requirement asks for analytical or reporting access to this data yet')}; no separate analytical copy is built until a reporting requirement defines one.`,
        );
      }
      return `A read-optimised analytical copy of ${joinList(input.domainNames)} is ${serviceClause(input, 'maintained in')}, refreshed from the transactional store on a schedule the reporting requirements drive, so operational queries are never competing with dashboards for the same capacity.`;
    },
  },
  {
    topic: 'data-quality',
    heading: 'Data Quality',
    query: { areas: ['integration'] },
    signalKeywords: ['quality', 'master-data'],
    approach: (input) => {
      if (input.domainNames.length === 0) {
        return domainlessTopicText(
          input,
          (cite) => `${cite} already ${verbFor(input.evidence.length, 'states')} a data-quality or reconciliation rule for this scope, though no data-domain item has been reviewed for it yet; records are validated against that rule on the way in.`,
          `Data quality: ${domainsOrNote(input, 'no reviewed requirement states a data-quality or reconciliation rule for this scope yet')}; records are still validated against their basic schema on the way in.`,
        );
      }
      return `Records entering ${joinList(input.domainNames)} are checked for completeness, format and duplicate-key conflicts at the ingestion boundary (${serviceClause(input, 'enforced in')}); failures are routed to a reconciliation queue with the source record and the failed rule instead of being written through silently.`;
    },
  },
  {
    topic: 'metadata-governance',
    heading: 'Metadata and Governance',
    query: { areas: ['observability', 'security'] },
    signalKeywords: ['audit', 'master-data'],
    approach: (input) => {
      if (input.domainNames.length === 0) {
        return domainlessTopicText(
          input,
          (cite) => `The audit trail required by ${cite} is written to the platform's audit log for governance review, though no data-domain item has been reviewed for it yet.`,
          `Metadata and governance: ${domainsOrNote(input, 'no reviewed requirement asks for a catalogued audit trail on this data yet')}; standard platform audit logging still records access to every domain regardless.`,
        );
      }
      return `Each of ${joinList(input.domainNames)} is catalogued with its owner, classification and retention rule so downstream teams can discover it without re-asking ${input.customerName}; access and schema changes are captured in the platform's audit log (${serviceClause(input, 'recorded via')}) for governance review.`;
    },
  },
  {
    topic: 'retention',
    heading: 'Data Retention',
    query: { areas: STORAGE, excludeKeywords: NON_PERSISTENT_KEYWORDS },
    signalKeywords: ['retention'],
    approach: (input) => {
      if (input.domainNames.length === 0) {
        return domainlessTopicText(
          input,
          (cite) => `${cite} already ${verbFor(input.evidence.length, 'states')} the retention period for this scope, though no data-domain item has been reviewed for it yet; the storage service's lifecycle rule is configured to that period.`,
          `Data retention: ${domainsOrNote(input, `no reviewed requirement states a retention period for this scope; ${input.customerName} needs to confirm one before a lifecycle rule is configured`)}.`,
        );
      }
      return `${joinList(input.domainNames)} is retained on the period the customer has stated, or, until confirmed, treated as an open assumption rather than an indefinite default, with expiry enforced through the storage service's own lifecycle rules (${serviceClause(input, 'configured on')}).`;
    },
  },
  {
    topic: 'privacy-security',
    heading: 'Privacy and Security',
    query: { areas: ['security'] },
    signalKeywords: ['pii', 'encryption', 'data-residency'],
    approach: (input) => {
      if (input.domainNames.length === 0) {
        return domainlessTopicText(
          input,
          (cite) => `${cite} already ${verbFor(input.evidence.length, 'flags')} this as personal or regulated data, though no data-domain item has been reviewed for it yet; encryption at rest and in transit and role-restricted access apply to it.`,
          `Privacy and security: ${domainsOrNote(input, 'no reviewed data item is currently flagged as personal or regulated data')}; a baseline of encryption at rest and in transit still applies to every domain regardless.`,
        );
      }
      const complianceClause = input.regulationLabels.length > 0 ? ` in line with ${joinList([...input.regulationLabels])}` : ' pending confirmation of which regulatory regime applies';
      return `${joinList(input.domainNames)} carries personal or regulated data and is encrypted at rest and in transit${complianceClause}, with access restricted to the roles that need it (${serviceClause(input, 'enforced through')}).`;
    },
  },
  {
    topic: 'reporting-analytics',
    heading: 'Reporting and Analytics',
    query: { areas: [...STORAGE, 'ai-ml'], includeKeywords: ANALYTIC_KEYWORDS, strict: true },
    signalKeywords: ['reporting'],
    approach: (input) => {
      if (input.domainNames.length === 0) {
        return domainlessTopicText(
          input,
          (cite) => `${cite} already ${verbFor(input.evidence.length, 'asks')} for a report or dashboard over this data, though no data-domain item has been reviewed for it yet; reporting is scoped to that requirement.`,
          `Reporting and analytics: ${domainsOrNote(input, 'no reviewed requirement asks for a report or dashboard over this data yet')}; nothing is exposed to a dashboard until a reporting requirement defines one.`,
        );
      }
      return `Reporting and dashboards over ${joinList(input.domainNames)} read from the analytical copy, not the transactional store, ${serviceClause(input, 'through')}, so ad-hoc queries cannot degrade the response time of the live application.`;
    },
  },
  {
    topic: 'backup-recovery',
    heading: 'Backup and Recovery',
    query: { areas: ['backup-dr'] },
    signalKeywords: ['availability'],
    approach: (input) => {
      if (input.domainNames.length === 0) {
        return domainlessTopicText(
          input,
          (cite) => `Backups and restore are configured to meet the recovery objective ${cite} ${verbFor(input.evidence.length, 'states')}, ${serviceClause(input, 'via')}; a restore test against that target is part of go-live sign-off.`,
          `Backup and recovery: ${domainsOrNote(input, 'no reviewed requirement states an availability or recovery target for this data yet')}; the platform's default backup schedule still applies until a recovery objective is confirmed.`,
        );
      }
      return `${joinList(input.domainNames)} is backed up on the recovery objectives the reviewed availability requirements imply, ${serviceClause(input, 'via')}; restoration is tested rather than assumed to work, and a failed restore test blocks go-live sign-off.`;
    },
  },
];
