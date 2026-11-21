/**
 * PRD workspace header (spec "PRD and Scope Workspace"): the Generate/Regenerate action gated on
 * the scope-approval prerequisite, the stage status, the audit line for the last generation, a
 * reviewed toggle, and - when generation left validation notes - a collapsible list of them so a
 * problem is never reported as a silent success.
 */
import type { ReactElement } from 'react';
import type { GenerationMeta, ValidationIssue } from '../../domain';
import type { StageStatusView } from '../../state';
import { Badge, Button, Callout, Disclosure, GenerationMetaLine, SectionHeader, StaleBanner, StatusPill, Toggle } from '../common';
import type { BadgeTone } from '../common';
import { SparklesIcon } from '../common/icons';
import { toStatusPillStatus } from './statusHelpers';

export interface PrdWorkspaceHeaderProps {
  stage: StageStatusView;
  meta: GenerationMeta | null;
  hasData: boolean;
  busy: boolean;
  onGenerate: () => void;
  onToggleReviewed: (reviewed: boolean) => void;
}

const ISSUE_TONES: ReadonlyMap<ValidationIssue['severity'], BadgeTone> = new Map([
  ['error', 'danger'],
  ['warning', 'warning'],
  ['info', 'info'],
]);

function GenerationIssues({ issues }: { issues: ValidationIssue[] }): ReactElement | null {
  if (issues.length === 0) {
    return null;
  }
  return (
    <Disclosure summary={`Generation notes (${issues.length})`}>
      <ul className="stack stack-xs">
        {issues.map((issue) => (
          <li key={`${issue.code}-${issue.message}`} className="cluster">
            <Badge tone={ISSUE_TONES.get(issue.severity) ?? 'neutral'}>{issue.severity}</Badge>
            <span className="text-sm">{issue.message}</span>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

export function PrdWorkspaceHeader({ stage, meta, hasData, busy, onGenerate, onToggleReviewed }: PrdWorkspaceHeaderProps): ReactElement {
  const pillStatus = toStatusPillStatus(stage.status, stage.reviewed);
  const actionLabel = hasData ? 'Regenerate the PRD' : 'Generate the PRD';

  return (
    <header className="prd-header stack stack-md">
      <SectionHeader
        eyebrow="PRD and Scope Workspace"
        title="Product Requirements Document and functional scope"
        description="Review the customer-grounded PRD, the functional scope it decomposes into, and requirement coverage across both."
        actions={<StatusPill status={pillStatus} />}
      />
      <div className="prd-header-actions cluster">
        <Button variant="primary" icon={<SparklesIcon />} busy={busy} disabled={stage.prerequisite !== null} onClick={onGenerate}>
          {actionLabel}
        </Button>
        {hasData ? <Toggle checked={stage.reviewed} onChange={onToggleReviewed} label="Mark as reviewed" disabled={busy} /> : null}
      </div>
      {stage.prerequisite !== null ? <Callout tone="info">{stage.prerequisite}</Callout> : null}
      {meta ? <GenerationMetaLine meta={meta} /> : null}
      {meta ? <GenerationIssues issues={meta.issues} /> : null}
      {stage.status === 'stale' ? <StaleBanner reasons={stage.staleReasons} actionLabel="Regenerate the PRD" onAction={onGenerate} /> : null}
    </header>
  );
}
