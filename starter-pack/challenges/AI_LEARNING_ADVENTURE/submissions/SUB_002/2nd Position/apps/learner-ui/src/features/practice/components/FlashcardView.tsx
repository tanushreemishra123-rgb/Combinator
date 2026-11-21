import { useMemo } from 'react';
import type { CatalogDto, ProgressSnapshotDto } from '@ai-learning-adventure/types';
import { buildMissionDeck } from '@ai-learning-adventure/learner';
import type { LearnerView } from '../../../store/navigationSlice.ts';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';
import { useMission } from '../../../hooks/api/useMission.ts';
import { useFlashcardDeck } from '../hooks/useFlashcardDeck.ts';
import { useReviewDeck } from '../hooks/useReviewDeck.ts';
import { FlashcardPlayer } from './FlashcardPlayer.tsx';

export type FlashcardsViewType = Extract<LearnerView, { kind: 'flashcards' }>;

export interface FlashcardViewProps {
  learnerId: string;
  view: FlashcardsViewType;
  catalog: CatalogDto;
  progress: ProgressSnapshotDto;
}

export function FlashcardView({ learnerId, view, catalog, progress }: FlashcardViewProps) {
  const { back } = useAppNavigation();
  const isReview = view.mode === 'review';
  const missionResult = useMission(isReview ? undefined : view.missionId);
  const review = useReviewDeck(catalog, progress, view.topic);

  const cards = useMemo(() => {
    if (view.mode === 'mission') {
      return missionResult.mission !== undefined
        ? buildMissionDeck(missionResult.mission.flashcards)
        : [];
    }
    return review.cards;
  }, [view.mode, missionResult.mission, review.cards]);

  const deck = useFlashcardDeck(learnerId, {
    mode: view.mode,
    ...(view.missionId !== undefined ? { missionId: view.missionId } : {}),
    ...(view.topic !== undefined ? { topic: view.topic } : {}),
    cards,
  });

  const isLoading =
    (view.mode === 'mission' && missionResult.isLoading) ||
    (view.mode === 'review' && review.isLoading);

  if (missionResult.error !== undefined) {
    return (
      <div className="app-status" role="alert">
        <h1>This deck could not be loaded</h1>
        <p>{missionResult.error.message}</p>
        <div>
          <button
            type="button"
            className="app-status__retry"
            onClick={() => void missionResult.refresh()}
          >
            Try again
          </button>
          <button type="button" className="button button--ghost" onClick={back}>
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="app-status" role="status">
        <p>Loading cards…</p>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="app-status" role="status">
        <h1>No cards to review</h1>
        <p>Nothing to review yet — great work!</p>
        <button type="button" className="button button--ghost" onClick={back}>
          Go back
        </button>
      </div>
    );
  }

  const title =
    view.mode === 'mission'
      ? `${missionResult.mission?.title ?? 'Mission'} flashcards`
      : view.topic !== undefined
        ? `Review · ${view.topic}`
        : 'Review deck';

  return <FlashcardPlayer title={title} deck={deck} onExit={back} />;
}
