import type { ReactNode } from 'react';
import { Button, Switch } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';
import type { AdminLifecycleStatus } from '@ai-learning-adventure/types';
import styles from './EditorFooter.module.scss';

export interface EditorFooterProps {
  status: AdminLifecycleStatus | undefined;
  enabled: boolean | undefined;
  dirty: boolean;
  saving: boolean;
  saveError: string | undefined;
  onSave: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onPreview?: () => void;
  onCancel?: () => void;
  children?: ReactNode;
}

export function EditorFooter({
  status,
  enabled,
  dirty,
  saving,
  saveError,
  onSave,
  onToggleEnabled,
  onPublish,
  onUnpublish,
  onPreview,
  onCancel,
  children,
}: EditorFooterProps) {
  return (
    <div className={styles.footer}>
      <div className={styles.left}>
        {status !== undefined && enabled !== undefined && <StatusBadge status={status} enabled={enabled} />}
        {enabled !== undefined && (
          <Switch checked={enabled} onChange={onToggleEnabled} label="Enabled" aria-label="Enabled" />
        )}
        {dirty && <span className={styles.unsaved}>Unsaved changes</span>}
        {saving && <span className={styles.saving}>Saving…</span>}
        {saveError !== undefined && (
          <span className={styles.error} role="alert">
            {saveError}
          </span>
        )}
      </div>
      <div className={styles.right}>
        {children}
        {onCancel !== undefined && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {onPreview !== undefined && (
          <Button variant="outline" onClick={onPreview}>
            Preview
          </Button>
        )}
        <Button variant="outline" onClick={onSave} disabled={saving}>
          Save draft
        </Button>
        {status === 'published' ? (
          <Button variant="ghost" onClick={onUnpublish}>
            Unpublish
          </Button>
        ) : status === 'published_changed' ? (
          <>
            <Button variant="ghost" onClick={onUnpublish}>
              Unpublish
            </Button>
            <Button variant="primary" onClick={onPublish}>
              Publish changes
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={onPublish}>
            Publish…
          </Button>
        )}
      </div>
    </div>
  );
}
