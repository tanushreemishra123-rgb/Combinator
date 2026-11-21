/** Summary + stats tiles for the extracted scope: by kind, provenance and review state. */
import type { ReactElement } from 'react';
import type { ScopeModel } from '../../../domain';
import { scopeStats } from '../../../scope';
import { Card, MetricGrid, MetricTile } from '../../common';

export interface ScopeStatsPanelProps {
  scope: ScopeModel;
}

export function ScopeStatsPanel({ scope }: ScopeStatsPanelProps): ReactElement {
  const stats = scopeStats(scope);

  return (
    <Card title="Extracted scope summary" subtitle={scope.summary || 'No summary was produced for this analysis.'}>
      <MetricGrid>
        <MetricTile label="Total items" value={stats.totalItems} />
        <MetricTile label="Requirements in scope" value={stats.requirementCount} tone="primary" />
        <MetricTile label="Excluded requirements" value={stats.excludedRequirementCount} tone={stats.excludedRequirementCount > 0 ? 'warning' : 'neutral'} />
        <MetricTile label="Open questions" value={stats.openQuestionCount} tone={stats.openQuestionCount > 0 ? 'warning' : 'success'} />
        <MetricTile label="Unvalidated assumptions" value={stats.unvalidatedAssumptionCount} tone={stats.unvalidatedAssumptionCount > 0 ? 'warning' : 'success'} />
        <MetricTile label="Open gaps" value={stats.openGapCount} tone={stats.openGapCount > 0 ? 'danger' : 'success'} />
      </MetricGrid>
      <div className="requirements-stats-breakdown">
        <div>
          <p className="text-subtle text-sm">By type</p>
          <ul className="cluster">
            {stats.byKind.filter((entry) => entry.count > 0).map((entry) => (
              <li key={entry.kind} className="requirements-stat-chip">
                {entry.label}: {entry.count}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-subtle text-sm">By provenance</p>
          <ul className="cluster">
            {stats.byProvenance.map((entry) => (
              <li key={entry.provenance} className="requirements-stat-chip">
                {entry.label}: {entry.count}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-subtle text-sm">By review state</p>
          <ul className="cluster">
            {stats.byReview.map((entry) => (
              <li key={entry.review} className="requirements-stat-chip">
                {entry.label}: {entry.count}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
