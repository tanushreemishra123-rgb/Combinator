/** Two headline coverage tiles: overall and High-priority-only requirement coverage. */
import type { ReactElement } from 'react';
import type { CoverageReport } from '../../domain';
import { MetricGrid, MetricTile } from '../common';
import type { MetricTone } from '../common';

export interface CoverageMetricsProps {
  coverage: CoverageReport;
}

const STRONG_COVERAGE_PCT = 80;
const PARTIAL_COVERAGE_PCT = 50;

function toneForPct(pct: number): MetricTone {
  if (pct >= STRONG_COVERAGE_PCT) {
    return 'success';
  }
  return pct >= PARTIAL_COVERAGE_PCT ? 'warning' : 'danger';
}

export function CoverageMetrics({ coverage }: CoverageMetricsProps): ReactElement {
  return (
    <MetricGrid>
      <MetricTile
        label="Overall requirement coverage"
        value={`${coverage.coveragePct}%`}
        tone={toneForPct(coverage.coveragePct)}
        hint={`${coverage.coveredRequirements} of ${coverage.totalRequirements} reviewed requirements covered`}
      />
      <MetricTile
        label="High-priority coverage"
        value={`${coverage.highPriorityCoveragePct}%`}
        tone={toneForPct(coverage.highPriorityCoveragePct)}
        hint="Coverage measured across only the High-priority requirements"
      />
    </MetricGrid>
  );
}
