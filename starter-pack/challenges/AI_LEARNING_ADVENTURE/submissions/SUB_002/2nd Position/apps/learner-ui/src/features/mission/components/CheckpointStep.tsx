import { useMemo } from 'react';
import type { Checkpoint, MissionDetail } from '@ai-learning-adventure/types';
import {
  WRITE_RESPONSE_MAX_LENGTH,
  useCheckpoint,
  type UseCheckpointResult,
} from '../hooks/useCheckpoint.ts';
import type { UseMissionPlayerResult } from '../hooks/useMissionPlayer.ts';
import { DeferredAiAction } from './DeferredAiAction.tsx';
import { buildCheckpointContext } from '@ai-learning-adventure/learner';
import { useHint } from '../../ai-feedback/hooks/useHint.ts';
import { HintPanel } from '../../ai-feedback/components/HintPanel.tsx';
import { useAnswerFeedback } from '../../ai-feedback/hooks/useAnswerFeedback.ts';
import { AnswerFeedbackCard } from '../../ai-feedback/components/AnswerFeedbackCard.tsx';

export interface CheckpointStepProps {
  mission: MissionDetail;
  player: UseMissionPlayerResult;
}

interface PassageToken {
  text: string;
  start: number;
  end: number;
}

function tokenizePassage(passage: string): PassageToken[] {
  const tokens: PassageToken[] = [];
  const pattern = /\S+/g;
  let match = pattern.exec(passage);
  while (match !== null) {
    tokens.push({ text: match[0], start: match.index, end: match.index + match[0].length });
    match = pattern.exec(passage);
  }
  return tokens;
}

function SingleQuestionBody({ checkpoint }: { checkpoint: UseCheckpointResult }) {
  if (checkpoint.checkpoint.kind !== 'single_question') return null;
  const { options } = checkpoint.checkpoint;
  const selected = checkpoint.draft.kind === 'single_question'
    ? checkpoint.draft.selectedOptionId
    : undefined;
  return (
    <fieldset className="checkpoint-options" disabled={checkpoint.isSubmitted}>
      <legend className="visually-hidden">Answer choices</legend>
      {options.map((option) => {
        const textId = `checkpoint-option-text-${option.id}`;
        const inputId = `checkpoint-option-input-${option.id}`;
        return (
          <label
            key={option.id}
            htmlFor={inputId}
            className="checkpoint-option"
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter' || e.code === 'Space') {
                checkpoint.updateDraft({ kind: 'single_question', selectedOptionId: option.id });
              }
            }}
          >
            <input
              id={inputId}
              aria-labelledby={textId}
              type="radio"
              name="checkpoint-single-question"
              value={option.id}
              checked={selected === option.id}
              onChange={() =>
                checkpoint.updateDraft({ kind: 'single_question', selectedOptionId: option.id })
              }
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter' || e.key === 'Space' || e.key === '{' || e.key === 'Spacebar') {
                  checkpoint.updateDraft({ kind: 'single_question', selectedOptionId: option.id });
                }
              }}
              onKeyUp={(e) => {
                if (e.key === ' ' || e.key === 'Enter' || e.key === 'Space' || e.key === '{' || e.key === 'Spacebar') {
                  checkpoint.updateDraft({ kind: 'single_question', selectedOptionId: option.id });
                }
              }}
            />
            <span id={textId}>{option.text}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

function WriteResponseBody({ checkpoint }: { checkpoint: UseCheckpointResult }) {
  if (checkpoint.checkpoint.kind !== 'write_response') return null;
  const text = checkpoint.draft.kind === 'write_response' ? checkpoint.draft.text : '';
  return (
    <div className="checkpoint-write">
      <label className="checkpoint-write__label" htmlFor="checkpoint-write-response">
        Your response
      </label>
      <textarea
        id="checkpoint-write-response"
        className="checkpoint-write__input"
        rows={5}
        maxLength={WRITE_RESPONSE_MAX_LENGTH}
        value={text}
        disabled={checkpoint.isSubmitted}
        onChange={(event) =>
          checkpoint.updateDraft({ kind: 'write_response', text: event.target.value })
        }
      />
      <p className="checkpoint-write__counter">
        {text.length} / {WRITE_RESPONSE_MAX_LENGTH} characters
      </p>
    </div>
  );
}

function SortIntoBucketsBody({ checkpoint }: { checkpoint: UseCheckpointResult }) {
  if (checkpoint.checkpoint.kind !== 'sort_into_buckets') return null;
  const { buckets, items } = checkpoint.checkpoint;
  const assignments = checkpoint.draft.kind === 'sort_into_buckets'
    ? checkpoint.draft.assignments
    : {};
  const misplaced = checkpoint.evaluation?.sortIntoBuckets?.misplacedItemIds ?? [];

  function assign(itemId: string, bucket: string): void {
    const next = { ...assignments };
    if (bucket === '') {
      delete next[itemId] /* nosemgrep: gitlab.eslint.detect-object-injection */;
    } else {
      next[itemId] /* nosemgrep: gitlab.eslint.detect-object-injection */ = bucket;
    }
    checkpoint.updateDraft({ kind: 'sort_into_buckets', assignments: next });
  }

  return (
    <div className="checkpoint-sort">
      <ul className="checkpoint-sort__items" aria-label="Items to sort">
        {items.map((item) => {
          const isOff = checkpoint.isSubmitted && misplaced.includes(item.id);
          return (
            <li
              key={item.id}
              className={`checkpoint-sort__item ${isOff ? 'checkpoint-sort__item--off' : ''}`}
            >
              <span className="checkpoint-sort__text">{item.text}</span>
              <select
                className="checkpoint-sort__select"
                aria-label={`Place "${item.text}" into a bucket`}
                value={assignments[item.id] /* nosemgrep: gitlab.eslint.detect-object-injection */ ?? ''}
                disabled={checkpoint.isSubmitted}
                onChange={(event) => assign(item.id, event.target.value)}
              >
                <option value="">Choose a bucket…</option>
                {buckets.map((bucket) => (
                  <option key={bucket} value={bucket}>
                    {bucket}
                  </option>
                ))}
              </select>
              {isOff && <span className="checkpoint-sort__flag">Misplaced</span>}
            </li>
          );
        })}
      </ul>
      <div className="checkpoint-sort__buckets">
        {buckets.map((bucket) => (
          <div key={bucket} className="checkpoint-sort__bucket">
            <p className="checkpoint-sort__bucket-label">{bucket}</p>
            <ul>
              {items
                .filter((item) => assignments[item.id] /* nosemgrep: gitlab.eslint.detect-object-injection */ === bucket)
                .map((item) => (
                  <li key={item.id} className="checkpoint-sort__chip">
                    {item.text}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpotTheProblemBody({ checkpoint }: { checkpoint: UseCheckpointResult }) {
  const passage =
    checkpoint.checkpoint.kind === 'spot_the_problem' ? checkpoint.checkpoint.passage : '';
  const tokens = useMemo(() => tokenizePassage(passage), [passage]);
  if (checkpoint.checkpoint.kind !== 'spot_the_problem') return null;
  const draft: { start?: number; end?: number } =
    checkpoint.draft.kind === 'spot_the_problem' ? checkpoint.draft : {};
  const expected = checkpoint.evaluation?.spotTheProblem?.expectedRange;

  function toggleToken(token: PassageToken): void {
    if (checkpoint.isSubmitted) return;
    if (draft.start === undefined || draft.end === undefined) {
      checkpoint.updateDraft({ kind: 'spot_the_problem', start: token.start, end: token.end });
      return;
    }
    checkpoint.updateDraft({
      kind: 'spot_the_problem',
      start: Math.min(draft.start, token.start),
      end: Math.max(draft.end, token.end),
    });
  }

  function isSelected(token: PassageToken): boolean {
    return draft.start !== undefined && draft.end !== undefined &&
      token.start >= draft.start && token.end <= draft.end;
  }

  return (
    <div className="checkpoint-spot">
      <p className="checkpoint-spot__passage">
        {tokens.map((token) => {
          const selected = isSelected(token);
          const isExpected =
            checkpoint.isSubmitted &&
            expected !== undefined &&
            token.start >= expected.start &&
            token.end <= expected.end;
          const classes = [
            'checkpoint-spot__token',
            selected ? 'checkpoint-spot__token--selected' : '',
            isExpected ? 'checkpoint-spot__token--expected' : '',
            selected && checkpoint.isSubmitted && !isExpected ? 'checkpoint-spot__token--missed' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <span key={token.start} className={classes}>
              <button
                type="button"
                className="checkpoint-spot__token-button"
                aria-pressed={selected}
                disabled={checkpoint.isSubmitted}
                onClick={() => toggleToken(token)}
              >
                {token.text}
              </button>{' '}
            </span>
          );
        })}
      </p>
      {!checkpoint.isSubmitted && (draft.start !== undefined || draft.end !== undefined) && (
        <button
          type="button"
          className="button button--ghost button--small"
          onClick={() => checkpoint.updateDraft({ kind: 'spot_the_problem' })}
        >
          Clear highlight
        </button>
      )}
    </div>
  );
}

function CheckpointFeedback({
  checkpoint,
  writtenFeedback,
}: {
  checkpoint: UseCheckpointResult;
  writtenFeedback: ReturnType<typeof useAnswerFeedback>;
}) {
  const evaluation = checkpoint.evaluation;
  if (!checkpoint.isSubmitted || evaluation === undefined) return null;

  if (evaluation.outcome === 'acknowledged') {
    return (
      <div className="checkpoint-feedback checkpoint-feedback--acknowledged" role="status">
        <p className="checkpoint-feedback__headline">Thanks for putting that into words.</p>
        <p className="checkpoint-feedback__detail">
          There is no score here — writing it down is the win.
        </p>
        <AnswerFeedbackCard
          written
          text={writtenFeedback.text}
          writtenFeedback={writtenFeedback.writtenFeedback}
          isMock={writtenFeedback.isMock}
          busy={writtenFeedback.busy}
          providerError={writtenFeedback.providerError}
          onExplain={() => void writtenFeedback.requestExplanation()}
          onSimpler={() => void writtenFeedback.requestSimpler()}
          onExample={() => void writtenFeedback.requestExample()}
        />
        <button type="button" className="button button--secondary button--small" onClick={checkpoint.retry}>
          Revise and resubmit
        </button>
      </div>
    );
  }

  if (evaluation.outcome === 'correct') {
    return (
      <div className="checkpoint-feedback checkpoint-feedback--correct" role="status">
        <p className="checkpoint-feedback__headline">Nice work — that’s right!</p>
        {evaluation.singleQuestion !== undefined && (
          <p className="checkpoint-feedback__detail">{evaluation.singleQuestion.explanation}</p>
        )}
        {evaluation.sortIntoBuckets !== undefined && (
          <p className="checkpoint-feedback__detail">Every item landed in the right bucket.</p>
        )}
        {evaluation.spotTheProblem !== undefined && (
          <p className="checkpoint-feedback__detail">
            You found it: “{evaluation.spotTheProblem.expectedText}”.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="checkpoint-feedback checkpoint-feedback--incorrect" role="status">
      <p className="checkpoint-feedback__headline">Not quite — take another look.</p>
      {evaluation.singleQuestion !== undefined && (
        <p className="checkpoint-feedback__detail">{evaluation.singleQuestion.explanation}</p>
      )}
      {evaluation.sortIntoBuckets !== undefined && (
        <p className="checkpoint-feedback__detail">
          {evaluation.sortIntoBuckets.misplacedItemIds.length} item
          {evaluation.sortIntoBuckets.misplacedItemIds.length === 1 ? ' is' : 's are'} in the wrong
          bucket.
        </p>
      )}
      {evaluation.spotTheProblem !== undefined && (
        <p className="checkpoint-feedback__detail">
          The problem was: “{evaluation.spotTheProblem.expectedText}”.
        </p>
      )}
      <button type="button" className="button button--secondary button--small" onClick={checkpoint.retry}>
        Try again
      </button>
    </div>
  );
}

export function CheckpointStep({ mission, player }: CheckpointStepProps) {
  const checkpoint = useCheckpoint(mission.id, mission.checkpoint, player.completeCheckpoint);
  const selection = checkpoint.draft.kind === 'single_question' && checkpoint.draft.selectedOptionId !== undefined
    ? [checkpoint.draft.selectedOptionId]
    : [];
  const hint = useHint({
    mission,
    checkpoint: mission.checkpoint,
    selection,
    resetKey: checkpoint.isSubmitted ? 'submitted' : 'active',
  });
  const writtenResponse =
    checkpoint.draft.kind === 'write_response' ? checkpoint.draft.text : undefined;
  const writtenFeedback = useAnswerFeedback({
    mission,
    learnerAnswer: writtenResponse,
  });

  return (
    <section className="checkpoint-step" aria-label="Checkpoint">
      <h2 id="mission-step-heading" className="checkpoint-step__heading" tabIndex={-1}>
        Checkpoint
      </h2>
      <div className="checkpoint-card">
        <p className="checkpoint-card__prompt">{checkpoint.checkpoint.prompt}</p>
        <SingleQuestionBody checkpoint={checkpoint} />
        <WriteResponseBody checkpoint={checkpoint} />
        <SortIntoBucketsBody checkpoint={checkpoint} />
        <SpotTheProblemBody checkpoint={checkpoint} />
         {!checkpoint.isSubmitted && (
           <HintPanel
             hints={hint.hints}
             isMock={hint.isMock}
              busy={hint.busy}
              providerError={hint.providerError}
             canRequestMore={hint.canRequestMore}
             onRequestHint={() => void hint.requestHint()}
           />
         )}
          <CheckpointFeedback checkpoint={checkpoint} writtenFeedback={writtenFeedback} />
      </div>
      <div className="mission-step-footer">
        {!checkpoint.isSubmitted && (
          <>
            <button
              type="button"
              className="button button--ghost button--small"
              disabled={hint.busy || !hint.canRequestMore}
              onClick={() => void hint.requestHint()}
            >
              {hint.busy ? 'Thinking…' : hint.hints.length > 0 ? 'Get another hint' : 'Get a hint'}
            </button>
            <button
              type="button"
              className="button button--primary"
              disabled={!checkpoint.canSubmit}
              onClick={checkpoint.submit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  checkpoint.submit();
                }
              }}
              onKeyUp={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  checkpoint.submit();
                }
              }}
            >
              Submit
            </button>
            <DeferredAiAction
              label="Ask the tutor"
              missionId={mission.id}
              context={buildCheckpointContext(mission, mission.checkpoint)}
            />
          </>
        )}
      </div>
    </section>
  );
}
