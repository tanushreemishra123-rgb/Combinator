import type {
  AwardDefinition,
  AwardId,
  CatalogDto,
  IsoDateTime,
  MissionId,
  MissionProgress,
  MissionProgressStatus,
  MissionStep,
  MissionSummary,
  ProgressSnapshot,
  QuizAttempt,
} from '@ai-learning-adventure/types';

export function missionId(value: string): MissionId {
  return value as MissionId;
}

export function iso(value: string): IsoDateTime {
  return value as IsoDateTime;
}

export interface MissionFixtureInput {
  id: string;
  title?: string;
  difficulty?: MissionSummary['difficulty'];
  levelTrack?: MissionSummary['levelTrack'];
  trackOrder?: number;
  prerequisiteMissionId?: string;
  estimatedMinutes?: number;
}

export function makeMission(input: MissionFixtureInput): MissionSummary {
  return {
    id: missionId(input.id),
    title: input.title ?? `Mission ${input.id}`,
    difficulty: input.difficulty ?? 'beginner',
    levelTrack: input.levelTrack ?? 'beginner',
    trackOrder: input.trackOrder ?? 1,
    objective: `Objective for ${input.id}`,
    ...(input.prerequisiteMissionId !== undefined
      ? { prerequisiteMissionId: missionId(input.prerequisiteMissionId) }
      : {}),
    estimatedMinutes: input.estimatedMinutes ?? 10,
    contentVersion: 1,
  };
}

export function makeAward(missionIdValue: string): AwardDefinition {
  return {
    id: `award-${missionIdValue}` as AwardId,
    kind: 'badge',
    name: `Badge for ${missionIdValue}`,
    icon: 'star',
    description: 'Awarded for completing the mission.',
    missionId: missionId(missionIdValue),
    rule: { type: 'mission_completed', missionId: missionId(missionIdValue) },
  };
}

export function makeCatalog(missions: MissionSummary[]): CatalogDto {
  return {
    contentVersion: 'test',
    missions,
    awards: missions.map((mission) => makeAward(mission.id)),
  };
}

export interface MissionProgressInput {
  status: MissionProgressStatus;
  furthestStep?: MissionStep;
  checkpointCompleted?: boolean;
}

export function makeMissionProgress(
  id: string,
  input: MissionProgressInput,
): MissionProgress {
  return {
    missionId: missionId(id),
    status: input.status,
    furthestStep: input.furthestStep ?? 'lesson',
    checkpointCompleted: input.checkpointCompleted ?? false,
    startedAt: iso('2026-08-01T00:00:00.000Z'),
    ...(input.status === 'completed' ? { completedAt: iso('2026-08-02T00:00:00.000Z') } : {}),
  };
}

export function makeAttempt(id: string, missionIdValue: string, scorePercent: number): QuizAttempt {
  return {
    id,
    missionId: missionId(missionIdValue),
    contentVersion: 1,
    answers: [],
    scorePercent,
    correctCount: Math.round(scorePercent / 20),
    questionCount: 5,
    result: scorePercent >= 70 ? 'passed' : 'needs_review',
    weakTopics: [],
    startedAt: iso('2026-08-01T00:00:00.000Z'),
    completedAt: iso('2026-08-01T00:10:00.000Z'),
  };
}

export interface SnapshotInput {
  missions?: Record<string, MissionProgress>;
  attempts?: QuizAttempt[];
  earnedAwardIds?: string[];
}

export function makeSnapshot(input: SnapshotInput = {}): ProgressSnapshot {
  return {
    learnerId: 'learner-1',
    schemaVersion: 1,
    revision: iso('2026-08-01T00:00:00.000Z'),
    missions: input.missions ?? {},
    attempts: input.attempts ?? [],
    flashcardRatings: {},
    earnedAwards: (input.earnedAwardIds ?? []).map((awardId) => ({
      awardId: awardId as AwardId,
      earnedAt: iso('2026-08-02T00:00:00.000Z'),
    })),
  };
}

export function linearCatalog(count: number): { catalog: CatalogDto; ids: string[] } {
  const ids = Array.from({ length: count }, (_, index) => `mission-${index + 1}`);
  const missions = ids.map((id, index) =>
    makeMission({
      id,
      title: `Mission ${index + 1}`,
      trackOrder: index + 1,
      ...(index > 0 ? { prerequisiteMissionId: ids[index - 1] } : {}), // nosemgrep: gitlab.eslint.detect-object-injection
    }),
  );
  return { catalog: makeCatalog(missions), ids };
}
