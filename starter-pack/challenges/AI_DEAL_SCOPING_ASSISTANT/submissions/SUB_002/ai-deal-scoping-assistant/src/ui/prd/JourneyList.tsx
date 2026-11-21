/** User journeys rendered as persona-led step lists (spec: "User journeys or key workflows"). */
import type { ReactElement } from 'react';
import type { UserJourney } from '../../domain';
import { RefChips } from '../common';

export interface JourneyListProps {
  journeys: UserJourney[];
  onSelectRequirement: (id: string) => void;
}

export function JourneyList({ journeys, onSelectRequirement }: JourneyListProps): ReactElement {
  if (journeys.length === 0) {
    return <p className="text-muted text-sm">No user journeys generated yet.</p>;
  }

  return (
    <ul className="journey-list stack stack-md">
      {journeys.map((journey) => (
        <li key={journey.id} className="journey-card">
          <div className="journey-card-header cluster">
            <h4 className="journey-card-title">{journey.name}</h4>
            <span className="cluster text-sm">
              <span className="text-subtle text-xs">Persona</span>
              <RefChips
                refs={journey.persona.length > 0 ? [journey.persona] : []}
                onSelect={onSelectRequirement}
                emptyLabel="No persona recorded"
              />
            </span>
          </div>
          <ol className="journey-steps">
            {journey.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="cluster text-sm">
            <span className="text-subtle text-xs">Requirements</span>
            <RefChips refs={journey.requirementIds} onSelect={onSelectRequirement} />
          </div>
        </li>
      ))}
    </ul>
  );
}
