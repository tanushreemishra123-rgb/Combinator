import { useState } from 'react';
import { useAppDispatch } from '../../../store/index.ts';
import { clearAllMissionSessions } from '../../../store/missionSessionSlice.ts';
import { clearAiSession } from '../../../store/aiSlice.ts';
import { useResetProgress } from '../../../hooks/api/useProgressMutations.ts';

export interface StartOverControlProps {
  learnerId: string;
}

export function StartOverControl({ learnerId }: StartOverControlProps) {
  const dispatch = useAppDispatch();
  const { resetProgress, isMutating } = useResetProgress(learnerId);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  if (!confirming) {
    return (
      <button
        type="button"
        className="start-over"
        onClick={() => {
          setError(undefined);
          setConfirming(true);
        }}
      >
        Start over
      </button>
    );
  }

  async function handleConfirm(): Promise<void> {
    try {
      await resetProgress();
      dispatch(clearAllMissionSessions());
      dispatch(clearAiSession());
      setConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset progress.');
    }
  }

  return (
    <div className="start-over-confirm" role="alertdialog" aria-label="Confirm progress reset">
      <p id="start-over-confirm-text">Reset all progress? This cannot be undone.</p>
      <div className="start-over-confirm__actions">
        <button
          type="button"
          className="button button--danger"
          disabled={isMutating}
          aria-describedby="start-over-confirm-text"
          onClick={() => void handleConfirm()}
        >
          {isMutating ? 'Resetting…' : 'Yes, reset'}
        </button>
        <button
          type="button"
          className="button button--ghost"
          disabled={isMutating}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </button>
      </div>
      {error !== undefined && <p className="start-over-confirm__error">{error}</p>}
    </div>
  );
}
