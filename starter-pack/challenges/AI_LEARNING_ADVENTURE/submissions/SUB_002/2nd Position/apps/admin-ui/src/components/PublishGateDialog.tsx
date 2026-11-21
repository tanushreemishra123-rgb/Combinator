import { useEffect, useState } from 'react';
import type { AdminEntityType, AdminValidationReport } from '@ai-learning-adventure/types';
import { Button, Checkbox, Dialog, TextArea, Typography } from '@/components/ui';
import { AdminApiError, adminApi } from '@/lib/api';
import styles from './PublishGateDialog.module.scss';

export interface PublishGateDialogProps {
  open: boolean;
  entityType: AdminEntityType;
  entityId: string;
  expectedRevision: number;
  allowDependentDrafts?: boolean;
  onClose: () => void;
  onPublished: () => void;
}

export function PublishGateDialog({
  open,
  entityType,
  entityId,
  expectedRevision,
  allowDependentDrafts = false,
  onClose,
  onPublished,
}: PublishGateDialogProps) {
  const [report, setReport] = useState<AdminValidationReport | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [acknowledged, setAcknowledged] = useState(false);
  const [note, setNote] = useState('');
  const [includeDependents, setIncludeDependents] = useState(true);
  const [busy, setBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    setAcknowledged(false);
    setNote('');
    setPublishError(undefined);
    setLoadError(undefined);
    setReport(undefined);
    let cancelled = false;
    adminApi
      .validation(entityType, entityId)
      .then((result) => {
        if (!cancelled) setReport(result);
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Validation failed.');
      });
    return () => {
      cancelled = true;
    };
  }, [open, entityType, entityId]);

  const blocking = report?.issues.filter((issue) => issue.severity === 'blocking') ?? [];
  const warnings = report?.issues.filter((issue) => issue.severity === 'warning') ?? [];
  const canPublish = report !== undefined && blocking.length === 0 && acknowledged && !busy;

  async function handlePublish() {
    setBusy(true);
    setPublishError(undefined);
    try {
      await adminApi.publish(entityType, entityId, {
        acknowledgement: true,
        note: note.trim().length > 0 ? note.trim() : undefined,
        expectedRevision,
        includeDependentDrafts: allowDependentDrafts && includeDependents,
      });
      onPublished();
    } catch (error) {
      if (error instanceof AdminApiError && error.code === 'revision_mismatch') {
        setPublishError('The content changed while the publish dialog was open. Close and reopen the editor.');
      } else if (error instanceof AdminApiError && error.code === 'validation_failed') {
        setPublishError(error.message);
        const refreshed = await adminApi.validation(entityType, entityId).catch(() => undefined);
        if (refreshed !== undefined) setReport(refreshed);
      } else {
        setPublishError(error instanceof Error ? error.message : 'Publish failed.');
      }
    } finally {
      setBusy(false);
    }
  }

  function jumpToField(field: string | undefined) {
    if (field === undefined) return;
    onClose();
    window.setTimeout(() => {
      document.getElementById(`field-${field}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Publish content"
      description="Review the validation results, confirm you validated this content, then publish."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void handlePublish()} disabled={!canPublish}>
            {busy ? 'Publishing…' : 'Publish'}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        {loadError !== undefined && (
          <div role="alert">
            <Typography color="danger">{loadError}</Typography>
          </div>
        )}
        {report === undefined && loadError === undefined && <Typography variant="body-muted">Running validation…</Typography>}

        {report !== undefined && blocking.length === 0 && (
          <div className={styles.clear}>
            <Typography color="success" weight="semibold">
              No blocking issues.
            </Typography>
          </div>
        )}

        {blocking.length > 0 && (
          <section className={styles.section} aria-label="Blocking issues">
            <Typography variant="label-caps" color="danger">
              Blocking issues ({blocking.length})
            </Typography>
            <ul className={styles.issueList}>
              {blocking.map((issue, index) => (
                <li key={`${issue.code}-${index}`} className={styles.issueBlocking}>
                  <span>{issue.message}</span>
                  {issue.field !== undefined && (
                    <button type="button" className={styles.jumpLink} onClick={() => jumpToField(issue.field)}>
                      Fix
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {warnings.length > 0 && (
          <section className={styles.section} aria-label="Warnings">
            <Typography variant="label-caps" color="warning">
              Warnings ({warnings.length})
            </Typography>
            <ul className={styles.issueList}>
              {warnings.map((issue, index) => (
                <li key={`${issue.code}-${index}`} className={styles.issueWarning}>
                  <span>{issue.message}</span>
                  {issue.field !== undefined && (
                    <button type="button" className={styles.jumpLink} onClick={() => jumpToField(issue.field)}>
                      Review
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {allowDependentDrafts && (
          <Checkbox
            label="Publish linked draft questions, flashcards, and awards together"
            description="Drafts assigned to this mission that fail validation will block the publish."
            checked={includeDependents}
            onChange={(event) => setIncludeDependents(event.target.checked)}
          />
        )}

        <Checkbox
          label="I have reviewed and validated this content."
          description="Required before publishing. Nothing is auto-published without this acknowledgement."
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
        />

        <TextArea
          label="Review note (optional)"
          hint="Stored in the publish history."
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />

        {publishError !== undefined && (
          <div role="alert">
            <Typography color="danger">{publishError}</Typography>
          </div>
        )}
        {!acknowledged && blocking.length === 0 && report !== undefined && (
          <Typography variant="body-muted">Tick the review acknowledgement to enable Publish.</Typography>
        )}
      </div>
    </Dialog>
  );
}
