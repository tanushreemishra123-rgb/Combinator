import { describe, expect, it } from 'vitest';
import type { Checkpoint } from '@ai-learning-adventure/types';
import {
  createEmptyCheckpointDraft,
  evaluateCheckpoint,
  isCheckpointDraftComplete,
  type CheckpointDraft,
} from '../src/checkpoint.ts';

const singleQuestion: Checkpoint = {
  kind: 'single_question',
  prompt: 'Which prompt is strongest?',
  options: [
    { id: 'opt-a', text: 'Write something', isCorrect: false, incorrectReason: 'Too vague.' },
    { id: 'opt-b', text: 'Write a 3-line summary for a 10-year-old', isCorrect: true },
  ],
  explanation: 'Specific instructions produce better results.',
};

const writeResponse: Checkpoint = {
  kind: 'write_response',
  prompt: 'In one sentence, what is an LLM?',
};

const sortIntoBuckets: Checkpoint = {
  kind: 'sort_into_buckets',
  prompt: 'Sort these into good and risky prompts.',
  buckets: ['good', 'risky'],
  items: [
    { id: 'item-1', text: 'Clear goal', correctBucket: 'good' },
    { id: 'item-2', text: 'Shares a password', correctBucket: 'risky' },
  ],
};

const spotTheProblem: Checkpoint = {
  kind: 'spot_the_problem',
  prompt: 'Highlight the risky part.',
  passage: 'Please email my password to everyone.',
  answerRange: { start: 13, end: 24 },
};

describe('createEmptyCheckpointDraft', () => {
  it('creates a matching draft for every kind', () => {
    expect(createEmptyCheckpointDraft(singleQuestion)).toEqual({ kind: 'single_question' });
    expect(createEmptyCheckpointDraft(writeResponse)).toEqual({ kind: 'write_response', text: '' });
    expect(createEmptyCheckpointDraft(sortIntoBuckets)).toEqual({
      kind: 'sort_into_buckets',
      assignments: {},
    });
    expect(createEmptyCheckpointDraft(spotTheProblem)).toEqual({ kind: 'spot_the_problem' });
  });
});

describe('isCheckpointDraftComplete', () => {
  it('rejects undefined or mismatched drafts', () => {
    expect(isCheckpointDraftComplete(singleQuestion)).toBe(false);
    expect(isCheckpointDraftComplete(singleQuestion, { kind: 'write_response', text: 'x' })).toBe(false);
  });

  it('requires a selected option for single_question', () => {
    expect(isCheckpointDraftComplete(singleQuestion, { kind: 'single_question' })).toBe(false);
    expect(
      isCheckpointDraftComplete(singleQuestion, { kind: 'single_question', selectedOptionId: 'opt-b' }),
    ).toBe(true);
  });

  it('requires non-empty text for write_response', () => {
    expect(isCheckpointDraftComplete(writeResponse, { kind: 'write_response', text: '   ' })).toBe(false);
    expect(isCheckpointDraftComplete(writeResponse, { kind: 'write_response', text: 'A model.' })).toBe(
      true,
    );
  });

  it('requires every item assigned to a valid bucket', () => {
    expect(
      isCheckpointDraftComplete(sortIntoBuckets, {
        kind: 'sort_into_buckets',
        assignments: { 'item-1': 'good' },
      }),
    ).toBe(false);
    expect(
      isCheckpointDraftComplete(sortIntoBuckets, {
        kind: 'sort_into_buckets',
        assignments: { 'item-1': 'good', 'item-2': 'unknown' },
      }),
    ).toBe(false);
    expect(
      isCheckpointDraftComplete(sortIntoBuckets, {
        kind: 'sort_into_buckets',
        assignments: { 'item-1': 'good', 'item-2': 'risky' },
      }),
    ).toBe(true);
  });

  it('requires a valid in-bounds range for spot_the_problem', () => {
    expect(isCheckpointDraftComplete(spotTheProblem, { kind: 'spot_the_problem' })).toBe(false);
    expect(
      isCheckpointDraftComplete(spotTheProblem, { kind: 'spot_the_problem', start: 5, end: 5 }),
    ).toBe(false);
    expect(
      isCheckpointDraftComplete(spotTheProblem, { kind: 'spot_the_problem', start: 14, end: 24 }),
    ).toBe(true);
    expect(
      isCheckpointDraftComplete(spotTheProblem, { kind: 'spot_the_problem', start: 0, end: 999 }),
    ).toBe(false);
  });
});

describe('evaluateCheckpoint', () => {
  it('returns undefined for incomplete drafts', () => {
    expect(evaluateCheckpoint(singleQuestion)).toBeUndefined();
    expect(evaluateCheckpoint(writeResponse, { kind: 'write_response', text: '' })).toBeUndefined();
  });

  it('marks a correct single_question answer and returns the explanation', () => {
    const evaluation = evaluateCheckpoint(singleQuestion, {
      kind: 'single_question',
      selectedOptionId: 'opt-b',
    });
    expect(evaluation?.outcome).toBe('correct');
    expect(evaluation?.countsTowardCompletion).toBe(true);
    expect(evaluation?.singleQuestion?.correctOptionId).toBe('opt-b');
    expect(evaluation?.singleQuestion?.explanation).toBe(singleQuestion.explanation);
  });

  it('marks an incorrect single_question answer without completion credit', () => {
    const evaluation = evaluateCheckpoint(singleQuestion, {
      kind: 'single_question',
      selectedOptionId: 'opt-a',
    });
    expect(evaluation?.outcome).toBe('incorrect');
    expect(evaluation?.countsTowardCompletion).toBe(false);
  });

  it('acknowledges write_response without grading', () => {
    const evaluation = evaluateCheckpoint(writeResponse, {
      kind: 'write_response',
      text: 'A model that predicts text.',
    });
    expect(evaluation?.outcome).toBe('acknowledged');
    expect(evaluation?.countsTowardCompletion).toBe(true);
  });

  it('reports misplaced items for sort_into_buckets', () => {
    const wrong = evaluateCheckpoint(sortIntoBuckets, {
      kind: 'sort_into_buckets',
      assignments: { 'item-1': 'risky', 'item-2': 'risky' },
    });
    expect(wrong?.outcome).toBe('incorrect');
    expect(wrong?.sortIntoBuckets?.misplacedItemIds).toEqual(['item-1']);

    const right = evaluateCheckpoint(sortIntoBuckets, {
      kind: 'sort_into_buckets',
      assignments: { 'item-1': 'good', 'item-2': 'risky' },
    });
    expect(right?.outcome).toBe('correct');
    expect(right?.sortIntoBuckets?.misplacedItemIds).toEqual([]);
  });

  it('compares the highlighted span to the answer range', () => {
    const draft: CheckpointDraft = { kind: 'spot_the_problem', start: 13, end: 24 };
    const right = evaluateCheckpoint(spotTheProblem, draft);
    expect(right?.outcome).toBe('correct');
    expect(right?.spotTheProblem?.expectedText).toBe('my password');

    const wrong = evaluateCheckpoint(spotTheProblem, { kind: 'spot_the_problem', start: 0, end: 6 });
    expect(wrong?.outcome).toBe('incorrect');
    expect(wrong?.countsTowardCompletion).toBe(false);
  });
});
