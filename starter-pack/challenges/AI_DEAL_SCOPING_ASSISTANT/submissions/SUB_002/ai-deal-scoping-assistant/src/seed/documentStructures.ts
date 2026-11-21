/**
 * Expected document structures: the section/area/topic vocabulary every generated deliverable is
 * validated and rendered against. Titles and labels are derived here from the domain's ID lists
 * (`PRD_SECTION_IDS`, `ARCHITECTURE_AREAS`, `DATA_TOPICS`, `PACKAGE_SECTION_IDS`) - each label map
 * is a `ReadonlyMap` keyed by those same domain IDs, following the `SIGNAL_LABELS` /
 * `KIND_PREFIXES` pattern used elsewhere in the domain layer, so a lookup is a `.get()` call
 * rather than the dynamic `obj[key]` property access the project's lint rules ban.
 * `documentStructures.test.ts` asserts every domain ID has a label, so this file can never drift.
 */
import { ARCHITECTURE_AREAS, DATA_TOPICS, PACKAGE_SECTION_IDS, PRD_SECTION_IDS } from '../domain';
import type { ArchitectureArea, DataTopic, PackageSectionId, PrdSectionId } from '../domain';

const PRD_SECTION_TITLES: ReadonlyMap<PrdSectionId, string> = new Map([
  ['overview', 'Overview'],
  ['businessProblem', 'Business Problem'],
  ['objectives', 'Objectives'],
  ['personas', 'Personas'],
  ['journeys', 'User Journeys'],
  ['functionalRequirements', 'Functional Requirements'],
  ['nonFunctionalRequirements', 'Non-Functional Requirements'],
  ['integrations', 'Integrations'],
  ['dependencies', 'Dependencies'],
  ['assumptions', 'Assumptions'],
  ['risks', 'Risks'],
  ['outOfScope', 'Out of Scope'],
  ['openQuestions', 'Open Questions'],
  ['traceability', 'Traceability'],
]);

const ARCHITECTURE_AREA_LABELS: ReadonlyMap<ArchitectureArea, string> = new Map([
  ['user-apps', 'User Applications'],
  ['backend', 'Backend Services'],
  ['api', 'API Layer'],
  ['data-storage', 'Data Storage'],
  ['identity', 'Identity and Access'],
  ['messaging', 'Messaging and Events'],
  ['integration', 'Integration'],
  ['ai-ml', 'AI / ML'],
  ['observability', 'Observability'],
  ['security', 'Security'],
  ['deployment', 'Deployment'],
  ['environments', 'Environments'],
  ['availability', 'Availability'],
  ['backup-dr', 'Backup and Disaster Recovery'],
]);

const DATA_TOPIC_LABELS: ReadonlyMap<DataTopic, string> = new Map([
  ['ownership', 'Data Ownership'],
  ['ingestion', 'Ingestion'],
  ['transactional-storage', 'Transactional Storage'],
  ['analytical-storage', 'Analytical Storage'],
  ['data-quality', 'Data Quality'],
  ['metadata-governance', 'Metadata and Governance'],
  ['retention', 'Retention'],
  ['privacy-security', 'Privacy and Security'],
  ['reporting-analytics', 'Reporting and Analytics'],
  ['backup-recovery', 'Backup and Recovery'],
]);

const PACKAGE_SECTION_TITLES: ReadonlyMap<PackageSectionId, string> = new Map([
  ['executive-summary', 'Executive Summary'],
  ['customer-objectives', 'Customer Objectives'],
  ['requirement-summary', 'Requirement Summary'],
  ['prd', 'Product Requirements Document'],
  ['functional-scope', 'Functional Scope'],
  ['solution-architecture', 'Solution Architecture'],
  ['architecture-diagram', 'Architecture Diagram'],
  ['data-strategy', 'Data Strategy'],
  ['integration-architecture', 'Integration Architecture'],
  ['ai-solution-approach', 'AI Solution Approach'],
  ['recommended-technologies', 'Recommended Technologies'],
  ['delivery-phases', 'Delivery Phases'],
  ['effort-timeline', 'Effort and Timeline'],
  ['rom-commercials', 'ROM Commercials'],
  ['assumptions', 'Assumptions'],
  ['risks', 'Risks'],
  ['dependencies', 'Dependencies'],
  ['open-questions', 'Open Questions'],
  ['requirement-coverage', 'Requirement Coverage'],
  ['traceability', 'Traceability'],
  ['quality-review', 'Quality Review'],
  ['change-log', 'Change Log'],
]);

export interface PrdSectionSpec {
  id: PrdSectionId;
  title: string;
}

/** Expected PRD sections, in the order `PRD_SECTION_IDS` defines them. */
export const PRD_SECTIONS: readonly PrdSectionSpec[] = PRD_SECTION_IDS.map((id) => ({
  id,
  title: PRD_SECTION_TITLES.get(id) ?? id,
}));

export interface ArchitectureAreaSpec {
  id: ArchitectureArea;
  label: string;
}

/** Expected architecture areas a solution-architecture output should cover where applicable. */
export const ARCHITECTURE_AREA_SPECS: readonly ArchitectureAreaSpec[] = ARCHITECTURE_AREAS.map((id) => ({
  id,
  label: ARCHITECTURE_AREA_LABELS.get(id) ?? id,
}));

export interface DataTopicSpec {
  id: DataTopic;
  label: string;
}

/** Expected data-strategy topics a data/integration output should cover where applicable. */
export const DATA_TOPIC_SPECS: readonly DataTopicSpec[] = DATA_TOPICS.map((id) => ({
  id,
  label: DATA_TOPIC_LABELS.get(id) ?? id,
}));

export interface PackageSectionSpec {
  id: PackageSectionId;
  title: string;
}

/** Expected sections of the final integrated scoping package, in rendering order. */
export const PACKAGE_SECTIONS: readonly PackageSectionSpec[] = PACKAGE_SECTION_IDS.map((id) => ({
  id,
  title: PACKAGE_SECTION_TITLES.get(id) ?? id,
}));

export interface FunctionalScopeGroupSpec {
  name: string;
  description: string;
}

/**
 * Reference groupings for organising `FunctionalScope.modules` / `.workstreams`. These are
 * illustrative labels (not a closed enum) - the PRD planner is free to introduce a more specific
 * module name when the requirements call for one - but they give the exporter and the UI a
 * consistent default vocabulary to fall back on.
 */
export const FUNCTIONAL_SCOPE_GROUPS: readonly FunctionalScopeGroupSpec[] = [
  {
    name: 'Core Platform',
    description: 'Foundational capabilities every other module depends on, such as identity, navigation and shared services.',
  },
  {
    name: 'Customer / Member Experience',
    description: 'Self-service capabilities exposed directly to end customers, policyholders, patients or members.',
  },
  {
    name: 'Integrations',
    description: 'Capabilities whose primary purpose is exchanging data with a named existing system.',
  },
  {
    name: 'Data and Reporting',
    description: 'Capabilities that consolidate, govern or report on data drawn from one or more sources.',
  },
  {
    name: 'AI Capabilities',
    description: 'Capabilities built around an AI use case such as extraction, retrieval-augmented answers or classification.',
  },
  {
    name: 'Administration and Operations',
    description: 'Internal-facing configuration, workflow, approval and operational-support tooling.',
  },
];
