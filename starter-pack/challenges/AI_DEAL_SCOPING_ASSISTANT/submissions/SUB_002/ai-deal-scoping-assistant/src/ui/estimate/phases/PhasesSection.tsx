/** "Delivery phases and timeline" (spec 5): the phases table plus its Gantt-style visualisation. */
import type { ReactElement } from 'react';
import type { PhaseEstimate } from '../../../domain';
import { Card, Disclosure, EmptyState } from '../../common';
import { CalculationList } from '../workstreams/CalculationList';
import { GanttChart } from './GanttChart';
import { PhasesTable } from './PhasesTable';

export interface PhasesSectionProps {
  phases: PhaseEstimate[];
  deadlineWeeks: number | null;
  /** Step-by-step derivation of the timeline weeks, so the schedule is as reproducible as the effort. */
  timelineCalculation?: readonly string[];
}

export function PhasesSection({ phases, deadlineWeeks, timelineCalculation = [] }: PhasesSectionProps): ReactElement {
  return (
    <Card title="Delivery phases and timeline" subtitle="Discovery through deployment, each phase's effort, duration, start week and milestone.">
      {phases.length === 0 ? (
        <EmptyState title="No phases yet" message="Phases appear once the estimate has at least one workstream." />
      ) : (
        <div className="stack stack-md">
          <PhasesTable phases={phases} />
          <GanttChart phases={phases} deadlineWeeks={deadlineWeeks} />
          {timelineCalculation.length === 0 ? null : (
            <Disclosure summary="How the timeline is calculated">
              <CalculationList steps={[...timelineCalculation]} />
            </Disclosure>
          )}
        </div>
      )}
    </Card>
  );
}
