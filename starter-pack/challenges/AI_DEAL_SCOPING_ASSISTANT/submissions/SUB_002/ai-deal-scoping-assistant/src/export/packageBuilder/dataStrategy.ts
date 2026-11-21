/** "Data strategy" package section (spec 6): the data-domain table and all ten data topics. */
import { DATA_TOPICS } from '../../domain';
import type { DataDomain, DataTopicPlan, PackageSection, ScopingSession } from '../../domain';
import { headingBlock, joinOrFallback, notGeneratedCallout, provenanceBlock, refsCell, tableOrParagraph } from '../text';

const DOMAIN_COLUMNS = ['ID', 'Domain', 'Description', 'Sources', 'Owner', 'Classification', 'Requirements'] as const;

const CLASSIFICATION_TEXT: ReadonlyMap<DataDomain['classification'], string> = new Map([
  ['public', 'Public'],
  ['internal', 'Internal'],
  ['confidential', 'Confidential'],
  ['regulated', 'Regulated'],
]);

function domainRow(domain: DataDomain): string[] {
  return [domain.id, domain.name, domain.description, joinOrFallback(domain.sources, 'Not yet identified'), domain.owner, CLASSIFICATION_TEXT.get(domain.classification) ?? 'Internal', refsCell(domain.requirementIds)];
}

const TOPIC_LABELS: ReadonlyMap<(typeof DATA_TOPICS)[number], string> = new Map([
  ['ownership', 'Data ownership'],
  ['ingestion', 'Ingestion'],
  ['transactional-storage', 'Transactional storage'],
  ['analytical-storage', 'Analytical storage'],
  ['data-quality', 'Data quality'],
  ['metadata-governance', 'Metadata and governance'],
  ['retention', 'Retention'],
  ['privacy-security', 'Privacy and security'],
  ['reporting-analytics', 'Reporting and analytics'],
  ['backup-recovery', 'Backup and recovery'],
]);

function topicBlocks(topics: readonly DataTopicPlan[]) {
  const byTopic = new Map(topics.map((topic) => [topic.topic, topic]));
  return DATA_TOPICS.flatMap((topic) => {
    const plan = byTopic.get(topic);
    const heading = headingBlock(4, TOPIC_LABELS.get(topic) ?? topic);
    if (plan === undefined) {
      return [heading, { type: 'paragraph' as const, text: 'Not yet planned for this session.' }];
    }
    const services = joinOrFallback(plan.services, 'No specific services identified yet');
    return [heading, { type: 'paragraph' as const, text: `${plan.approach} Services: ${services}. Refs: ${refsCell(plan.requirementIds)}.` }];
  });
}

export function buildDataStrategySection(session: ScopingSession): PackageSection {
  const plan = session.outputs.dataIntegration.data;
  if (plan === null) {
    return { id: 'data-strategy', title: 'Data strategy', blocks: [notGeneratedCallout('the data strategy has not been generated yet')] };
  }
  const provenance = provenanceBlock(session.outputs.dataIntegration.meta);
  return {
    id: 'data-strategy',
    title: 'Data strategy',
    blocks: [
      ...(provenance === null ? [] : [provenance]),
      headingBlock(3, 'Data domains'),
      tableOrParagraph([...DOMAIN_COLUMNS], plan.domains.map(domainRow), 'No data domains were identified.'),
      headingBlock(3, 'Data topics'),
      ...topicBlocks(plan.topics),
    ],
  };
}
