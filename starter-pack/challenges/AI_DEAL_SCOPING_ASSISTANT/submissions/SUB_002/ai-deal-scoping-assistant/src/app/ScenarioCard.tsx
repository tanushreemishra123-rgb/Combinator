/** One seeded scenario on the welcome screen: its name, category and tagline, and a way to start it. */
import type { ReactElement } from 'react';
import type { SeedScenario } from '../seed';
import { Button, Card } from '../ui/common';
import { scenarioCategoryLabel } from './scenarioLabels';

export interface ScenarioCardProps {
  scenario: SeedScenario;
  onSelect: (scenarioId: string) => void;
}

export function ScenarioCard({ scenario, onSelect }: ScenarioCardProps): ReactElement {
  return (
    <Card
      className="scenario-card"
      title={scenario.name}
      subtitle={scenarioCategoryLabel(scenario.category)}
      footer={
        <Button variant="secondary" fullWidth onClick={() => onSelect(scenario.id)}>
          Use this scenario
        </Button>
      }
    >
      <p className="text-sm text-muted">{scenario.tagline}</p>
    </Card>
  );
}
