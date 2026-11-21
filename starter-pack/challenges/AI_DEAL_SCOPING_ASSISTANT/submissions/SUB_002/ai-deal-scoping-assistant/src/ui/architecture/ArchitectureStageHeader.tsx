/**
 * Architecture Workspace header: the Design/Redesign action gated on the PRD prerequisite, the
 * stage status, the generation audit line, the reviewed toggle and a collapsible list of
 * validation notes - mirrors every other workspace's header so a generation is always reported the
 * same way and a problem is never reported as a silent success.
 */
import type { ReactElement } from 'react';
import type { GenerationMeta, ValidationIssue } from '../../domain';
import type { StageStatusView } from '../../state';
import { Badge, Button, Callout, Disclosure, GenerationMetaLine, SectionHeader, StaleBanner, StatusPill, Toggle } from '../common';
import type { BadgeTone } from '../common';
import { SparklesIcon } from '../common/icons';

export interface ArchitectureStageHeaderProps {
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

export function ArchitectureStageHeader({ stage, meta, hasData, busy, onGenerate, onToggleReviewed }: ArchitectureStageHeaderProps): ReactElement {
  const pillStatus = stage.status === 'current' && stage.reviewed ? 'reviewed' : stage.status;
  const actionLabel = hasData ? 'Redesign the solution' : 'Design the solution';

  return (
    <header className="architecture-header stack stack-md">
      <SectionHeader
        eyebrow="Architecture Workspace"
        title="Cloud solution architecture"
        description="Review the proposed end-to-end architecture for the selected cloud platform, mapped to the requirements it satisfies."
        actions={<StatusPill status={pillStatus} />}
      />
      <div className="architecture-header-actions cluster">
        <Button variant="primary" icon={<SparklesIcon />} busy={busy} disabled={stage.prerequisite !== null} onClick={onGenerate}>
          {actionLabel}
        </Button>
        {hasData ? <Toggle checked={stage.reviewed} onChange={onToggleReviewed} label="Mark as reviewed" disabled={busy} /> : null}
      </div>
      {stage.prerequisite !== null ? <Callout tone="info">{stage.prerequisite}</Callout> : null}
      {meta ? <GenerationMetaLine meta={meta} /> : null}
      {meta ? <GenerationIssues issues={meta.issues} /> : null}
      {stage.status === 'stale' ? <StaleBanner reasons={stage.staleReasons} actionLabel="Redesign the solution" onAction={onGenerate} /> : null}
    </header>
  );
}
