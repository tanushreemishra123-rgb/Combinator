import type { Checkpoint, TextRange } from '@ai-learning-adventure/types';

export type CheckpointDraft =
  | { kind: 'single_question'; selectedOptionId?: string }
  | { kind: 'write_response'; text: string }
  | { kind: 'sort_into_buckets'; assignments: Record<string, string> }
  | { kind: 'spot_the_problem'; start?: number; end?: number };

export type CheckpointOutcome = 'correct' | 'incorrect' | 'acknowledged';

export interface SingleQuestionFeedback {
  correctOptionId: string;
  explanation: string;
}

export interface SortIntoBucketsFeedback {
  misplacedItemIds: string[];
}

export interface SpotTheProblemFeedback {
  expectedRange: TextRange;
  expectedText: string;
}

export interface CheckpointEvaluation {
  outcome: CheckpointOutcome;
  countsTowardCompletion: boolean;
  singleQuestion?: SingleQuestionFeedback;
  sortIntoBuckets?: SortIntoBucketsFeedback;
  spotTheProblem?: SpotTheProblemFeedback;
}

export function createEmptyCheckpointDraft(checkpoint: Checkpoint): CheckpointDraft {
  switch (checkpoint.kind) {
    case 'single_question':
      return { kind: 'single_question' };
    case 'write_response':
      return { kind: 'write_response', text: '' };
    case 'sort_into_buckets':
      return { kind: 'sort_into_buckets', assignments: {} };
    case 'spot_the_problem':
      return { kind: 'spot_the_problem' };
  }
}

export function isCheckpointDraftComplete(checkpoint: Checkpoint, draft?: CheckpointDraft): boolean {
  if (draft === undefined) return false;
  switch (checkpoint.kind) {
    case 'single_question':
      return draft.kind === 'single_question' && draft.selectedOptionId !== undefined;
    case 'write_response':
      return draft.kind === 'write_response' && draft.text.trim().length > 0;
    case 'sort_into_buckets':
      return (
        draft.kind === 'sort_into_buckets' &&
        checkpoint.items.every((item) => checkpoint.buckets.includes(draft.assignments[item.id] ?? '')) // nosemgrep: gitlab.eslint.detect-object-injection
      );
    case 'spot_the_problem':
      return (
        draft.kind === 'spot_the_problem' &&
        draft.start !== undefined &&
        draft.end !== undefined &&
        draft.start >= 0 &&
        draft.end > draft.start &&
        draft.end <= checkpoint.passage.length
      );
  }
}

export function evaluateCheckpoint(
  checkpoint: Checkpoint,
  draft?: CheckpointDraft,
): CheckpointEvaluation | undefined {
  if (!isCheckpointDraftComplete(checkpoint, draft) || draft === undefined) return undefined;

  switch (checkpoint.kind) {
    case 'single_question': {
      if (draft.kind !== 'single_question') return undefined;
      const selected = checkpoint.options.find((option) => option.id === draft.selectedOptionId);
      const correctOption = checkpoint.options.find((option) => option.isCorrect);
      const outcome: CheckpointOutcome = selected?.isCorrect === true ? 'correct' : 'incorrect';
      return {
        outcome,
        countsTowardCompletion: outcome === 'correct',
        singleQuestion: {
          correctOptionId: correctOption?.id ?? '',
          explanation: checkpoint.explanation,
        },
      };
    }
    case 'write_response':
      return { outcome: 'acknowledged', countsTowardCompletion: true };
    case 'sort_into_buckets': {
      if (draft.kind !== 'sort_into_buckets') return undefined;
      const misplacedItemIds = checkpoint.items
        .filter((item) => draft.assignments[item.id] !== item.correctBucket) // nosemgrep: gitlab.eslint.detect-object-injection
        .map((item) => item.id);
      const outcome: CheckpointOutcome = misplacedItemIds.length === 0 ? 'correct' : 'incorrect';
      return {
        outcome,
        countsTowardCompletion: outcome === 'correct',
        sortIntoBuckets: { misplacedItemIds },
      };
    }
    case 'spot_the_problem': {
      if (draft.kind !== 'spot_the_problem' || draft.start === undefined || draft.end === undefined) {
        return undefined;
      }
      const expected = checkpoint.answerRange;
      const matched = draft.start === expected.start && draft.end === expected.end;
      return {
        outcome: matched ? 'correct' : 'incorrect',
        countsTowardCompletion: matched,
        spotTheProblem: {
          expectedRange: expected,
          expectedText: checkpoint.passage.slice(expected.start, expected.end),
        },
      };
    }
  }
}
