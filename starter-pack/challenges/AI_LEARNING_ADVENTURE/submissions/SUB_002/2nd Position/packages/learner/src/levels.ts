import type {
  CatalogDto,
  LevelTrack,
  MissionSummary,
  ProgressSnapshot,
} from '@ai-learning-adventure/types';
import { LEVEL_TRACK_LABELS, LEVEL_TRACK_SEQUENCE } from './tracks.ts';
import { missionStatusOf } from './missionAvailability.ts';

export type LevelLadderState = 'done' | 'current' | 'upcoming';

export interface LevelLadderRow {
  levelTrack: LevelTrack;
  label: string;
  completedCount: number;
  totalCount: number;
  state: LevelLadderState;
}

function missionsInTrack(catalog: CatalogDto, levelTrack: LevelTrack): MissionSummary[] {
  return catalog.missions.filter((mission) => mission.levelTrack === levelTrack);
}

function isTrackComplete(
  catalog: CatalogDto,
  snapshot: ProgressSnapshot,
  levelTrack: LevelTrack,
): boolean {
  const trackMissions = missionsInTrack(catalog, levelTrack);
  return (
    trackMissions.length > 0 &&
    trackMissions.every((mission) => missionStatusOf(snapshot, mission.id) === 'completed')
  );
}

export function currentLevelFor(catalog: CatalogDto, snapshot: ProgressSnapshot): LevelTrack {
  for (const track of LEVEL_TRACK_SEQUENCE) {
    const trackMissions = missionsInTrack(catalog, track);
    if (trackMissions.length === 0) continue;
    if (!isTrackComplete(catalog, snapshot, track)) return track;
  }
  return LEVEL_TRACK_SEQUENCE[LEVEL_TRACK_SEQUENCE.length - 1] ?? 'builder_mindset'; // nosemgrep: gitlab.eslint.detect-object-injection
}

export function deriveLevelLadder(
  catalog: CatalogDto,
  snapshot: ProgressSnapshot,
): LevelLadderRow[] {
  const rows: LevelLadderRow[] = [];
  let foundCurrent = false;
  for (const track of LEVEL_TRACK_SEQUENCE) {
    const trackMissions = missionsInTrack(catalog, track);
    if (trackMissions.length === 0) continue;
    const completedCount = trackMissions.filter(
      (mission) => missionStatusOf(snapshot, mission.id) === 'completed',
    ).length;
    const complete = completedCount === trackMissions.length;
    const state: LevelLadderState = complete ? 'done' : foundCurrent ? 'upcoming' : 'current';
    if (!complete) foundCurrent = true;
    rows.push({
      levelTrack: track,
      label: LEVEL_TRACK_LABELS[track], // nosemgrep: gitlab.eslint.detect-object-injection
      completedCount,
      totalCount: trackMissions.length,
      state,
    });
  }
  return rows;
}

export function nextIncompleteMissionForTrack(
  catalog: CatalogDto,
  snapshot: ProgressSnapshot,
  levelTrack: LevelTrack,
): MissionSummary | undefined {
  for (const mission of catalog.missions) {
    if (mission.levelTrack !== levelTrack) continue;
    if (missionStatusOf(snapshot, mission.id) === 'completed') continue;
    const prerequisiteCompleted =
      mission.prerequisiteMissionId === undefined ||
      missionStatusOf(snapshot, mission.prerequisiteMissionId) === 'completed';
    if (prerequisiteCompleted) return mission;
  }
  return undefined;
}
