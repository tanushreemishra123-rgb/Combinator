/** Seed scenario picker: 4 cards with category + tagline, "Load scenario" creates/loads via the state use case. */
import type { ReactElement } from 'react';
import type { SeedScenario } from '../../../seed';
import { Badge, Button, Card } from '../../common';

export interface ScenarioPickerProps {
  scenarios: readonly SeedScenario[];
  activeScenarioId: string | null;
  onLoad: (scenarioId: string) => void;
}

const CATEGORY_LABELS: ReadonlyMap<SeedScenario['category'], string> = new Map([
  ['application-modernization', 'Application modernization'],
  ['data-integration', 'Data and integration'],
  ['ai-enabled', 'AI-enabled'],
  ['missing-information', 'Missing information'],
]);

export function ScenarioPicker({ scenarios, activeScenarioId, onLoad }: ScenarioPickerProps): ReactElement {
  return (
    <Card
      title="Start from a seed scenario"
      subtitle="Loads a new session pre-filled with sample requirements - the fastest way to see the assistant end to end."
    >
      <div className="requirements-scenario-grid">
        {scenarios.map((scenario) => (
          <article key={scenario.id} className="requirements-scenario-card">
            <Badge tone="info">{CATEGORY_LABELS.get(scenario.category) ?? scenario.category}</Badge>
            <h4 className="requirements-scenario-name">{scenario.name}</h4>
            <p className="text-muted text-sm">{scenario.tagline}</p>
            <Button
              variant={scenario.id === activeScenarioId ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => onLoad(scenario.id)}
            >
              {scenario.id === activeScenarioId ? 'Loaded - load again' : 'Load scenario'}
            </Button>
          </article>
        ))}
      </div>
    </Card>
  );
}
