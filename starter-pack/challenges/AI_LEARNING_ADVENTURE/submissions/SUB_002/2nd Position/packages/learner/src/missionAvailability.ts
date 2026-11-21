import type {
  CatalogDto,
  MissionId,
  MissionProgressStatus,
  MissionSummary,
  ProgressSnapshot,
} from '@ai-learning-adventure/types';

export type MissionNodeState = 'locked' | 'available' | 'in_progress' | 'completed';

export interface MissionBrowserItem {
  mission: MissionSummary;
  index: number;
  state: MissionNodeState;
  status: MissionProgressStatus;
  prerequisite?: MissionSummary;
  bestScore?: number;
  earnedBadgeCount: number;
}

export function missionStatusOf(
  progress: ProgressSnapshot,
  missionId: MissionId,
): MissionProgressStatus {
  return progress.missions[missionId]?.status ?? 'not_started'; // nosemgrep: gitlab.eslint.detect-object-injection
}

export function deriveMissionAvailability(
  catalog: CatalogDto,
  progress: ProgressSnapshot,
): MissionBrowserItem[] {
  const summaries = new Map<string, MissionSummary>(
    catalog.missions.map((mission) => [mission.id, mission]),
  );
  const earnedAwardIds = new Set<string>(progress.earnedAwards.map((award) => award.awardId));

  return catalog.missions.map((mission, index) => {
    const status = missionStatusOf(progress, mission.id);
    const prerequisite =
      mission.prerequisiteMissionId !== undefined
        ? summaries.get(mission.prerequisiteMissionId)
        : undefined;
    const prerequisiteCompleted =
      mission.prerequisiteMissionId === undefined ||
      missionStatusOf(progress, mission.prerequisiteMissionId) === 'completed';

    let state: MissionNodeState;
    if (status === 'completed') {
      state = 'completed';
    } else if (status === 'in_progress') {
      state = 'in_progress';
    } else if (!prerequisiteCompleted) {
      state = 'locked';
    } else {
      state = 'available';
    }

    const earnedBadgeCount = catalog.awards.filter(
      (award) =>
        award.rule.type === 'mission_completed' &&
        award.rule.missionId === mission.id &&
        earnedAwardIds.has(award.id),
    ).length;

    const bestScore = progress.attempts
      .filter((attempt) => attempt.missionId === mission.id)
      .reduce<number | undefined>(
        (best, attempt) => (best === undefined ? attempt.scorePercent : Math.max(best, attempt.scorePercent)),
        undefined,
      );

    return {
      mission,
      index,
      state,
      status,
      ...(prerequisite !== undefined ? { prerequisite } : {}),
      ...(bestScore !== undefined ? { bestScore } : {}),
      earnedBadgeCount,
    };
  });
}
