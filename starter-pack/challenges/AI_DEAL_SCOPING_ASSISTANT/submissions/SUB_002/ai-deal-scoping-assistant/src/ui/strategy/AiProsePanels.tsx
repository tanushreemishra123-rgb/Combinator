/**
 * Prose panels for the parts of the AI strategy that read better as paragraphs than as a table:
 * architecture pattern, prompt/structured-output management, evaluation approach, responsible-AI
 * and safety considerations, monitoring and feedback, and data privacy (spec 4).
 */
import type { ReactElement } from 'react';
import type { AiStrategyOutput } from '../../domain';
import { Card } from '../common';

export interface AiProsePanelsProps {
  strategy: AiStrategyOutput;
}

interface ProsePanel {
  title: string;
  content: ReactElement;
}

function responsibleAiContent(statements: readonly string[]): ReactElement {
  if (statements.length === 0) {
    return <p>No responsible-AI considerations have been generated yet.</p>;
  }
  return (
    <ul className="strategy-prose-list">
      {statements.map((statement) => (
        <li key={statement}>{statement}</li>
      ))}
    </ul>
  );
}

function panelsFor(strategy: AiStrategyOutput): ProsePanel[] {
  return [
    { title: 'AI architecture pattern', content: <p>{strategy.architecturePattern}</p> },
    { title: 'Prompt and structured-output management', content: <p>{strategy.promptManagement}</p> },
    { title: 'Evaluation approach', content: <p>{strategy.evaluationApproach}</p> },
    { title: 'Responsible AI and safety considerations', content: responsibleAiContent(strategy.responsibleAi) },
    { title: 'Monitoring and feedback', content: <p>{strategy.monitoringAndFeedback}</p> },
    { title: 'Data privacy', content: <p>{strategy.dataPrivacy}</p> },
  ];
}

export function AiProsePanels({ strategy }: AiProsePanelsProps): ReactElement {
  return (
    <div className="strategy-prose-grid">
      {panelsFor(strategy).map((panel) => (
        <Card key={panel.title} title={panel.title}>
          {panel.content}
        </Card>
      ))}
    </div>
  );
}
