import { useEffect, useRef, useState } from 'react';
import type {
  Flashcard,
  MissionDetail,
  QuestionOption,
  QuizQuestion,
} from '@ai-learning-adventure/types';
import { useKeyboardShortcut } from '../../../hooks/ui/useKeyboardShortcut.ts';
import { useAppNavigation } from '../../../hooks/useAppNavigation.ts';
import { buildQuestionContext } from '@ai-learning-adventure/learner';
import { KeyTermPopover } from '../../mission/components/KeyTermPopover.tsx';
import { DeferredAiAction } from '../../mission/components/DeferredAiAction.tsx';
import type { UseQuizSessionResult } from '../hooks/useQuizSession.ts';
import { useHint } from '../../ai-feedback/hooks/useHint.ts';
import { HintPanel } from '../../ai-feedback/components/HintPanel.tsx';
import { useAnswerFeedback } from '../../ai-feedback/hooks/useAnswerFeedback.ts';
import { AnswerFeedbackCard } from '../../ai-feedback/components/AnswerFeedbackCard.tsx';

export interface QuizRunnerProps {
  mission: MissionDetail;
  session: UseQuizSessionResult;
}

interface OptionView {
  id: string;
  text: string;
  state: 'neutral' | 'selected' | 'correct' | 'wrong' | 'missed';
}

function optionStates(
  question: QuizQuestion,
  session: UseQuizSessionResult,
): OptionView[] {
  const submitted = session.submission !== undefined;
  return question.options.map((option): OptionView => {
    const selected = session.selection.includes(option.id);
    if (!submitted) {
      return { id: option.id, text: option.text, state: selected ? 'selected' : 'neutral' };
    }
    if (option.isCorrect) {
      return { id: option.id, text: option.text, state: selected ? 'correct' : 'missed' };
    }
    if (selected) return { id: option.id, text: option.text, state: 'wrong' };
    return { id: option.id, text: option.text, state: 'neutral' };
  });
}

function isSelected(session: UseQuizSessionResult, option: QuestionOption): boolean {
  return session.selection.includes(option.id);
}

function toggleSelection(selection: string[], optionId: string): string[] {
  return selection.includes(optionId)
    ? selection.filter((id) => id !== optionId)
    : [...selection, optionId];
}

function MultipleChoiceBody({
  question,
  session,
}: {
  question: Extract<QuizQuestion, { type: 'multiple_choice' }>;
  session: UseQuizSessionResult;
}) {
  const single = question.selectionMode === 'single';
  return (
    <fieldset className="quiz-options" disabled={session.submission !== undefined}>
      <legend className="visually-hidden">Answer choices</legend>
      {!single && <p className="quiz-options__helper">Select all that apply</p>}
      {question.options.map((option) => {
        const state = optionStates(question, session).find((view) => view.id === option.id);
        const textId = `quiz-option-text-${option.id}`;
        return (
          <label
            key={option.id}
            className={`quiz-option ${state !== undefined ? `quiz-option--${state.state}` : ''}`}
          >
            <input
              type={single ? 'radio' : 'checkbox'}
              name="quiz-answer"
              value={option.id}
              aria-labelledby={textId}
              checked={isSelected(session, option)}
              disabled={session.submission !== undefined}
              onChange={() =>
                session.selectOptions(
                  single ? [option.id] : toggleSelection(session.selection, option.id),
                )
              }
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter' || e.key === 'Space' || e.key === '{' || e.key === 'Spacebar') {
                  session.selectOptions(
                    single ? [option.id] : toggleSelection(session.selection, option.id),
                  );
                }
              }}
            />
            <span id={textId} className="quiz-option__text">{option.text}</span>
            {state?.state === 'correct' && (
              <span className="quiz-option__mark quiz-option__mark--correct" aria-hidden="true">
                ✓
              </span>
            )}
            {state?.state === 'wrong' && (
              <span className="quiz-option__mark quiz-option__mark--wrong" aria-hidden="true">
                ✗
              </span>
            )}
          </label>
        );
      })}
    </fieldset>
  );
}

function TrueFalseBody({
  question,
  session,
}: {
  question: Extract<QuizQuestion, { type: 'true_false' }>;
  session: UseQuizSessionResult;
}) {
  return (
    <div className="quiz-true-false" role="group" aria-label="True or false">
      {question.options.map((option) => {
        const state = optionStates(question, session).find((view) => view.id === option.id);
        return (
          <button
            key={option.id}
            type="button"
            className={`quiz-true-false__button ${
              state !== undefined ? `quiz-true-false__button--${state.state}` : ''
            }`}
            aria-pressed={isSelected(session, option)}
            disabled={session.submission !== undefined}
            onClick={() => session.selectOptions([option.id])}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter' || e.key === 'Space' || e.key === '{' || e.key === 'Spacebar') {
                session.selectOptions([option.id]);
              }
            }}
            onKeyUp={(e) => {
              if (e.key === ' ' || e.key === 'Enter' || e.key === 'Space' || e.key === '{' || e.key === 'Spacebar') {
                session.selectOptions([option.id]);
              }
            }}
          >
            {option.text}
            {state?.state === 'correct' && (
              <span className="quiz-option__mark quiz-option__mark--correct" aria-hidden="true">
                ✓
              </span>
            )}
            {state?.state === 'wrong' && (
              <span className="quiz-option__mark quiz-option__mark--wrong" aria-hidden="true">
                ✗
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ScenarioBody({
  question,
  session,
}: {
  question: Extract<QuizQuestion, { type: 'scenario' }>;
  session: UseQuizSessionResult;
}) {
  const submitted = session.submission !== undefined;
  return (
    <div className="quiz-scenario">
      <div className="quiz-scenario__panel">{question.scenario}</div>
      <p className="quiz-scenario__prompt">What’s the best next step?</p>
      <fieldset className="quiz-options" disabled={submitted}>
        <legend className="visually-hidden">Best next step</legend>
        {question.options.map((option) => {
          const state = optionStates(question, session).find((view) => view.id === option.id);
          const textId = `quiz-scenario-text-${option.id}`;
          return (
            <label
              key={option.id}
              className={`quiz-option ${state !== undefined ? `quiz-option--${state.state}` : ''}`}
            >
              <input
                type="radio"
                name="quiz-scenario-answer"
                value={option.id}
                aria-labelledby={textId}
                checked={isSelected(session, option)}
                disabled={submitted}
                onChange={() => session.selectOptions([option.id])}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter' || e.key === 'Space' || e.key === '{' || e.key === 'Spacebar') {
                    session.selectOptions([option.id]);
                  }
                }}
                onKeyUp={(e) => {
                  if (e.key === ' ' || e.key === 'Enter' || e.key === 'Space' || e.key === '{' || e.key === 'Spacebar') {
                    session.selectOptions([option.id]);
                  }
                }}
              />
              <span id={textId} className="quiz-option__text">{option.text}</span>
              {state?.state === 'correct' && (
                <span className="quiz-option__mark quiz-option__mark--correct" aria-hidden="true">
                  ✓
                </span>
              )}
              {state?.state === 'wrong' && (
                <span className="quiz-option__mark quiz-option__mark--wrong" aria-hidden="true">
                  ✗
                </span>
              )}
              {submitted && !option.isCorrect && option.incorrectReason !== undefined && (
                <span className="quiz-option__reason">{option.incorrectReason}</span>
              )}
            </label>
          );
        })}
      </fieldset>
      {question.allowsReasoning && (
        <div className="quiz-reasoning">
          <label className="quiz-reasoning__label" htmlFor="quiz-reasoning-input">
            Explain your reasoning (optional)
          </label>
          <textarea
            id="quiz-reasoning-input"
            className="quiz-reasoning__input"
            rows={4}
            value={session.reasoningDraft}
            disabled={submitted}
            onChange={(event) => session.setReasoning(event.target.value)}
          />
        </div>
      )}
    </div>
  );
}

function QuestionBody({
  question,
  session,
}: {
  question: QuizQuestion;
  session: UseQuizSessionResult;
}) {
  switch (question.type) {
    case 'multiple_choice':
      return <MultipleChoiceBody question={question} session={session} />;
    case 'true_false':
      return <TrueFalseBody question={question} session={session} />;
    case 'scenario':
      return <ScenarioBody question={question} session={session} />;
  }
}

function relatedFlashcard(mission: MissionDetail, question: QuizQuestion): Flashcard | undefined {
  return mission.flashcards.find((card) =>
    card.conceptTags.some((tag) => question.conceptTags.includes(tag)),
  );
}

function RelatedFlashcardTrigger({ card }: { card: Flashcard }) {
  const [open, setOpen] = useState(false);
  const { navigate } = useAppNavigation();
  if (!open) {
    return (
      <button
        type="button"
        className="button button--ghost button--small"
        onClick={() => setOpen(true)}
      >
        Related flashcard
      </button>
    );
  }
  return (
    <KeyTermPopover
      term={card.concept}
      flashcard={card}
      onClose={() => setOpen(false)}
      onOpenDeck={() => {
        setOpen(false);
        navigate({ kind: 'flashcards', mode: 'mission', missionId: card.missionId });
      }}
    />
  );
}

export function QuizRunner({ mission, session }: QuizRunnerProps) {
  const verdictRef = useRef<HTMLDivElement | null>(null);
  const submitted = session.submission !== undefined;
  const question = session.question;
  const relatedCard = question !== undefined ? relatedFlashcard(mission, question) : undefined;
  const answeredIds = new Set(session.answeredQuestionIds as string[]);
  const hint = useHint({ mission, question, selection: session.selection });
  const answerFeedback = useAnswerFeedback({
    mission,
    question,
    selectedOptionIds: session.selection,
    authoredExplanation:
      question === undefined
        ? ''
        : session.submission?.isCorrect === true
          ? question.correctExplanation
          : question.incorrectExplanation,
    outcome: session.submission?.isCorrect === true ? 'correct' : 'incorrect',
  });

  useEffect(() => {
    if (submitted) {
      verdictRef.current?.focus({ preventScroll: true });
    }
  }, [submitted, session.questionNumber]);

  useKeyboardShortcut(
    { key: 'Enter', enabled: session.canSubmit && !submitted },
    (event) => {
      if (event.target instanceof HTMLButtonElement) return;
      session.submit();
    },
  );

  if (question === undefined) {
    return (
      <div className="app-status" role="status">
        <p>Loading question…</p>
      </div>
    );
  }

  return (
    <section className="quiz-runner" aria-label="Quiz">
      <h1 className="quiz-runner__title" tabIndex={-1}>
        {mission.title} quiz
      </h1>
      <p className="quiz-runner__progress" role="status">
        Question {session.questionNumber} of {session.questionCount}
      </p>
      <ol className="quiz-dots" aria-label="Quiz questions">
        {session.questionOrder.map((questionId, index) => {
          const answered = answeredIds.has(questionId as string);
          const current = index === session.questionNumber - 1;
          return (
            <li key={questionId as string} className="quiz-dots__item">
              <button
                type="button"
                className={`quiz-dots__dot ${current ? 'quiz-dots__dot--current' : ''} ${
                  answered ? 'quiz-dots__dot--answered' : ''
                }`}
                aria-current={current ? 'step' : undefined}
                aria-label={
                  current
                    ? `Question ${index + 1} of ${session.questionCount} (current)`
                    : answered
                      ? `Review question ${index + 1}`
                      : `Question ${index + 1} (not answered yet)`
                }
                disabled={!answered && !current}
                onClick={() => {
                  if (answered) session.openAnsweredQuestion(questionId);
                }}
              >
                <span aria-hidden="true">{index + 1}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="quiz-card">
        <p className="quiz-card__stem">{question.stem}</p>
        <QuestionBody question={question} session={session} />

        {submitted && (
          <div
            ref={verdictRef}
            className={`quiz-verdict ${
              session.submission?.isCorrect === true
                ? 'quiz-verdict--correct'
                : 'quiz-verdict--incorrect'
            }`}
            tabIndex={-1}
          >
            <p className="quiz-verdict__headline">
              {session.submission?.isCorrect === true
                ? 'Nice — here’s why that’s right'
                : 'Not quite — here’s why'}
            </p>
            <p className="quiz-verdict__detail">
              {session.submission?.isCorrect === true
                ? question.correctExplanation
                : question.incorrectExplanation}
            </p>
            <div className="quiz-verdict__actions">
              <AnswerFeedbackCard
                text={answerFeedback.text}
                isMock={answerFeedback.isMock}
                 busy={answerFeedback.busy}
                 providerError={answerFeedback.providerError}
                outcome={session.submission?.isCorrect === true ? 'correct' : 'incorrect'}
                onExplain={() => void answerFeedback.requestExplanation()}
                onSimpler={() => void answerFeedback.requestSimpler()}
                onExample={() => void answerFeedback.requestExample()}
              />
              {relatedCard !== undefined && <RelatedFlashcardTrigger card={relatedCard} />}
            </div>
          </div>
        )}
      </div>
      {!submitted && (
        <HintPanel
          hints={hint.hints}
          isMock={hint.isMock}
           busy={hint.busy}
           providerError={hint.providerError}
          canRequestMore={hint.canRequestMore}
          onRequestHint={() => void hint.requestHint()}
        />
      )}

      <div className="mission-step-footer">
        {!submitted ? (
          <>
            <button
              type="button"
              className="button button--ghost"
              disabled={hint.busy || !hint.canRequestMore}
              onClick={() => void hint.requestHint()}
            >
              {hint.busy ? 'Thinking…' : hint.hints.length > 0 ? 'Need another hint' : 'Get a hint'}
            </button>
            <DeferredAiAction
              label="Ask the tutor"
              missionId={mission.id}
              context={buildQuestionContext(mission, question)}
            />
            <button
              type="button"
              className="button button--primary"
              disabled={!session.canSubmit}
              onClick={session.submit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  session.submit();
                }
              }}
              onKeyUp={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  session.submit();
                }
              }}
            >
              Submit answer
            </button>
          </>
        ) : (
          <>
            <button type="button" className="button button--ghost" onClick={session.exit}>
              Back to mission
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={session.next}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  session.next();
                }
              }}
              onKeyUp={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  session.next();
                }
              }}
            >
              {session.isLast ? 'See results' : 'Next question'}
            </button>
          </>
        )}
        {session.isSaving && (
          <p className="quiz-runner__saving" role="status">
            Saving…
          </p>
        )}
      </div>
    </section>
  );
}
