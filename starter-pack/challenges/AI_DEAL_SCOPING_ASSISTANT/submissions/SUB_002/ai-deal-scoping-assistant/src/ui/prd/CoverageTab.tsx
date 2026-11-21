/**
 * "Requirement Coverage" tab (spec "PRD and Scope Workspace"): coverage tiles, the requirement x
 * capability matrix, and the uncovered/unsupported lists that let a reviewer trust cross-document
 * coverage without comparing documents by hand (Solution Depth Requirement).
 */
import type { ReactElement } from 'react';
import type { CoverageReport, PrdBundle } from '../../domain';
import { Card } from '../common';
import { CoverageMatrix } from './CoverageMatrix';
import { CoverageMetrics } from './CoverageMetrics';
import { PrdEmptyState } from './PrdEmptyState';
import { UncoveredRequirementsList } from './UncoveredRequirementsList';
import { UnsupportedAdditionsList } from './UnsupportedAdditionsList';

export interface CoverageTabProps {
  bundle: PrdBundle | null;
  coverage: CoverageReport | null;
  prerequisite: string | null;
  onSelectRequirement: (id: string) => void;
}

export function CoverageTab({ bundle, coverage, prerequisite, onSelectRequirement }: CoverageTabProps): ReactElement {
  if (bundle === null || coverage === null) {
    return <PrdEmptyState prerequisite={prerequisite} />;
  }

  const columns = [...bundle.functionalScope.capabilities, ...bundle.functionalScope.recommendedEnhancements];

  return (
    <div className="stack stack-lg">
      <CoverageMetrics coverage={coverage} />
      <Card
        title="Requirement x capability coverage matrix"
        subtitle="Every reviewed requirement against every capability and recommended enhancement."
      >
        <CoverageMatrix rows={coverage.rows} columns={columns} onSelectRequirement={onSelectRequirement} />
      </Card>
      <Card title="Uncovered requirements">
        <UncoveredRequirementsList rows={coverage.rows} onSelectRequirement={onSelectRequirement} />
      </Card>
      <Card title="Unsupported scope additions">
        <UnsupportedAdditionsList additions={coverage.unsupportedAdditions} />
      </Card>
    </div>
  );
}
