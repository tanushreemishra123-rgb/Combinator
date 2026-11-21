import { describe, expect, it } from 'vitest';
import {
  clampStepToFurthest,
  furthestStepOf,
  isStepUnlocked,
  MISSION_STEP_LABELS,
  MISSION_STEP_SEQUENCE,
  nextStep,
  previousStep,
  stepRank,
} from '../src/missionSteps.ts';

describe('MISSION_STEP_SEQUENCE', () => {
  it('orders lesson, example, checkpoint, quiz, result', () => {
    expect(MISSION_STEP_SEQUENCE).toEqual(['lesson', 'example', 'checkpoint', 'quiz', 'result']);
  });

  it('has a label for every step', () => {
    for (const step of MISSION_STEP_SEQUENCE) {
      expect(MISSION_STEP_LABELS[step]).toBeTruthy(); // nosemgrep: gitlab.eslint.detect-object-injection
    }
  });
});

describe('stepRank', () => {
  it('ranks steps monotonically', () => {
    expect(stepRank('lesson')).toBe(0);
    expect(stepRank('result')).toBe(4);
    expect(stepRank('checkpoint')).toBeLessThan(stepRank('quiz'));
  });
});

describe('furthestStepOf', () => {
  it('returns the later step regardless of argument order', () => {
    expect(furthestStepOf('lesson', 'checkpoint')).toBe('checkpoint');
    expect(furthestStepOf('result', 'example')).toBe('result');
    expect(furthestStepOf('quiz', 'quiz')).toBe('quiz');
  });
});

describe('previousStep / nextStep', () => {
  it('walks the sequence in both directions', () => {
    expect(previousStep('lesson')).toBeUndefined();
    expect(previousStep('example')).toBe('lesson');
    expect(nextStep('checkpoint')).toBe('quiz');
    expect(nextStep('result')).toBeUndefined();
  });
});

describe('isStepUnlocked', () => {
  it('unlocks steps at or before the furthest step', () => {
    expect(isStepUnlocked('lesson', 'checkpoint')).toBe(true);
    expect(isStepUnlocked('checkpoint', 'checkpoint')).toBe(true);
    expect(isStepUnlocked('quiz', 'checkpoint')).toBe(false);
  });
});

describe('clampStepToFurthest', () => {
  it('keeps unlocked steps and clamps unreached steps', () => {
    expect(clampStepToFurthest('example', 'checkpoint')).toBe('example');
    expect(clampStepToFurthest('result', 'example')).toBe('example');
  });
});
