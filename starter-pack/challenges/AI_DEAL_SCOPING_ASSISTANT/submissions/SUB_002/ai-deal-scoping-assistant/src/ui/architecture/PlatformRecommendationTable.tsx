/**
 * Transparent, rule-based platform recommendation (Grounding and Information Hierarchy,
 * "AI-Generated Recommendations": must be clearly labelled and explain its own reasoning) - shown
 * even when the reviewer picks the platform manually, so the choice stays auditable. Computed live
 * from the current reviewed scope and configuration by the caller (`recommendPlatform`); every
 * point is a documented reason citing the scope item or configuration field that earned it.
 */
import type { ReactElement } from 'react';
import { platformLabel } from '../../architecture';
import type { PlatformRecommendation } from '../../domain';
import { AiGeneratedTag, Card, DataTable, RefChips } from '../common';
import type { DataTableColumn } from '../common';

export interface PlatformRecommendationTableProps {
  recommendation: PlatformRecommendation | null;
  onSelectRequirement: (id: string) => void;
}

type ScoreRow = PlatformRecommendation['scores'][number];

function ReasonsList({ reasons, onSelectRequirement }: { reasons: ScoreRow['reasons']; onSelectRequirement: (id: string) => void }): ReactElement {
  const scored = reasons.filter((reason) => reason.points !== 0);
  if (scored.length === 0) {
    return <p className="text-muted text-sm">No scoring signal found in the reviewed scope.</p>;
  }
  return (
    <ul className="platform-reason-list">
      {scored.map((reason) => (
        <li key={reason.text} className="stack stack-xs">
          <span className="text-sm">{`${reason.text} (+${reason.points})`}</span>
          <RefChips refs={reason.refs} onSelect={onSelectRequirement} emptyLabel="Configuration-based signal" />
        </li>
      ))}
    </ul>
  );
}

function buildColumns(onSelectRequirement: (id: string) => void): DataTableColumn<ScoreRow>[] {
  return [
    { id: 'platform', header: 'Platform', render: (row) => platformLabel(row.platform) },
    { id: 'score', header: 'Score', render: (row) => String(row.score), align: 'end' },
    { id: 'reasons', header: 'Reasons', render: (row) => <ReasonsList reasons={row.reasons} onSelectRequirement={onSelectRequirement} /> },
  ];
}

export function PlatformRecommendationTable({ recommendation, onSelectRequirement }: PlatformRecommendationTableProps): ReactElement {
  if (recommendation === null) {
    return (
      <Card title="Platform recommendation">
        <p className="text-muted text-sm">Approve the customer requirements to see a data-grounded platform recommendation.</p>
      </Card>
    );
  }

  return (
    <Card
      title="Platform recommendation"
      subtitle={`${platformLabel(recommendation.recommended)} is recommended for the reviewed scope; this updates as the scope and configuration change.`}
      actions={<AiGeneratedTag label="AI-generated recommendation - validate before relying on it" />}
    >
      <div className="stack stack-sm">
        <DataTable columns={buildColumns(onSelectRequirement)} rows={[...recommendation.scores]} getRowId={(row) => row.platform} caption="Cloud platform recommendation scoring" />
        <p className="text-muted text-sm">{recommendation.explanation}</p>
      </div>
    </Card>
  );
}
