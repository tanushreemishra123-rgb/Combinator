import type {
  CatalogDto,
  IsoDateTime,
  MissionId,
  MissionProgressStatus,
  ProgressProjection,
  ProgressSnapshot,
  QuizAttempt,
} from '@ai-learning-adventure/types';
import { currentLevelFor } from './levels.ts';

const MAX_WEAK_TOPICS = 5;

interface TopicSignal {
  weight: number;
  sources: Set<string>;
}

function addTopicSignal(
  signals: Map<string, TopicSignal>,
  topic: string,
  weight: number,
  source: string,
): void {
  const existing = signals.get(topic);
  if (existing === undefined) {
    signals.set(topic, { weight, sources: new Set([source]) });
    return;
  }
  existing.weight += weight;
  existing.sources.add(source);
}

export function deriveProgressProjection(
  catalog: CatalogDto,
  snapshot: ProgressSnapshot,
): ProgressProjection {
  const totalMissions = catalog.missions.length;
  let completedMissionCount = 0;
  for (const mission of catalog.missions) {
    if (snapshot.missions[mission.id]?.status === 'completed') { // nosemgrep: gitlab.eslint.detect-object-injection
      completedMissionCount += 1;
    }
  }

  const bestScoreByMission: Record<string, number> = {};
  const latestScoreByMission: Record<string, number> = {};
  const signals = new Map<string, TopicSignal>();
  const attemptsByCompletion = [...snapshot.attempts].sort((a, b) =>
    a.completedAt.localeCompare(b.completedAt),
  );
  for (const attempt of attemptsByCompletion) {
    const best = bestScoreByMission[attempt.missionId]; // nosemgrep: gitlab.eslint.detect-object-injection
    bestScoreByMission[attempt.missionId] = // nosemgrep: gitlab.eslint.detect-object-injection
      best === undefined ? attempt.scorePercent : Math.max(best, attempt.scorePercent);
    latestScoreByMission[attempt.missionId] = attempt.scorePercent; // nosemgrep: gitlab.eslint.detect-object-injection
    for (const answer of attempt.answers) {
      if (answer.isCorrect) continue;
      for (const tag of answer.conceptTags) {
        addTopicSignal(signals, tag, 1, `quiz:${attempt.missionId}`);
      }
    }
  }

  const weakTopics = [...signals.entries()]
    .sort((a, b) => b[1].weight - a[1].weight || a[0].localeCompare(b[0]))
    .slice(0, MAX_WEAK_TOPICS)
    .map(([topic, signal]) => ({
      topic,
      weight: signal.weight,
      sources: [...signal.sources].sort(),
    }));

  return {
    completionPercent:
      totalMissions === 0 ? 0 : Math.round((completedMissionCount / totalMissions) * 100),
    completedMissionCount,
    currentLevel: currentLevelFor(catalog, snapshot),
    bestScoreByMission,
    latestScoreByMission,
    weakTopics,
  };
}

export interface ScorePoint {
  attemptId: string;
  missionId: MissionId;
  scorePercent: number;
  completedAt: IsoDateTime;
}

export function scoreSeries(attempts: readonly QuizAttempt[]): ScorePoint[] {
  return [...attempts]
    .sort(
      (a, b) => a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id),
    )
    .map((attempt) => ({
      attemptId: attempt.id,
      missionId: attempt.missionId,
      scorePercent: attempt.scorePercent,
      completedAt: attempt.completedAt,
    }));
}

export interface MissionProgressRow {
  missionId: MissionId;
  status: MissionProgressStatus;
  bestScore?: number;
  latestScore?: number;
}

export function missionProgressRows(
  catalog: CatalogDto,
  snapshot: ProgressSnapshot,
): MissionProgressRow[] {
  return catalog.missions.map((mission) => {
    const status = snapshot.missions[mission.id]?.status ?? 'not_started'; // nosemgrep: gitlab.eslint.detect-object-injection
    const missionAttempts = snapshot.attempts.filter(
      (attempt) => attempt.missionId === mission.id,
    );
    const bestScore = missionAttempts.reduce<number | undefined>(
      (best, attempt) =>
        best === undefined ? attempt.scorePercent : Math.max(best, attempt.scorePercent),
      undefined,
    );
    const latest = missionAttempts.reduce<QuizAttempt | undefined>(
      (latestAttempt, attempt) =>
        latestAttempt === undefined || attempt.completedAt >= latestAttempt.completedAt
          ? attempt
          : latestAttempt,
      undefined,
    );
    return {
      missionId: mission.id,
      status,
      ...(bestScore !== undefined ? { bestScore } : {}),
      ...(latest !== undefined ? { latestScore: latest.scorePercent } : {}),
    };
  });
}
