/** "Risks, dependencies, assumptions and exclusions" (spec 5). */
import type { ReactElement } from 'react';
import type { EstimateNote } from '../../../domain';
import { Card } from '../../common';
import { NoteList } from './NoteList';

export interface RisksSectionProps {
  risks: EstimateNote[];
  dependencies: EstimateNote[];
  assumptions: EstimateNote[];
  exclusions: EstimateNote[];
  onSelectRequirement: (id: string) => void;
}

export function RisksSection({ risks, dependencies, assumptions, exclusions, onSelectRequirement }: RisksSectionProps): ReactElement {
  return (
    <Card title="Risks, dependencies, assumptions and exclusions" subtitle="Everything the AI flagged while proposing the workstreams, grounded in the reviewed scope where it cites one.">
      <div className="estimate-notes-grid">
        <NoteList title="Delivery risks" emptyMessage="No delivery risks were identified." notes={risks} onSelectRequirement={onSelectRequirement} />
        <NoteList title="Dependencies" emptyMessage="No delivery dependencies were identified." notes={dependencies} onSelectRequirement={onSelectRequirement} />
        <NoteList title="Assumptions" emptyMessage="No estimation assumptions were recorded." notes={assumptions} onSelectRequirement={onSelectRequirement} />
        <NoteList title="Exclusions" emptyMessage="Nothing was explicitly excluded from this estimate." notes={exclusions} onSelectRequirement={onSelectRequirement} />
      </div>
    </Card>
  );
}
