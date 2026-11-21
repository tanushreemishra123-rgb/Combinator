import { useMemo } from 'react';
import useSWR from 'swr';
import type {
  ApiResponse,
  CatalogDto,
  Flashcard,
  MissionDetail,
  MissionDetailDto,
  MissionId,
  ProgressSnapshotDto,
} from '@ai-learning-adventure/types';
import type { WeakTopicSignal } from '@ai-learning-adventure/learner';
import { rankWeakTopics, selectReviewCards } from '@ai-learning-adventure/learner';
import { apiClient, type ApiRequestError } from '../../../hooks/api/client.ts';
import { apiKeys } from '../../../hooks/api/keys.ts';
import { selectAiReviewTopics } from '../../../store/aiSlice.ts';
import { useAppSelector } from '../../../store/index.ts';

export interface UseMissionDetailsResult {
  details: Record<string, MissionDetail>;
  isLoading: boolean;
  error?: ApiRequestError;
}

export function useMissionDetails(missionIds: readonly MissionId[]): UseMissionDetailsResult {
  const key =
    missionIds.length > 0
      ? `mission-details:${[...missionIds].map(String).sort().join(',')}`
      : null;
  const { data, isLoading, error } = useSWR<ApiResponse<MissionDetailDto>[], ApiRequestError>(
    key,
    async () => {
      const results = await Promise.allSettled(
        missionIds.map((id) => apiClient<MissionDetailDto>(apiKeys.mission(id))),
      );
      return results.flatMap((result) =>
        result.status === 'fulfilled' ? [result.value] : [],
      );
    },
  );
  const details = useMemo(() => {
    const map: Record<string, MissionDetail> = {};
    for (const response of data ?? []) {
      map[response.data.mission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */ = response.data.mission;
    }
    return map;
  }, [data]);
  return { details, isLoading, ...(error !== undefined ? { error } : {}) };
}

export interface UseReviewDeckResult {
  topics: WeakTopicSignal[];
  cards: Flashcard[];
  isLoading: boolean;
  hasTopicSignals: boolean;
}

export function useReviewDeck(
  catalog: CatalogDto,
  progress: ProgressSnapshotDto,
  topic?: string,
): UseReviewDeckResult {
  const { details, isLoading } = useMissionDetails(
    catalog.missions.map((mission) => mission.id),
  );
  const addedTopics = useAppSelector(selectAiReviewTopics);

  return useMemo(() => {
    const cards = Object.values(details).flatMap((mission) => mission.flashcards);
    const needsWorkTagInputs = Object.entries(progress.flashcardRatings).flatMap(
      ([cardId, rating]) => {
        if (rating.rating !== 'needs_work') return [];
        const card = cards.find((candidate) => (candidate.id as string) === cardId);
        return card !== undefined ? [{ tags: card.conceptTags }] : [];
      },
    );
    const topics = rankWeakTopics({ attempts: progress.attempts, needsWorkTagInputs });
    const knownTopics = new Set(topics.map((signal) => signal.topic));
    for (const addedTopic of addedTopics) {
      if (knownTopics.has(addedTopic)) continue;
      topics.push({ topic: addedTopic, weight: 1, sources: [] });
    }
    topics.sort((a, b) => b.weight - a.weight || a.topic.localeCompare(b.topic));
    const selectedTopics = topic !== undefined ? [topic] : topics.map((signal) => signal.topic);
    const selection = selectReviewCards({
      cards,
      ratings: progress.flashcardRatings,
      topics: selectedTopics,
    });
    return {
      topics,
      cards: selection.cards,
      isLoading,
      hasTopicSignals: topics.length > 0,
    };
  }, [addedTopics, details, progress.attempts, progress.flashcardRatings, topic, isLoading]);
}
