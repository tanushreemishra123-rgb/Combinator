/**
 * Landing screen shown while no session is active (spec Success Definition #1 - open the
 * application in a browser; #23 - run the complete seeded experience without paid AI access).
 * Introduces the product in the challenge's own language, offers the four seeded scenarios plus a
 * blank session, and states the two things a first-time reviewer needs to know: Mock AI mode needs
 * no key, and nothing leaves this browser.
 */
import type { ReactElement } from 'react';
import { useActions } from '../state';
import { SEED_SCENARIOS } from '../seed';
import { Button, Callout, Card } from '../ui/common';
import { useWorkspaceNavigation } from '../ui/navigation';
import { ScenarioCard } from './ScenarioCard';

/** The spec's own phrasing for the twelve journey steps ("Core User Journey"). */
const JOURNEY_HIGHLIGHTS: readonly string[] = [
  'Understand the customer need',
  'Review the extracted scope',
  'Clarify missing information',
  'Approve the requirements',
  'Generate the PRD',
  'Design the solution',
  'Plan the data flow',
  'Select the AI approach',
  'Estimate the delivery',
  'Review change impact',
  'Validate requirement coverage',
  'Prepare the scoping package',
];

export function WelcomeScreen(): ReactElement {
  const actions = useActions();
  const navigation = useWorkspaceNavigation();

  // A new session always opens on the first journey step, whatever workspace the address bar still points at.
  const startFromScenario = (scenarioId: string): void => {
    actions.createSessionFromScenario(scenarioId);
    navigation.navigate('requirements');
  };
  const startBlank = (): void => {
    actions.createNewSession('Untitled scoping session');
    navigation.navigate('requirements');
  };

  return (
    <div className="welcome-screen">
      <div className="welcome-hero">
        <h1>AI Deal Scoping Assistant</h1>
        <p className="text-muted">
          Turn unstructured customer requirements - RFPs, discovery-call notes, emails and existing-system information -
          into a structured, traceable and reviewable solution-scoping package: a customer-grounded PRD and functional
          scope, a cloud-specific solution architecture, a data and integration strategy, a recommended AI solution
          approach, and a transparent effort, timeline and ROM commercial estimate.
        </p>
      </div>
      <Card
        title="Start with a sample scenario"
        subtitle="Each one runs the full journey below in Mock AI mode - no API key or network access required."
      >
        <div className="scenario-grid">
          {SEED_SCENARIOS.map((scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} onSelect={startFromScenario} />
          ))}
        </div>
      </Card>
      <Card title="Or start from scratch">
        <div className="welcome-actions">
          <Button variant="primary" onClick={startBlank}>
            Start a blank scoping session
          </Button>
        </div>
      </Card>
      <div className="stack stack-sm">
        <Callout tone="info" title="Mock AI mode is on by default">
          Every seed scenario, and any custom requirements text you paste in, is analyzed by a deterministic mock AI
          engine - no API key or network access is required. You can switch to a live provider later from AI settings.
        </Callout>
        <Callout tone="success" title="Your data stays in this browser">
          Sessions are saved to this browser&apos;s local storage only. Nothing is sent anywhere unless you turn on
          Live AI mode or use Export.
        </Callout>
      </div>
      <Card title="The journey ahead">
        <ol className="welcome-journey">
          {JOURNEY_HIGHLIGHTS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
