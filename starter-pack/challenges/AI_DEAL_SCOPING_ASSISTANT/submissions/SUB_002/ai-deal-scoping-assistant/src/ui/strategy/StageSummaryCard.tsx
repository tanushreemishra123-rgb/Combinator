/**
 * One generation stage's status row: the prerequisite message when it cannot run yet, the generate
 * action, a stale banner with its own regenerate action, and - once data exists - the generation
 * meta line, the reviewed toggle and any validation notes. Shared by the data/integration stage and
 * the AI-strategy stage so both read the same gating rules (see stageInfo.ts).
 */
import type { ReactElement } from 'react';
import { Button, Callout, Card, Disclosure, GenerationMetaLine, SparklesIcon, StaleBanner, StatusPill, Toggle, pluralize } from '../common';
import type { StageView } from './stageInfo';

export interface StageSummaryCardProps {
  title: string;
  description: string;
  actionLabel: string;
  regenerateLabel: string;
  view: StageView;
  onGenerate: () => void;
  onToggleReviewed: (reviewed: boolean) => void;
}

function IssuesDisclosure({ view }: { view: StageView }): ReactElement | null {
  if (view.meta === null || view.meta.issues.length === 0) {
    return null;
  }
  return (
    <Disclosure summary={pluralize(view.meta.issues.length, 'validation note')}>
      <ul className="strategy-issue-list">
        {view.meta.issues.map((issue) => (
          <li key={`${issue.code}-${issue.message}`} className={`strategy-issue strategy-issue-${issue.severity}`}>
            {issue.message}
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}

export function StageSummaryCard({ title, description, actionLabel, regenerateLabel, view, onGenerate, onToggleReviewed }: StageSummaryCardProps): ReactElement {
  const hasData = view.status !== 'empty';
  const buttonLabel = hasData ? regenerateLabel : actionLabel;

  return (
    <Card className="strategy-stage-card" title={title} subtitle={description} actions={<StatusPill status={view.pillStatus} />}>
      <div className="stack stack-sm">
        {view.prerequisite !== null ? (
          <Callout tone="warning" title="Not ready yet">
            {view.prerequisite}
          </Callout>
        ) : null}
        <Button variant="primary" size="sm" busy={view.isBusy} disabled={!view.canGenerate} icon={<SparklesIcon />} onClick={onGenerate}>
          {buttonLabel}
        </Button>
        {view.status === 'stale' ? <StaleBanner reasons={view.staleReasons} actionLabel={regenerateLabel} onAction={onGenerate} /> : null}
        {hasData ? (
          <>
            {view.meta !== null ? <GenerationMetaLine meta={view.meta} /> : null}
            <Toggle checked={view.reviewed} onChange={onToggleReviewed} label="Mark as reviewed" disabled={view.isBusy} />
            <IssuesDisclosure view={view} />
          </>
        ) : null}
      </div>
    </Card>
  );
}
