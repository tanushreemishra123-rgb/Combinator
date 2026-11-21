import { describe, expect, it } from 'vitest';
import type { QuizQuestion } from '@ai-learning-adventure/types';
import {
  buildQuizAttempt,
  computeQuizScore,
  gradeQuestion,
  gradeQuizAnswers,
  hashStringSeed,
  quizAttemptResult,
  shuffleItems,
  shuffleQuestions,
  weakTopicsFromAnswers,
} from '../src/quiz.ts';

const singleChoice: QuizQuestion = {
  id: 'q-1' as never,
  missionId: 'mission-1' as never,
  type: 'multiple_choice',
  stem: 'What does AI learn from?',
  selectionMode: 'single',
  options: [
    { id: 'a', text: 'Data', isCorrect: true },
    { id: 'b', text: 'Guesses', isCorrect: false, incorrectReason: 'Guessing is not learning.' },
    { id: 'c', text: 'Noise', isCorrect: false },
  ],
  correctExplanation: 'AI learns patterns from data.',
  incorrectExplanation: 'AI learns patterns from data, not guesses.',
  conceptTags: ['ai-basics'],
};

const multiChoice: QuizQuestion = {
  ...singleChoice,
  id: 'q-2' as never,
  selectionMode: 'multiple',
  options: [
    { id: 'a', text: 'Data', isCorrect: true },
    { id: 'b', text: 'Patterns', isCorrect: true },
    { id: 'c', text: 'Noise', isCorrect: false },
  ],
};

describe('gradeQuestion', () => {
  it('marks an exact single-select answer correct', () => {
    expect(gradeQuestion(singleChoice, ['a'])).toEqual({
      isCorrect: true,
      correctOptionIds: ['a'],
      missedCorrectOptionIds: [],
      incorrectSelectedOptionIds: [],
    });
  });

  it('marks a wrong single-select answer incorrect', () => {
    expect(gradeQuestion(singleChoice, ['b'])).toEqual({
      isCorrect: false,
      correctOptionIds: ['a'],
      missedCorrectOptionIds: ['a'],
      incorrectSelectedOptionIds: ['b'],
    });
  });

  it('requires every correct option for multi-select credit', () => {
    expect(gradeQuestion(multiChoice, ['a', 'b']).isCorrect).toBe(true);
    expect(gradeQuestion(multiChoice, ['a']).isCorrect).toBe(false);
    expect(gradeQuestion(multiChoice, ['a', 'b', 'c']).isCorrect).toBe(false);
    const partial = gradeQuestion(multiChoice, ['a']);
    expect(partial.missedCorrectOptionIds).toEqual(['b']);
    expect(partial.incorrectSelectedOptionIds).toEqual([]);
  });

  it('reports both misses and wrong picks on mixed multi-select answers', () => {
    const grade = gradeQuestion(multiChoice, ['a', 'c']);
    expect(grade.isCorrect).toBe(false);
    expect(grade.missedCorrectOptionIds).toEqual(['b']);
    expect(grade.incorrectSelectedOptionIds).toEqual(['c']);
  });
});

describe('gradeQuizAnswers', () => {
  it('grades a submission against its question', () => {
    const answers = gradeQuizAnswers([singleChoice], [
      { questionId: singleChoice.id, selectedOptionIds: ['a'] },
    ]);
    expect(answers).toEqual([
      {
        questionId: singleChoice.id,
        selectedOptionIds: ['a'],
        isCorrect: true,
        conceptTags: ['ai-basics'],
      },
    ]);
  });

  it('keeps reasoning when provided', () => {
    const answers = gradeQuizAnswers([singleChoice], [
      { questionId: singleChoice.id, selectedOptionIds: ['b'], reasoning: 'It learns from noise.' },
    ]);
    expect(answers[0]?.reasoning).toBe('It learns from noise.');
  });

  it('throws for an unknown question', () => {
    expect(() =>
      gradeQuizAnswers([], [{ questionId: 'missing' as never, selectedOptionIds: [] }]),
    ).toThrow(/unknown question/);
  });
});

describe('computeQuizScore', () => {
  it('computes rounded percentages', () => {
    expect(computeQuizScore([])).toEqual({ correctCount: 0, questionCount: 0, scorePercent: 0 });
    const answers = gradeQuizAnswers([singleChoice, multiChoice], [
      { questionId: singleChoice.id, selectedOptionIds: ['a'] },
      { questionId: multiChoice.id, selectedOptionIds: ['a'] },
    ]);
    expect(computeQuizScore(answers)).toEqual({ correctCount: 1, questionCount: 2, scorePercent: 50 });
  });
});

describe('quizAttemptResult', () => {
  it('passes at the threshold and fails below it', () => {
    expect(quizAttemptResult(70, 70)).toBe('passed');
    expect(quizAttemptResult(69, 70)).toBe('needs_review');
    expect(quizAttemptResult(100, 70)).toBe('passed');
    expect(quizAttemptResult(0, 70)).toBe('needs_review');
  });
});

describe('weakTopicsFromAnswers', () => {
  it('collects tags from incorrect answers sorted by weight', () => {
    const answers = gradeQuizAnswers([singleChoice, multiChoice], [
      { questionId: singleChoice.id, selectedOptionIds: ['b'] },
      { questionId: multiChoice.id, selectedOptionIds: ['c'] },
    ]);
    expect(weakTopicsFromAnswers(answers)).toEqual([
      { topic: 'ai-basics', weight: 2, sources: ['quiz'] },
    ]);
  });

  it('ignores correct answers', () => {
    const answers = gradeQuizAnswers([singleChoice], [
      { questionId: singleChoice.id, selectedOptionIds: ['a'] },
    ]);
    expect(weakTopicsFromAnswers(answers)).toEqual([]);
  });
});

describe('shuffleItems', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it('is deterministic for a fixed seed and preserves elements', () => {
    const first = shuffleItems(items, 42);
    const second = shuffleItems(items, 42);
    expect(first).toEqual(second);
    expect([...first].sort((a, b) => a - b)).toEqual(items);
  });

  it('produces different orders for different seeds', () => {
    const first = shuffleItems(items, 1);
    const second = shuffleItems(items, 2);
    expect(first).not.toEqual(second);
  });
});

describe('shuffleQuestions', () => {
  it('reorders questions without mutating the input', () => {
    const questions = [singleChoice, multiChoice];
    const shuffled = shuffleQuestions(questions, 7);
    expect(shuffled).toHaveLength(2);
    expect(questions[0]).toBe(singleChoice);
  });
});

describe('hashStringSeed', () => {
  it('returns a stable non-negative integer', () => {
    expect(hashStringSeed('mission-1')).toBe(hashStringSeed('mission-1'));
    expect(hashStringSeed('mission-1')).toBeGreaterThanOrEqual(0);
    expect(hashStringSeed('mission-2')).not.toBe(hashStringSeed('mission-1'));
  });
});

describe('buildQuizAttempt', () => {
  it('builds a complete attempt with score, result, and weak topics', () => {
    const attempt = buildQuizAttempt({
      attemptId: 'attempt-1',
      missionId: 'mission-1' as never,
      contentVersion: 1,
      questions: [singleChoice, multiChoice],
      submissions: [
        { questionId: singleChoice.id, selectedOptionIds: ['a'] },
        { questionId: multiChoice.id, selectedOptionIds: ['a'] },
      ],
      passThreshold: 70,
      startedAt: '2026-08-01T10:00:00.000Z' as never,
      completedAt: '2026-08-01T10:05:00.000Z' as never,
    });
    expect(attempt.scorePercent).toBe(50);
    expect(attempt.correctCount).toBe(1);
    expect(attempt.questionCount).toBe(2);
    expect(attempt.result).toBe('needs_review');
    expect(attempt.weakTopics).toEqual(['ai-basics']);
    expect(attempt.answers).toHaveLength(2);
  });
});
