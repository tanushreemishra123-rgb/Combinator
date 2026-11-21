import type {
  CatalogDto,
  MissionId,
  MissionSummary,
  ProgressSnapshot,
  QuizAttempt,
} from '@ai-learning-adventure/types';
import { missionStatusOf } from './missionAvailability.ts';

export interface MissionCompletionInput {
  missionId: MissionId;
  checkpointCompleted: boolean;
  attempts: readonly QuizAttempt[];
}

export function attemptsForMission(
  attempts: readonly QuizAttempt[],
  missionId: MissionId,
): QuizAttempt[] {
  return attempts.filter((attempt) => attempt.missionId === missionId);
}

export function hasPassedAttempt(
  attempts: readonly QuizAttempt[],
  missionId: MissionId,
): boolean {
  return attemptsForMission(attempts, missionId).some((attempt) => attempt.result === 'passed');
}

export function isMissionComplete(input: MissionCompletionInput): boolean {
  return input.checkpointCompleted && hasPassedAttempt(input.attempts, input.missionId);
}

export function latestAttemptFor(
  attempts: readonly QuizAttempt[],
  missionId: MissionId,
): QuizAttempt | undefined {
  const missionAttempts = attemptsForMission(attempts, missionId);
  return [...missionAttempts].sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0];
}

export function bestScoreFor(
  attempts: readonly QuizAttempt[],
  missionId: MissionId,
): number | undefined {
  return attemptsForMission(attempts, missionId).reduce<number | undefined>(
    (best, attempt) => (best === undefined ? attempt.scorePercent : Math.max(best, attempt.scorePercent)),
    undefined,
  );
}

export function recommendNextMission(
  catalog: CatalogDto,
  progress: ProgressSnapshot,
  excludeMissionId?: MissionId,
): MissionSummary | undefined {
  for (const mission of catalog.missions) {
    if (excludeMissionId !== undefined && mission.id === excludeMissionId) continue;
    if (missionStatusOf(progress, mission.id) === 'completed') continue;
    const prerequisiteCompleted =
      mission.prerequisiteMissionId === undefined ||
      missionStatusOf(progress, mission.prerequisiteMissionId) === 'completed';
    if (prerequisiteCompleted) return mission;
  }
  return undefined;
}
