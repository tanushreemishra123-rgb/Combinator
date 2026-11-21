import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  Flashcard,
  FlashcardId,
  FlashcardRatingValue,
  IsoDateTime,
  MissionId,
} from '@ai-learning-adventure/types';
import { shuffleDeck } from '@ai-learning-adventure/learner';
import { useAppDispatch, useAppSelector } from '../../../store/index.ts';
import {
  endDeck,
  flipCard,
  nextCard,
  previousCard,
  rateCardLocal,
  restartDeck,
  selectActiveDeck,
  shuffleDeck as shuffleDeckAction,
  startDeck,
  type DeckSummaryModel,
  type FlashcardDeckMode,
} from '../../../store/flashcardSessionSlice.ts';
import { useRateFlashcardAny } from '../../../hooks/api/useProgressMutations.ts';
import { createIdempotencyKey, type ApiRequestError } from '../../../hooks/api/client.ts';
import { announceLive } from '../../../hooks/ui/useLiveAnnouncement.ts';

export type { FlashcardDeckMode };

function nowIso(): IsoDateTime {
  return new Date().toISOString() as IsoDateTime;
}

export interface UseFlashcardDeckParams {
  mode: FlashcardDeckMode;
  missionId?: MissionId;
  topic?: string;
  cards: Flashcard[];
}

export interface UseFlashcardDeckResult {
  card?: Flashcard;
  mode?: FlashcardDeckMode;
  cardNumber: number;
  cardCount: number;
  flipped: boolean;
  canGoPrevious: boolean;
  canGoNext: boolean;
  reviewedCount: number;
  summary?: DeckSummaryModel;
  rating?: FlashcardRatingValue;
  isSaving: boolean;
  saveError?: ApiRequestError;
  flip: () => void;
  next: () => void;
  previous: () => void;
  rateCard: (rating: FlashcardRatingValue) => void;
  shuffle: () => void;
  restart: () => void;
  reviewNeedsWorkOnly: () => void;
  end: () => void;
  retrySave: () => void;
}

interface PendingRating {
  cardId: FlashcardId;
  rating: FlashcardRatingValue;
  occurredAt: IsoDateTime;
}

export function useFlashcardDeck(
  learnerId: string,
  { mode, missionId, topic, cards }: UseFlashcardDeckParams,
): UseFlashcardDeckResult {
  const dispatch = useAppDispatch();
  const active = useAppSelector(selectActiveDeck);
  const { rateFlashcard, isMutating: isSaving, error: saveError } = useRateFlashcardAny(learnerId);

  const progress = useMemo(() => {
    if (active === undefined) return undefined;
    return {
      total: active.cardIds.length,
      currentIndex: active.currentIndex,
      reviewedCount: Object.keys(active.ratings).length,
      flipped: active.flipped,
    };
  }, [active]);

  const summary = useMemo<DeckSummaryModel | undefined>(() => {
    if (active === undefined) return undefined;
    let gotItCount = 0;
    let needsWorkCount = 0;
    for (const rating of Object.values(active.ratings)) {
      if (rating === 'got_it') gotItCount += 1;
      else needsWorkCount += 1;
    }
    return {
      mode: active.mode,
      total: active.cardIds.length,
      gotItCount,
      needsWorkCount,
      remainingCount: active.cardIds.length - gotItCount - needsWorkCount,
    };
  }, [active]);

  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (cards.length === 0) return;
    const currentActive = activeRef.current;
    const stillValid =
      currentActive !== undefined &&
      currentActive.mode === mode &&
      (currentActive.missionId ?? '') === (missionId ?? '') &&
      (currentActive.topic ?? '') === (topic ?? '') &&
      currentActive.cardIds.length === cards.length &&
      cards.every((candidate) => currentActive.cardIds.includes(candidate.id));
    if (stillValid) return;
    dispatch(
      startDeck({
        mode,
        ...(missionId !== undefined ? { missionId } : {}),
        ...(topic !== undefined ? { topic } : {}),
        cardIds: cards.map((card) => card.id),
        shuffleSeed: 0,
      }),
    );
  }, [dispatch, mode, missionId, topic, cards]);

  const currentCardId = active?.cardIds[active?.currentIndex] /* nosemgrep: gitlab.eslint.detect-object-injection */;
  const card = cards.find((candidate) => (candidate.id as string) === (currentCardId as string));
  const rating = card !== undefined ? active?.ratings[card.id] /* nosemgrep: gitlab.eslint.detect-object-injection */ : undefined;

  const [pendingRating, setPendingRating] = useState<PendingRating | undefined>(undefined);

  const persistRating = useCallback(
    (input: PendingRating) => {
      rateFlashcard(input.cardId, {
        idempotencyKey: createIdempotencyKey(),
        rating: input.rating,
        occurredAt: input.occurredAt,
      }).catch((err: ApiRequestError) => {
        setPendingRating(input);
        announceLive(
          'The rating could not be saved. It is kept on this device — try again to save it.',
          'assertive',
        );
        return err;
      });
    },
    [rateFlashcard],
  );

  const flip = useCallback(() => {
    if (active === undefined) return;
    dispatch(flipCard());
  }, [active, dispatch]);

  const next = useCallback(() => {
    if (active === undefined) return;
    if (active.currentIndex >= active.cardIds.length - 1) return;
    dispatch(nextCard());
  }, [active, dispatch]);

  const previous = useCallback(() => {
    if (active === undefined) return;
    dispatch(previousCard());
  }, [active, dispatch]);

  const rateCard = useCallback(
    (nextRating: FlashcardRatingValue) => {
      if (active === undefined) return;
      const cardId = active.cardIds[active.currentIndex] /* nosemgrep: gitlab.eslint.detect-object-injection */;
      if (cardId === undefined) return;
      if (nextRating === 'needs_work' && !active.flipped && active.mode !== 'review') return;
      dispatch(rateCardLocal({ cardId, rating: nextRating }));
      announceLive(
        nextRating === 'got_it'
          ? 'Marked as Got it.'
          : 'Marked as Needs work — it will stay in your review list.',
      );
      const input: PendingRating = { cardId, rating: nextRating, occurredAt: nowIso() };
      setPendingRating(undefined);
      persistRating(input);
    },
    [active, dispatch, persistRating],
  );

  const shuffle = useCallback(() => {
    if (active === undefined) return;
    const randomBuffer = new Uint32Array(1);
    crypto.getRandomValues(randomBuffer);
    const seed = randomBuffer[0] & 0x7fffffff;
    dispatch(
      shuffleDeckAction({
        seed,
        cardIds: shuffleDeck(
          active.cardIds
            .map((id) => cards.find((candidate) => (candidate.id as string) === (id as string)))
            .filter((candidate): candidate is Flashcard => candidate !== undefined),
          seed,
        ).map((candidate) => candidate.id),
      }),
    );
    announceLive('Deck shuffled.');
  }, [active, dispatch, cards]);

  const restart = useCallback(() => {
    if (active === undefined) return;
    dispatch(restartDeck());
    announceLive('Deck restarted from the first card.');
  }, [active, dispatch]);

  const reviewNeedsWorkOnly = useCallback(() => {
    if (active === undefined) return;
    const needsWorkIds = active.cardIds.filter((id) => active.ratings[id] /* nosemgrep: gitlab.eslint.detect-object-injection */ === 'needs_work');
    if (needsWorkIds.length === 0) {
      announceLive('No cards are marked Needs work.');
      return;
    }
    dispatch(
      startDeck({
        mode: active.mode,
        ...(active.missionId !== undefined ? { missionId: active.missionId } : {}),
        ...(active.topic !== undefined ? { topic: active.topic } : {}),
        cardIds: needsWorkIds,
        shuffleSeed: active.shuffleSeed,
      }),
    );
    announceLive(`Restarted the deck with ${needsWorkIds.length} needs-work cards.`);
  }, [active, dispatch]);

  const end = useCallback(() => {
    dispatch(endDeck());
  }, [dispatch]);

  const retrySave = useCallback(() => {
    if (pendingRating === undefined) return;
    setPendingRating(undefined);
    persistRating(pendingRating);
  }, [pendingRating, persistRating]);

  return {
    ...(card !== undefined ? { card } : {}),
    ...(active !== undefined ? { mode: active.mode } : {}),
    cardNumber: progress !== undefined ? progress.currentIndex + 1 : 0,
    cardCount: progress?.total ?? 0,
    flipped: progress?.flipped ?? false,
    canGoPrevious: progress !== undefined && progress.currentIndex > 0,
    canGoNext:
      progress !== undefined && progress.currentIndex < progress.total - 1,
    reviewedCount: progress?.reviewedCount ?? 0,
    ...(summary !== undefined ? { summary } : {}),
    ...(rating !== undefined ? { rating } : {}),
    isSaving,
    ...(saveError !== undefined ? { saveError } : {}),
    flip,
    next,
    previous,
    rateCard,
    shuffle,
    restart,
    reviewNeedsWorkOnly,
    end,
    retrySave,
  };
}
