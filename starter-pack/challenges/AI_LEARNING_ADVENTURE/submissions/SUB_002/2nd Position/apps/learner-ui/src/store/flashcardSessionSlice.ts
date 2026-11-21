import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { FlashcardId, FlashcardRatingValue, MissionId } from '@ai-learning-adventure/types';
import type { RootState } from './index.ts';

export type FlashcardDeckMode = 'mission' | 'review';

export interface FlashcardSessionState {
  mode: FlashcardDeckMode;
  missionId?: MissionId;
  topic?: string;
  cardIds: FlashcardId[];
  currentIndex: number;
  flipped: boolean;
  ratings: Record<string, FlashcardRatingValue>;
  shuffleSeed: number;
}

export interface FlashcardSessionSliceState {
  active?: FlashcardSessionState;
}

export interface StartDeckPayload {
  mode: FlashcardDeckMode;
  missionId?: MissionId;
  topic?: string;
  cardIds: FlashcardId[];
  shuffleSeed: number;
}

export interface RateCardLocalPayload {
  cardId: FlashcardId;
  rating: FlashcardRatingValue;
}

export interface ShuffleDeckPayload {
  seed: number;
  cardIds: FlashcardId[];
}

const initialState: FlashcardSessionSliceState = {};

export const flashcardSessionSlice = createSlice({
  name: 'flashcardSession',
  initialState,
  reducers: {
    startDeck(state, action: PayloadAction<StartDeckPayload>) {
      const { mode, missionId, topic, cardIds, shuffleSeed } = action.payload;
      state.active = {
        mode,
        missionId,
        topic,
        cardIds,
        currentIndex: 0,
        flipped: false,
        ratings: {},
        shuffleSeed,
      };
    },
    flipCard(state) {
      if (!state.active) return;
      state.active.flipped = !state.active.flipped;
    },
    nextCard(state) {
      if (!state.active) return;
      if (state.active.currentIndex < state.active.cardIds.length - 1) {
        state.active.currentIndex += 1;
        state.active.flipped = false;
      }
    },
    previousCard(state) {
      if (!state.active) return;
      if (state.active.currentIndex > 0) {
        state.active.currentIndex -= 1;
        state.active.flipped = false;
      }
    },
    rateCardLocal(state, action: PayloadAction<RateCardLocalPayload>) {
      if (!state.active) return;
      state.active.ratings[action.payload.cardId] /* nosemgrep: gitlab.eslint.detect-object-injection */ = action.payload.rating;
    },
    shuffleDeck(state, action: PayloadAction<ShuffleDeckPayload>) {
      if (!state.active) return;
      state.active.shuffleSeed = action.payload.seed;
      state.active.cardIds = action.payload.cardIds;
      state.active.currentIndex = 0;
      state.active.flipped = false;
    },
    restartDeck(state) {
      if (!state.active) return;
      state.active.currentIndex = 0;
      state.active.flipped = false;
    },
    endDeck(state) {
      state.active = undefined;
    },
  },
});

export const {
  startDeck,
  flipCard,
  nextCard,
  previousCard,
  rateCardLocal,
  shuffleDeck,
  restartDeck,
  endDeck,
} = flashcardSessionSlice.actions;

export function selectActiveDeck(state: RootState): FlashcardSessionState | undefined {
  return state.flashcardSession.active;
}

export function selectCurrentCardId(state: RootState): FlashcardId | undefined {
  const active = state.flashcardSession.active;
  if (!active) return undefined;
  return active.cardIds[active.currentIndex] /* nosemgrep: gitlab.eslint.detect-object-injection */;
}

export interface DeckProgressModel {
  total: number;
  currentIndex: number;
  reviewedCount: number;
  flipped: boolean;
}

export function selectDeckProgress(state: RootState): DeckProgressModel | undefined {
  const active = state.flashcardSession.active;
  if (!active) return undefined;
  return {
    total: active.cardIds.length,
    currentIndex: active.currentIndex,
    reviewedCount: Object.keys(active.ratings).length,
    flipped: active.flipped,
  };
}

export interface DeckSummaryModel {
  mode: FlashcardDeckMode;
  total: number;
  gotItCount: number;
  needsWorkCount: number;
  remainingCount: number;
}

export function selectDeckSummary(state: RootState): DeckSummaryModel | undefined {
  const active = state.flashcardSession.active;
  if (!active) return undefined;
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
}

const FLASHCARD_SESSION_STORAGE_KEY = 'learner-ui.flashcard-session.v1';
const FLASHCARD_SESSION_STORAGE_VERSION = 1;

function isDeckMode(value: unknown): value is FlashcardDeckMode {
  return value === 'mission' || value === 'review';
}

function isRatingValue(value: unknown): value is FlashcardRatingValue {
  return value === 'got_it' || value === 'needs_work';
}

function parseFlashcardSession(value: unknown): FlashcardSessionState | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    !isDeckMode(candidate.mode) ||
    typeof candidate.currentIndex !== 'number' ||
    typeof candidate.flipped !== 'boolean' ||
    typeof candidate.shuffleSeed !== 'number' ||
    !Array.isArray(candidate.cardIds) ||
    candidate.cardIds.some((id) => typeof id !== 'string') ||
    typeof candidate.ratings !== 'object' ||
    candidate.ratings === null
  ) {
    return undefined;
  }
  const ratings: Record<string, FlashcardRatingValue> = {};
  for (const [cardId, rating] of Object.entries(candidate.ratings as Record<string, unknown>)) {
    if (!isRatingValue(rating)) return undefined;
    ratings[cardId] /* nosemgrep: gitlab.eslint.detect-object-injection */ = rating;
  }
  const session: FlashcardSessionState = {
    mode: candidate.mode,
    cardIds: candidate.cardIds as FlashcardId[],
    currentIndex: candidate.currentIndex,
    flipped: candidate.flipped,
    ratings,
    shuffleSeed: candidate.shuffleSeed,
  };
  if (candidate.mode === 'mission' && typeof candidate.missionId !== 'string') return undefined;
  if (candidate.mode === 'mission') {
    session.missionId = candidate.missionId as MissionId;
  }
  if (typeof candidate.topic === 'string') {
    session.topic = candidate.topic;
  }
  return session;
}

export function loadPersistedFlashcardSession(): FlashcardSessionSliceState | undefined {
  try {
    const raw = sessionStorage.getItem(FLASHCARD_SESSION_STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<{ version: number; active: unknown }> | null;
    if (!parsed || parsed.version !== FLASHCARD_SESSION_STORAGE_VERSION) return undefined;
    const active = parseFlashcardSession(parsed.active);
    return active !== undefined ? { active } : undefined;
  } catch {
    return undefined;
  }
}

export function persistFlashcardSession(state: FlashcardSessionSliceState): void {
  try {
    const persisted = { version: FLASHCARD_SESSION_STORAGE_VERSION, active: state.active };
    sessionStorage.setItem(FLASHCARD_SESSION_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    return;
  }
}
