import type {
  CatalogDto,
  MissionStep,
  MissionSummary,
  ProgressSnapshot,
} from '@ai-learning-adventure/types';
import { missionStatusOf } from './missionAvailability.ts';

export interface ResumeTarget {
  mission: MissionSummary;
  step: MissionStep;
}

export function findResumeTarget(
  catalog: CatalogDto,
  progress: ProgressSnapshot,
): ResumeTarget | undefined {
  if (catalog.missions.length === 0) return undefined;

  for (const mission of catalog.missions) {
    const missionProgress = progress.missions[mission.id]; // nosemgrep: gitlab.eslint.detect-object-injection
    if (missionProgress?.status === 'in_progress') {
      return { mission, step: missionProgress.furthestStep };
    }
  }

  for (const mission of catalog.missions) {
    const status = missionStatusOf(progress, mission.id);
    if (status === 'completed') continue;
    const prerequisiteCompleted =
      mission.prerequisiteMissionId === undefined ||
      missionStatusOf(progress, mission.prerequisiteMissionId) === 'completed';
    if (prerequisiteCompleted) {
      return { mission, step: 'lesson' };
    }
  }

  const first = catalog.missions[0];
  return first !== undefined ? { mission: first, step: 'lesson' } : undefined;
}

export function hasTouchedAnyMission(catalog: CatalogDto, progress: ProgressSnapshot): boolean {
  return catalog.missions.some((mission) => {
    const status = missionStatusOf(progress, mission.id);
    return status !== 'not_started';
  });
}
