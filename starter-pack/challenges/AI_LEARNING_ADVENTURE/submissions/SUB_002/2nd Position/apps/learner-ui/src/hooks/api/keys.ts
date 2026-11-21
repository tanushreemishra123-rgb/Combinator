import type { FlashcardId, MissionId } from '@ai-learning-adventure/types';

export const apiKeys = {
  catalog(): string {
    return '/catalog';
  },
  mission(missionId: MissionId): string {
    return `/missions/${encodeURIComponent(missionId)}`;
  },
  progress(learnerId: string): string {
    return `/learners/${encodeURIComponent(learnerId)}/progress`;
  },
  missionProgress(learnerId: string, missionId: MissionId): string {
    return `/learners/${encodeURIComponent(learnerId)}/missions/${encodeURIComponent(missionId)}/progress`;
  },
  quizAttempts(learnerId: string): string {
    return `/learners/${encodeURIComponent(learnerId)}/quiz-attempts`;
  },
  flashcardRating(learnerId: string, flashcardId: FlashcardId): string {
    return `/learners/${encodeURIComponent(learnerId)}/flashcards/${encodeURIComponent(flashcardId)}/rating`;
  },
  progressImport(learnerId: string): string {
    return `/learners/${encodeURIComponent(learnerId)}/progress/import`;
  },
};
