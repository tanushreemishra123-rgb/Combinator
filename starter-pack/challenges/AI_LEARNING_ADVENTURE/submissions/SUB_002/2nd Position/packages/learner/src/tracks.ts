import type { Difficulty, LevelTrack, MissionProgressStatus } from '@ai-learning-adventure/types';

export const LEVEL_TRACK_SEQUENCE: readonly LevelTrack[] = [
  'beginner',
  'basic_understanding',
  'applied_practice',
  'responsible_use',
  'builder_mindset',
];

export const DIFFICULTY_SEQUENCE: readonly Difficulty[] = [
  'beginner',
  'intermediate',
  'advanced',
];

export const MISSION_STATUS_SEQUENCE: readonly MissionProgressStatus[] = [
  'not_started',
  'in_progress',
  'completed',
];

export const LEVEL_TRACK_LABELS: Record<LevelTrack, string> = {
  beginner: 'Beginner',
  basic_understanding: 'Basic Understanding',
  applied_practice: 'Applied Practice',
  responsible_use: 'Responsible Use',
  builder_mindset: 'Builder Mindset',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const MISSION_STATUS_LABELS: Record<MissionProgressStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
};

const trackRank = new Map<string, number>(
  LEVEL_TRACK_SEQUENCE.map((track, index) => [track, index]),
);

const difficultyRank = new Map<string, number>(
  DIFFICULTY_SEQUENCE.map((difficulty, index) => [difficulty, index]),
);

const statusRank = new Map<string, number>(
  MISSION_STATUS_SEQUENCE.map((status, index) => [status, index]),
);

export function compareLevelTracks(a: LevelTrack, b: LevelTrack): number {
  return (trackRank.get(a) ?? LEVEL_TRACK_SEQUENCE.length) - (trackRank.get(b) ?? LEVEL_TRACK_SEQUENCE.length);
}

export function compareDifficulties(a: Difficulty, b: Difficulty): number {
  return (difficultyRank.get(a) ?? DIFFICULTY_SEQUENCE.length) - (difficultyRank.get(b) ?? DIFFICULTY_SEQUENCE.length);
}

export function compareMissionStatuses(a: MissionProgressStatus, b: MissionProgressStatus): number {
  return (statusRank.get(a) ?? MISSION_STATUS_SEQUENCE.length) - (statusRank.get(b) ?? MISSION_STATUS_SEQUENCE.length);
}
