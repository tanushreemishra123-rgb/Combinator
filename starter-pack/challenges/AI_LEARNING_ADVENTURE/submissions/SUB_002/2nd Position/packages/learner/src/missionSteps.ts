import type { MissionStep } from '@ai-learning-adventure/types';

export const MISSION_STEP_SEQUENCE: readonly MissionStep[] = [
  'lesson',
  'example',
  'checkpoint',
  'quiz',
  'result',
];

export const MISSION_STEP_LABELS: Record<MissionStep, string> = {
  lesson: 'Lesson',
  example: 'Example',
  checkpoint: 'Checkpoint',
  quiz: 'Quiz',
  result: 'Result',
};

export function stepRank(step: MissionStep): number {
  return MISSION_STEP_SEQUENCE.indexOf(step);
}

export function furthestStepOf(a: MissionStep, b: MissionStep): MissionStep {
  return stepRank(a) >= stepRank(b) ? a : b;
}

export function previousStep(step: MissionStep): MissionStep | undefined {
  const index = stepRank(step);
  return index > 0 ? MISSION_STEP_SEQUENCE[index - 1] : undefined; // nosemgrep: gitlab.eslint.detect-object-injection
}

export function nextStep(step: MissionStep): MissionStep | undefined {
  const index = stepRank(step);
  return index < MISSION_STEP_SEQUENCE.length - 1 ? MISSION_STEP_SEQUENCE[index + 1] : undefined; // nosemgrep: gitlab.eslint.detect-object-injection
}

export function isStepUnlocked(step: MissionStep, furthestStep: MissionStep): boolean {
  return stepRank(step) <= stepRank(furthestStep);
}

export function clampStepToFurthest(step: MissionStep, furthestStep: MissionStep): MissionStep {
  return isStepUnlocked(step, furthestStep) ? step : furthestStep;
}
