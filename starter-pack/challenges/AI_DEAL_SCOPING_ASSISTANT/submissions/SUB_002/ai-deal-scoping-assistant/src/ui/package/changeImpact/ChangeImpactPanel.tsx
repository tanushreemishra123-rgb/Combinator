/**
 * "Change impact" tab: the modify form, its impact preview, the pending-updates panel and the
 * change log (spec 6, "Change-Impact Handling"; evaluation criterion 6).
 */
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { ScopingSession } from '../../../domain';
import { isScopeApproved } from '../../../scope';
import { selectPendingActions, selectStageStatuses, useActions, useAppState, useBusy } from '../../../state';
import type { ChangePreview, StageId } from '../../../state';
import { Button, Callout, Card, EmptyState } from '../../common';
import { useWorkspaceNavigation } from '../../navigation';
import { useRefNavigation } from '../navigationRefs';
import { ChangeForm } from './ChangeForm';
import { ChangeLog } from './ChangeLog';
import { createDefaultDraft, buildChangeMutation } from './changeTypes';
import type { ChangeDraft } from './changeTypes';
import { ImpactReportCard } from './ImpactReportCard';
import { PendingUpdates } from './PendingUpdates';

export interface ChangeImpactPanelProps {
  session: ScopingSession;
}

function NoScopeState(): ReactElement {
  return (
    <EmptyState
      title="No reviewed scope yet"
      message="Analyze the customer's requirements before modifying a requirement, assumption or configuration."
    />
  );
}

/**
 * Shown in place of the modify form while the reviewed scope is unapproved - either it was never
 * approved, or a scope edit bumped its version past the last approval. Pending updates and the
 * change log stay visible below this callout instead of disappearing with it.
 */
function ScopeNotApprovedState({ everApproved, version }: { everApproved: boolean; version: number }): ReactElement {
  const navigation = useWorkspaceNavigation();
  return (
    <Callout tone="warning" title="Approve the reviewed scope to modify it further">
      {everApproved
        ? `Change saved - approve scope version ${version} in the Customer Requirements Workspace to regenerate the stale sections.`
        : 'Changes are analysed against the reviewed scope model. Approve it in the Customer Requirements Workspace, then come back to modify it here.'}
      <div className="prerequisite-callout-action">
        <Button variant="secondary" onClick={() => navigation.navigate('requirements')}>
          Go to Customer Requirements Workspace
        </Button>
      </div>
    </Callout>
  );
}

export function ChangeImpactPanel({ session }: ChangeImpactPanelProps): ReactElement {
  const actions = useActions();
  const { aiSettings } = useAppState();
  const globalBusy = useBusy() !== null;
  const onSelectRef = useRefNavigation();

  const [draft, setDraft] = useState<ChangeDraft>(() => createDefaultDraft(session));
  const [preview, setPreview] = useState<ChangePreview | null>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [applyPending, setApplyPending] = useState(false);
  const [regeneratePending, setRegeneratePending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function updateDraft(patch: Partial<ChangeDraft>): void {
    setDraft((prev) => ({ ...prev, ...patch }));
    setPreview(null);
  }

  async function handlePreview(): Promise<void> {
    const mutation = buildChangeMutation(draft);
    if (mutation === null) {
      setFormError('Fill in every field for this change before previewing its impact.');
      return;
    }
    setFormError(null);
    setPreviewPending(true);
    try {
      setPreview(await actions.previewChange(mutation));
    } finally {
      setPreviewPending(false);
    }
  }

  async function handleApply(): Promise<void> {
    const mutation = buildChangeMutation(draft);
    if (mutation === null) {
      return;
    }
    setApplyPending(true);
    try {
      await actions.applyChange(mutation);
      setPreview(null);
    } finally {
      setApplyPending(false);
    }
  }

  /** With `stageId`, only that row's stage is regenerated; omitted, every stale stage is (the "Regenerate all" case). */
  async function handleRegenerateStale(stageId?: StageId): Promise<void> {
    setRegeneratePending(true);
    try {
      await actions.regenerateStale(stageId);
    } finally {
      setRegeneratePending(false);
    }
  }

  if (session.scope === null) {
    return <NoScopeState />;
  }

  const scopeApproved = isScopeApproved(session.scope);

  return (
    <div className="stack stack-lg">
      {scopeApproved ? (
        <Card title="Modify a requirement, assumption or configuration" subtitle="Choose one of the spec's example change types, then preview its impact before applying it.">
          <ChangeForm draft={draft} session={session} onChange={updateDraft} />
          {formError !== null ? <Callout tone="danger">{formError}</Callout> : null}
          <div className="cluster change-form-actions">
            <Button variant="secondary" onClick={() => void handlePreview()} busy={previewPending} disabled={globalBusy}>
              Preview impact
            </Button>
            <Button variant="primary" onClick={() => void handleApply()} busy={applyPending} disabled={globalBusy || preview === null}>
              Apply change
            </Button>
          </div>
        </Card>
      ) : (
        <ScopeNotApprovedState everApproved={session.scope.approvedVersion !== null} version={session.scope.version} />
      )}

      {scopeApproved && preview !== null ? (
        preview.reports.length === 0 ? (
          <Callout tone="info">This edit does not change anything the application tracks.</Callout>
        ) : (
          <div className="stack stack-md">
            {preview.reports.map((report) => (
              <ImpactReportCard key={report.id} report={report} aiSettings={aiSettings} onSelectRef={onSelectRef} />
            ))}
          </div>
        )
      ) : null}

      <PendingUpdates
        pendingActions={selectPendingActions(session)}
        stageStatuses={selectStageStatuses(session)}
        onRegenerate={(stageId) => void handleRegenerateStale(stageId)}
        busy={regeneratePending || globalBusy}
      />

      <ChangeLog reports={session.changeLog} />
    </div>
  );
}
