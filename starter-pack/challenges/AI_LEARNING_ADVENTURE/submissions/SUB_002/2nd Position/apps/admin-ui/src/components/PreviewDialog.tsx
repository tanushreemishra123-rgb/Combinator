import { useEffect, useState } from 'react';
import { Button, Dialog, LoadingState, SegmentedGroup, Typography } from '@/components/ui';
import { adminApi } from '@/lib/api';
import styles from './PreviewDialog.module.scss';

const LEARNER_ORIGIN = process.env.NEXT_PUBLIC_LEARNER_URL ?? 'http://localhost:5173';

export interface PreviewDialogProps {
  open: boolean;
  missionId: string;
  onClose: () => void;
}

export function PreviewDialog({ open, missionId, onClose }: PreviewDialogProps) {
  const [token, setToken] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [device, setDevice] = useState('desktop');

  useEffect(() => {
    if (!open) return;
    setToken(undefined);
    setError(undefined);
    let cancelled = false;
    adminApi
      .createPreview(missionId)
      .then((result) => {
        if (!cancelled) setToken(result.token);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to open the preview.');
      });
    return () => {
      cancelled = true;
    };
  }, [open, missionId]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Learner preview"
      description="Renders the draft exactly as a learner sees it. Progress is not saved."
      size="lg"
      footer={
        <>
          <SegmentedGroup
            aria-label="Preview width"
            size="sm"
            value={device}
            onChange={setDevice}
            options={[
              { label: 'Desktop', value: 'desktop' },
              { label: 'Mobile', value: 'mobile' },
            ]}
          />
          <Button variant="primary" onClick={onClose}>
            Back to editor
          </Button>
        </>
      }
    >
      <div className={styles.banner} role="status">
        Preview — draft content, progress not saved
      </div>
      <div className={styles.frameWrap}>
        {error !== undefined && (
          <div role="alert">
            <Typography color="danger">{error}</Typography>
          </div>
        )}
        {token === undefined && error === undefined && <LoadingState label="Preparing preview…" />}
        {token !== undefined && (
          <iframe
            key={token}
            title="Learner preview"
            className={device === 'mobile' ? styles.frameMobile : styles.frameDesktop}
            src={`${LEARNER_ORIGIN}/?preview=${encodeURIComponent(token)}`}
          />
        )}
      </div>
    </Dialog>
  );
}
