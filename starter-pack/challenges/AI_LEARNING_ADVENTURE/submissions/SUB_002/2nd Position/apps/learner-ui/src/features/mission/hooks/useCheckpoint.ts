import { useCallback, useMemo } from 'react';
import type { Checkpoint, MissionId } from '@ai-learning-adventure/types';
import {
  createEmptyCheckpointDraft,
  evaluateCheckpoint,
  isCheckpointDraftComplete,
  type CheckpointDraft,
  type CheckpointEvaluation,
} from '@ai-learning-adventure/learner';
import { useAppDispatch, useAppSelector } from '../../../store/index.ts';
import {
  resetCheckpointSubmission,
  saveCheckpointDraft,
  selectMissionSession,
  type CheckpointSubmission,
} from '../../../store/missionSessionSlice.ts';
import { announceLive } from '../../../hooks/ui/useLiveAnnouncement.ts';

export const WRITE_RESPONSE_MAX_LENGTH = 2000;

export interface UseCheckpointResult {
  checkpoint: Checkpoint;
  draft: CheckpointDraft;
  submission?: CheckpointSubmission;
  evaluation?: CheckpointEvaluation;
  canSubmit: boolean;
  isSubmitted: boolean;
  updateDraft: (draft: CheckpointDraft) => void;
  submit: () => void;
  retry: () => void;
}

export function useCheckpoint(
  missionId: MissionId,
  checkpoint: Checkpoint,
  onCompleted: (evaluation: CheckpointEvaluation) => void,
): UseCheckpointResult {
  const dispatch = useAppDispatch();
  const session = useAppSelector(selectMissionSession(missionId));

  const draft = useMemo<CheckpointDraft>(
    () => session?.checkpointDraft ?? createEmptyCheckpointDraft(checkpoint),
    [session?.checkpointDraft, checkpoint],
  );

  const submission = session?.checkpointSubmission;
  const isSubmitted = submission !== undefined;
  const evaluation = useMemo(
    () => (isSubmitted ? (evaluateCheckpoint(checkpoint, draft) ?? undefined) : undefined),
    [isSubmitted, checkpoint, draft],
  );

  const canSubmit = !isSubmitted && isCheckpointDraftComplete(checkpoint, draft);

  const updateDraft = useCallback(
    (next: CheckpointDraft) => {
      dispatch(
        saveCheckpointDraft({ missionId, draft: next, touchedAt: new Date().toISOString() }),
      );
    },
    [dispatch, missionId],
  );

  const submit = useCallback(() => {
    const result = evaluateCheckpoint(checkpoint, draft);
    if (result === undefined) return;
    onCompleted(result);
    if (result.outcome === 'correct') {
      announceLive('Checkpoint complete. Nice work!');
    } else if (result.outcome === 'acknowledged') {
      announceLive('Thanks for writing that down. Checkpoint complete.');
    } else {
      announceLive('Not quite — review the feedback and try again.');
    }
  }, [checkpoint, draft, onCompleted]);

  const retry = useCallback(() => {
    dispatch(resetCheckpointSubmission(missionId));
  }, [dispatch, missionId]);

  return {
    checkpoint,
    draft,
    ...(submission !== undefined ? { submission } : {}),
    ...(evaluation !== undefined ? { evaluation } : {}),
    canSubmit,
    isSubmitted,
    updateDraft,
    submit,
    retry,
  };
}
