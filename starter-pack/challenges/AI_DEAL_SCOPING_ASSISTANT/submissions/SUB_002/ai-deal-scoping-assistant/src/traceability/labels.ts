/** Display vocabulary for traceability targets - shared by trace-link labels and coverage text. */
import type { DataTopic, TraceTargetType } from '../domain';

const DATA_TOPIC_LABELS: ReadonlyMap<DataTopic, string> = new Map([
  ['ownership', 'Data ownership'],
  ['ingestion', 'Data ingestion'],
  ['transactional-storage', 'Transactional storage'],
  ['analytical-storage', 'Analytical storage'],
  ['data-quality', 'Data quality'],
  ['metadata-governance', 'Metadata and governance'],
  ['retention', 'Data retention'],
  ['privacy-security', 'Privacy and security'],
  ['reporting-analytics', 'Reporting and analytics'],
  ['backup-recovery', 'Backup and recovery'],
]);

/** Readable label for a data-strategy topic plan, which carries no name of its own. */
export function dataTopicLabel(topic: DataTopic): string {
  return DATA_TOPIC_LABELS.get(topic) ?? 'Data strategy topic';
}

const TARGET_TYPE_NOUNS: ReadonlyMap<TraceTargetType, string> = new Map([
  ['capability', 'Capability'],
  ['component', 'Architecture component'],
  ['dataDomain', 'Data domain'],
  ['dataTopic', 'Data strategy topic'],
  ['integration', 'Integration'],
  ['aiUseCase', 'AI use case'],
  ['framework', 'Framework recommendation'],
  ['workstream', 'Estimate workstream'],
  ['journey', 'User journey'],
]);

/** Singular noun for a kind of generated element, used in coverage and quality-gate text. */
export function targetTypeNoun(targetType: TraceTargetType): string {
  return TARGET_TYPE_NOUNS.get(targetType) ?? 'Generated element';
}
