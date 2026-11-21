/** Shown when the reviewed scope has no AI-driven capability: the explanation plus the deterministic boundaries (spec 4). */
import type { ReactElement } from 'react';
import type { AiStrategyOutput } from '../../domain';
import { Callout, TracedStatementList } from '../common';
import { AiBoundaryTable } from './AiBoundaryTable';

export interface AiNotApplicablePanelProps {
  strategy: AiStrategyOutput;
  onSelectRequirement: (id: string) => void;
}

export function AiNotApplicablePanel({ strategy, onSelectRequirement }: AiNotApplicablePanelProps): ReactElement {
  return (
    <div className="stack stack-lg">
      <Callout tone="info" title="No AI-driven capability in the reviewed scope">
        The reviewed requirements do not currently ask for an AI-driven capability, so this strategy stays deterministic. Add and
        approve a requirement that needs AI to generate use cases here.
      </Callout>
      <TracedStatementList statements={strategy.summary} onSelectRef={onSelectRequirement} />
      <AiBoundaryTable boundaries={strategy.boundaries} onSelectRequirement={onSelectRequirement} />
    </div>
  );
}
