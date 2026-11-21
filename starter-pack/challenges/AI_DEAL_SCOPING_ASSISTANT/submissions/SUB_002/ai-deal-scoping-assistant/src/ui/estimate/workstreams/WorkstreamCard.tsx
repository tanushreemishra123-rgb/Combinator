/**
 * One workstream in the spec's example format (spec 5): Workstream, Requirements, Complexity,
 * Estimated Effort range, Estimate Drivers, Commercial Basis, Confidence and Confidence
 * Limitation up front, with the driver table, adjustments, role allocation and calculation trace
 * behind an expander so the card stays scannable while everything stays reproducible.
 */
import type { ReactElement } from 'react';
import type { Complexity, WorkstreamEstimate } from '../../../domain';
import { Badge, Card, ComplexityBadge, ConfidenceBadge, Disclosure, KeyValueList, RefChips } from '../../common';
import { formatNumericRange } from '../format';
import { AdjustmentsList } from './AdjustmentsList';
import { CalculationList } from './CalculationList';
import { DriverTable } from './DriverTable';
import { RoleAllocationTable } from './RoleAllocationTable';
import { summarizeDrivers } from './summarize';

export interface WorkstreamCardProps {
  workstream: WorkstreamEstimate;
  currency: string;
  disabled: boolean;
  onSelectRequirement: (id: string) => void;
  onSetDriverComplexity: (driverId: string, complexity: Complexity) => void;
}

function confidenceLimitationText(limitations: readonly string[]): string {
  return limitations.length === 0 ? 'None recorded.' : limitations.join(' ');
}

export function WorkstreamCard({ workstream, currency, disabled, onSelectRequirement, onSetDriverComplexity }: WorkstreamCardProps): ReactElement {
  const title = (
    <span className="cluster">
      {workstream.name}
      <Badge tone="neutral">{workstream.phaseId}</Badge>
    </span>
  );

  return (
    <Card title={title} subtitle={workstream.commercialBasis}>
      <div className="stack stack-md">
        <KeyValueList
          columns={2}
          items={[
            { key: 'Requirements', value: <RefChips refs={workstream.requirementIds} onSelect={onSelectRequirement} /> },
            { key: 'Complexity', value: <ComplexityBadge complexity={workstream.complexity} /> },
            { key: 'Estimated effort', value: formatNumericRange(workstream.effortDays, 'person-days') },
            { key: 'Estimate drivers', value: summarizeDrivers(workstream.drivers) },
            { key: 'Confidence', value: <ConfidenceBadge confidence={workstream.confidence} /> },
            { key: 'Confidence limitation', value: confidenceLimitationText(workstream.confidenceLimitations) },
          ]}
        />
        <Disclosure summary="Drivers, adjustments, role allocation and calculation">
          <div className="stack stack-md">
            <DriverTable drivers={workstream.drivers} disabled={disabled} onSetDriverComplexity={onSetDriverComplexity} onSelectRequirement={onSelectRequirement} />
            <AdjustmentsList adjustments={workstream.adjustments} />
            <RoleAllocationTable roles={workstream.roles} currency={currency} caption={`Role allocation and cost for ${workstream.name}`} />
            <CalculationList steps={workstream.calculation} />
          </div>
        </Disclosure>
      </div>
    </Card>
  );
}
