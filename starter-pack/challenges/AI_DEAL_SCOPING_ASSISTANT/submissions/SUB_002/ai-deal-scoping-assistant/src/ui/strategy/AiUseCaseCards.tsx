/**
 * AI use case cards (spec 4, "AI Solution Approach"): pattern, model/provider options, retrieval,
 * orchestration, evaluation, safety, privacy, human review and monitoring, with any missing
 * safeguard flagged instead of silently left blank.
 */
import type { ReactElement, ReactNode } from 'react';
import { missingAiSafeguards } from '../../domain';
import type { AiSafeguardField, AiUseCase } from '../../domain';
import { Callout, Card, ComplexityBadge, EmptyState, KeyValueList, RefChips } from '../common';

export interface AiUseCaseCardsProps {
  useCases: AiUseCase[];
  onSelectRequirement: (id: string) => void;
}

/** How the workspace names each required safeguard, in the order the card lists them. */
const SAFEGUARD_FIELDS: readonly (readonly [string, AiSafeguardField])[] = [
  ['Evaluation approach', 'evaluation'],
  ['Safety controls', 'safety'],
  ['Privacy controls', 'privacy'],
  ['Human review', 'humanReview'],
];

function missingSafeguards(useCase: AiUseCase): string[] {
  const missing = new Set<AiSafeguardField>(missingAiSafeguards(useCase));
  return SAFEGUARD_FIELDS.filter(([, field]) => missing.has(field)).map(([label]) => label);
}

const OPTIONAL_DETAIL_FIELDS: readonly [string, (useCase: AiUseCase) => string][] = [
  ['Retrieval', (useCase) => useCase.retrieval],
  ['Orchestration', (useCase) => useCase.orchestration],
  ['Evaluation approach', (useCase) => useCase.evaluation],
  ['Safety controls', (useCase) => useCase.safety],
  ['Privacy controls', (useCase) => useCase.privacy],
  ['Human review', (useCase) => useCase.humanReview],
  ['Monitoring', (useCase) => useCase.monitoring],
];

function detailItems(useCase: AiUseCase): { key: string; value: ReactNode }[] {
  const items: { key: string; value: ReactNode }[] = [
    { key: 'Pattern', value: useCase.pattern },
    { key: 'Model or provider options', value: useCase.modelOptions.join(', ') },
  ];
  for (const [key, read] of OPTIONAL_DETAIL_FIELDS) {
    const value = read(useCase);
    if (value.trim().length > 0) {
      items.push({ key, value });
    }
  }
  return items;
}

export function AiUseCaseCards({ useCases, onSelectRequirement }: AiUseCaseCardsProps): ReactElement {
  if (useCases.length === 0) {
    return <EmptyState title="No AI use cases" message="No reviewed requirement currently signals an AI-driven capability." />;
  }

  return (
    <div className="strategy-card-grid">
      {useCases.map((useCase) => {
        const missing = missingSafeguards(useCase);
        return (
          <Card key={useCase.id} title={useCase.name} subtitle={useCase.description} actions={<ComplexityBadge complexity={useCase.complexity} />}>
            <div className="stack stack-sm">
              <KeyValueList items={detailItems(useCase)} />
              {missing.length > 0 ? (
                <Callout tone="warning" title="Missing safeguards">
                  {`This use case does not yet describe: ${missing.join(', ')}.`}
                </Callout>
              ) : null}
              <RefChips refs={useCase.requirementIds} onSelect={onSelectRequirement} />
            </div>
          </Card>
        );
      })}
    </div>
  );
}
