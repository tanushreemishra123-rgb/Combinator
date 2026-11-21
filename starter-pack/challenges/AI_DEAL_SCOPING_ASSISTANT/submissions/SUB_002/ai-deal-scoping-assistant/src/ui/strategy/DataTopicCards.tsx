/**
 * The ten data-management topics as cards, in the spec's own wording (spec "Recommended
 * Application Sections" 4 / Functional Requirements 4). Always renders all ten, in the same order,
 * even when the plan has not produced every topic yet, so the workspace never silently drops one.
 */
import type { ReactElement } from 'react';
import { DATA_TOPICS } from '../../domain';
import type { DataTopic, DataTopicPlan } from '../../domain';
import { Card, RefChips } from '../common';

export interface DataTopicCardsProps {
  topics: DataTopicPlan[];
  onSelectRequirement: (id: string) => void;
}

const TOPIC_LABELS: ReadonlyMap<DataTopic, string> = new Map([
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

const NOT_PLANNED_TEXT = 'This topic has not been planned yet - regenerate the data and integration strategy once it is in scope.';

function findTopic(topics: readonly DataTopicPlan[], topic: DataTopic): DataTopicPlan | undefined {
  return topics.find((candidate) => candidate.topic === topic);
}

export function DataTopicCards({ topics, onSelectRequirement }: DataTopicCardsProps): ReactElement {
  return (
    <div className="strategy-card-grid">
      {DATA_TOPICS.map((topic) => {
        const plan = findTopic(topics, topic);
        const label = TOPIC_LABELS.get(topic) ?? topic;
        return (
          <Card key={topic} title={label}>
            <div className="stack stack-sm">
              <p>{plan?.approach ?? NOT_PLANNED_TEXT}</p>
              <p className="text-muted text-sm">
                Platform services: {plan !== undefined && plan.services.length > 0 ? plan.services.join(', ') : 'None selected yet'}
              </p>
              <RefChips refs={plan?.requirementIds ?? []} onSelect={onSelectRequirement} emptyLabel="No linked requirements" />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
