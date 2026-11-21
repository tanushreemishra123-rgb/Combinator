/**
 * Headline summary (spec 5: "Effort range", "Timeline range", "ROM commercial range", "Confidence
 * level"): the same totals every workstream and phase below adds up to, at a glance.
 */
import type { ReactElement } from 'react';
import type { Confidence, EstimateTotals } from '../../../domain';
import { Callout, ConfidenceBadge, MetricGrid, MetricTile } from '../../common';
import type { MetricTone } from '../../common';
import { formatMoneyRange, formatNumericRange } from '../format';

export interface SummaryTilesProps {
  totals: EstimateTotals;
  confidence: Confidence;
  deadlineAssessment: string;
}

function costTone(range: EstimateTotals['rom']): MetricTone {
  return range === null ? 'danger' : 'neutral';
}

export function SummaryTiles({ totals, confidence, deadlineAssessment }: SummaryTilesProps): ReactElement {
  return (
    <section className="stack stack-md">
      <MetricGrid>
        <MetricTile label="Effort" value={formatNumericRange(totals.effortDays, 'person-days')} hint={formatNumericRange(totals.effortPersonWeeks, 'person-weeks')} />
        <MetricTile label="Timeline" value={formatNumericRange(totals.timelineWeeks, 'weeks')} />
        <MetricTile label="ROM commercial range" value={formatMoneyRange(totals.rom)} tone={costTone(totals.rom)} />
        <MetricTile label="Contingency" value={formatMoneyRange(totals.contingency)} tone={costTone(totals.contingency)} />
        <MetricTile label="Overall confidence" value={<ConfidenceBadge confidence={confidence} />} />
      </MetricGrid>
      <Callout tone="info" title="Deadline assessment">
        {deadlineAssessment}
      </Callout>
    </section>
  );
}
