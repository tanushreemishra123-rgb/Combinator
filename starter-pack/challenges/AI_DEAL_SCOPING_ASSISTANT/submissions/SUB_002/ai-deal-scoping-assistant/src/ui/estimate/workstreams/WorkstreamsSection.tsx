/** "Workstreams" (spec 5): the AI-suggested breakdown, one card per workstream, drivers overridable by the reviewer. */
import type { ReactElement } from 'react';
import type { Complexity, WorkstreamEstimate } from '../../../domain';
import { AiGeneratedTag, Callout, EmptyState, SectionHeader } from '../../common';
import { WorkstreamCard } from './WorkstreamCard';

export interface WorkstreamsSectionProps {
  workstreams: WorkstreamEstimate[];
  explanation: string;
  currency: string;
  disabled: boolean;
  onSelectRequirement: (id: string) => void;
  onSetDriverComplexity: (driverId: string, complexity: Complexity) => void;
}

export function WorkstreamsSection({ workstreams, explanation, currency, disabled, onSelectRequirement, onSetDriverComplexity }: WorkstreamsSectionProps): ReactElement {
  return (
    <section className="stack stack-md">
      <SectionHeader as="h3" title="Workstreams" description="Major workstreams, their drivers and how each one's effort and cost were computed." />
      {workstreams.length === 0 ? (
        <EmptyState title="No workstreams yet" message="Estimate the delivery to identify workstreams from the reviewed scope." />
      ) : (
        <>
          <Callout tone="info" title="AI-generated estimate overview">
            <div className="stack stack-xs">
              <AiGeneratedTag />
              <p>{explanation}</p>
            </div>
          </Callout>
          <div className="stack stack-md">
            {workstreams.map((workstream) => (
              <WorkstreamCard
                key={workstream.id}
                workstream={workstream}
                currency={currency}
                disabled={disabled}
                onSelectRequirement={onSelectRequirement}
                onSetDriverComplexity={onSetDriverComplexity}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
