/** Framework/service recommendation cards (spec 4): solution-specific rationale, requirement chips and alternatives considered. */
import type { ReactElement } from 'react';
import type { FrameworkRecommendation } from '../../domain';
import { AiGeneratedTag, Badge, Card, Disclosure, EmptyState, RefChips } from '../common';

export interface FrameworkRecommendationCardsProps {
  frameworks: FrameworkRecommendation[];
  onSelectRequirement: (id: string) => void;
}

const CATEGORY_LABELS: ReadonlyMap<FrameworkRecommendation['category'], string> = new Map([
  ['orchestration', 'Orchestration'],
  ['model-service', 'Model service'],
  ['retrieval', 'Retrieval'],
  ['evaluation', 'Evaluation'],
  ['guardrails', 'Guardrails'],
  ['sdk', 'SDK'],
]);

export function FrameworkRecommendationCards({ frameworks, onSelectRequirement }: FrameworkRecommendationCardsProps): ReactElement {
  if (frameworks.length === 0) {
    return <EmptyState title="No framework recommendations yet" message="Recommendations follow once at least one AI use case is generated." />;
  }

  return (
    <div className="strategy-card-grid">
      {frameworks.map((framework) => (
        <Card
          key={`${framework.category}-${framework.name}`}
          title={framework.name}
          actions={<Badge tone="neutral">{CATEGORY_LABELS.get(framework.category) ?? framework.category}</Badge>}
        >
          <div className="stack stack-sm">
            <AiGeneratedTag label="AI-generated recommendation" />
            <p>{framework.rationale}</p>
            <RefChips refs={framework.requirementIds} onSelect={onSelectRequirement} />
            {framework.alternatives.length > 0 ? (
              <Disclosure summary="Alternatives considered">
                <ul className="strategy-alternatives-list">
                  {framework.alternatives.map((alternative) => (
                    <li key={alternative}>{alternative}</li>
                  ))}
                </ul>
              </Disclosure>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
