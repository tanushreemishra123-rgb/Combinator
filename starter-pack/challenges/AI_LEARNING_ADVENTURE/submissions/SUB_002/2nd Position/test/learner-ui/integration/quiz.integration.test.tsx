import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MissionId, QuizAttempt } from '@ai-learning-adventure/types';
import { navigate as navigateTo } from '../../../apps/learner-ui/src/store/navigationSlice.ts';
import { getMission, getProgress, importProgress } from './helpers/api.ts';
import { replaceQuestionOptions } from './helpers/database.ts';
import {
  answerCurrentQuestion,
  completeQuiz,
  continueJourney,
  currentQuizQuestion,
  dismissAllAwardDialogs,
  incorrectOptionTexts,
  openCurrentMissionQuiz,
  selectOptionsByText,
  submitAnswer,
} from './helpers/drivers.ts';
import {
  makeMissionProgress,
  makePortableProgress,
  makeQuizAttempt,
  seededMissions,
} from './helpers/fixtures.ts';
import { integrationTestContext } from './helpers/setup.ts';

const testContext = integrationTestContext();
const firstMission = seededMissions[0]!;

function quizReadyProgress(options: {
  checkpointCompleted?: boolean;
  attempts?: QuizAttempt[];
} = {}) {
  return makePortableProgress({
    missions: {
      [firstMission.id]: makeMissionProgress(firstMission.id, {
        status: 'in_progress',
        furthestStep: 'quiz',
        checkpointCompleted: options.checkpointCompleted ?? true,
      }),
    },
    attempts: options.attempts ?? [],
  });
}

async function openReadyQuiz(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
  await continueJourney(user);
  await screen.findByRole('heading', { level: 1, name: firstMission.title });
  expect(screen.getByRole('heading', { level: 2, name: 'Quiz' })).toBeDefined();
  await openCurrentMissionQuiz(user);
}

describe('quiz runner and persistence', () => {
  it('QIZ-01 starts the quiz with its first question and counter', async () => {
    const runtime = await testContext.createWithProgress(quizReadyProgress());
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);

    await openReadyQuiz(user);

    expect(screen.getByText(`Question 1 of ${mission.questions.length}`)).toBeDefined();
    expect(screen.getByText(mission.questions[0]!.stem)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Submit answer' }).hasAttribute('disabled')).toBe(true);
  });

  it('QIZ-02 submits a correct single-select answer, explains it, and locks the choice', async () => {
    const runtime = await testContext.createWithProgress(quizReadyProgress());
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);

    await openReadyQuiz(user);
    const question = currentQuizQuestion(mission);
    if (question.type !== 'multiple_choice' || question.selectionMode !== 'single') {
      throw new Error('The first integration quiz question must be single-select.');
    }
    await answerCurrentQuestion(user, mission, true);
    await submitAnswer(user);

    expect(await screen.findByText(/Nice.*why.*right/)).toBeDefined();
    expect(screen.getByText(question.correctExplanation)).toBeDefined();
    const selected = question.options.find((option) => option.isCorrect)!;
    expect((screen.getByLabelText(selected.text) as HTMLInputElement).disabled).toBe(true);
  });

  it('QIZ-03 evaluates only the final single-select choice made before submission', async () => {
    const runtime = await testContext.createWithProgress(quizReadyProgress());
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);

    await openReadyQuiz(user);
    const question = currentQuizQuestion(mission);
    const wrong = question.options.find((option) => !option.isCorrect)!;
    const correct = question.options.find((option) => option.isCorrect)!;
    await selectOptionsByText(user, [wrong.text]);
    await selectOptionsByText(user, [correct.text]);
    await submitAnswer(user);

    expect(await screen.findByText(/Nice.*why.*right/)).toBeDefined();
    expect((screen.getByLabelText(correct.text) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(wrong.text) as HTMLInputElement).checked).toBe(false);
  });

  it('QIZ-04 marks a partial multi-select response incorrect and identifies the missed option', async () => {
    const runtime = await testContext.create({ deferRender: true });
    const original = await getMission(runtime, firstMission.id);
    const firstQuestion = original.questions[0]!;
    const options = firstQuestion.options.map((option, index) => ({
      ...option,
      isCorrect: index < 2,
    }));
    replaceQuestionOptions(runtime, firstQuestion.id, 'multiple', options);
    await importProgress(runtime, quizReadyProgress());
    testContext.mount(runtime);
    const mission = await getMission(runtime, firstMission.id);
    const user = userEvent.setup();

    await openReadyQuiz(user);
    const question = currentQuizQuestion(mission);
    expect(question.selectionMode).toBe('multiple');
    const correctOptions = question.options.filter((option) => option.isCorrect);
    await user.click(screen.getByLabelText(correctOptions[0]!.text));
    await submitAnswer(user);

    expect(await screen.findByText('Not quite — here’s why')).toBeDefined();
    expect(
      screen.getByLabelText(correctOptions[1]!.text).closest('.quiz-option')?.className,
    ).toContain('quiz-option--missed');
  });

  it('QIZ-05 handles true-false and scenario questions with optional reasoning', async () => {
    const runtime = await testContext.createWithProgress(quizReadyProgress());
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);

    await openReadyQuiz(user);
    await answerCurrentQuestion(user, mission, true);
    await submitAnswer(user);
    await user.click(screen.getByRole('button', { name: 'Next question' }));

    let question = currentQuizQuestion(mission);
    expect(question.type).toBe('true_false');
    await answerCurrentQuestion(user, mission, true);
    await submitAnswer(user);
    expect(await screen.findByText(question.correctExplanation)).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Next question' }));

    question = currentQuizQuestion(mission);
    if (question.type !== 'scenario') throw new Error('Question 3 must exercise scenario rendering.');
    expect(screen.getByText(question.scenario)).toBeDefined();
    await user.type(screen.getByLabelText('Explain your reasoning (optional)'), 'A bounded AI prediction can still be wrong.');
    await answerCurrentQuestion(user, mission, true);
    await submitAnswer(user);
    expect(await screen.findByText(question.correctExplanation)).toBeDefined();
    expect((screen.getByLabelText('Explain your reasoning (optional)') as HTMLTextAreaElement).disabled).toBe(true);
  });

  it('QIZ-06 reopens an answered question read-only with its verdict', async () => {
    const runtime = await testContext.createWithProgress(quizReadyProgress());
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);
    const firstQuestion = mission.questions[0]!;

    await openReadyQuiz(user);
    await answerCurrentQuestion(user, mission, true);
    await submitAnswer(user);
    await user.click(screen.getByRole('button', { name: 'Next question' }));
    await screen.findByText(`Question 2 of ${mission.questions.length}`);
    await user.click(screen.getByRole('button', { name: 'Review question 1' }));

    expect(await screen.findByText(firstQuestion.stem)).toBeDefined();
    expect(screen.getByText(/Nice.*why.*right/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Submit answer' })).toBeNull();
  });

  it('QIZ-07 resumes at the next unanswered question after a frontend remount', async () => {
    const runtime = await testContext.createWithProgress(quizReadyProgress());
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);

    await openReadyQuiz(user);
    await answerCurrentQuestion(user, mission, true);
    await submitAnswer(user);
    await user.click(screen.getByRole('button', { name: 'Next question' }));
    await screen.findByText(`Question 2 of ${mission.questions.length}`);

    testContext.mount(runtime);

    expect(await screen.findByText(`Question 2 of ${mission.questions.length}`)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Review question 1' })).toBeDefined();
  });

  it('QIZ-08 persists a passing attempt and displays Passed with its score', async () => {
    const runtime = await testContext.createWithProgress(quizReadyProgress());
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);

    await openReadyQuiz(user);
    await completeQuiz(user, mission, true);

    expect(screen.getByText('Passed', { selector: '.result-pill' })).toBeDefined();
    expect(screen.getByText('100%', { selector: '.score-dial__percent' })).toBeDefined();
    await waitFor(async () => {
      const progress = await getProgress(runtime);
      expect(progress.attempts).toHaveLength(1);
      expect(progress.attempts[0]).toMatchObject({ result: 'passed', scorePercent: 100 });
    });
  });

  it('QIZ-09 persists a failing attempt and displays Needs review with weak topics', async () => {
    const runtime = await testContext.createWithProgress(quizReadyProgress());
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);

    await openReadyQuiz(user);
    await completeQuiz(user, mission, false);

    expect(screen.getByText('Needs review', { selector: '.result-pill' })).toBeDefined();
    expect(screen.getByRole('list', { name: 'Weak topics' })).toBeDefined();
    await waitFor(async () => {
      const attempt = (await getProgress(runtime)).attempts[0];
      expect(attempt?.result).toBe('needs_review');
      expect(attempt?.weakTopics.length).toBeGreaterThan(0);
    });
  });

  it('QIZ-10 expands a recap row with the answer, verdict, and authored explanation', async () => {
    const runtime = await testContext.createWithProgress(quizReadyProgress());
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);
    const firstQuestion = mission.questions[0]!;
    const wrongText = incorrectOptionTexts(firstQuestion.options)[0]!;

    await openReadyQuiz(user);
    await completeQuiz(user, mission, false);
    const recapStem = screen.getByText(firstQuestion.stem, { selector: '.quiz-recap__stem' });
    const summary = recapStem.closest('summary');
    if (!(summary instanceof HTMLElement)) throw new Error('Quiz recap summary was not rendered.');
    await user.click(summary);

    expect(screen.getByText(`Your answer: ${wrongText}`)).toBeDefined();
    expect(screen.getByText(firstQuestion.incorrectExplanation)).toBeDefined();
    expect(summary.textContent).toContain('Incorrect');
  });

  it('QIZ-11 appends an improved retry and updates both best and latest scores', async () => {
    const failedAttempt = makeQuizAttempt(firstMission.id, false, 'failed');
    const runtime = await testContext.createWithProgress(
      quizReadyProgress({ attempts: [failedAttempt] }),
    );
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);

    await openReadyQuiz(user);
    await completeQuiz(user, mission, true);

    await waitFor(async () => {
      const progress = await getProgress(runtime);
      expect(progress.attempts).toHaveLength(2);
      expect(Math.max(...progress.attempts.map((attempt) => attempt.scorePercent))).toBe(100);
      expect(progress.attempts.at(-1)?.scorePercent).toBe(100);
    });
    expect(screen.getByText('Best score: 100%')).toBeDefined();
  });

  it('QIZ-12 retains the best score when a retry has a lower latest score', async () => {
    const passedAttempt = makeQuizAttempt(firstMission.id, true, 'passed');
    const runtime = await testContext.createWithProgress(
      quizReadyProgress({ attempts: [passedAttempt] }),
    );
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);

    await openReadyQuiz(user);
    await completeQuiz(user, mission, false);

    await waitFor(async () => {
      const progress = await getProgress(runtime);
      expect(progress.attempts).toHaveLength(2);
      expect(Math.max(...progress.attempts.map((attempt) => attempt.scorePercent))).toBe(100);
      expect(progress.attempts.at(-1)?.scorePercent).toBe(0);
    });
    expect(screen.getByText(/Best score: 100%.*latest 0%/)).toBeDefined();
  });

  it('QIZ-13 does not complete a mission when a passing quiz has no submitted checkpoint', async () => {
    const runtime = await testContext.createWithProgress(
      quizReadyProgress({ checkpointCompleted: false }),
    );
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);

    runtime.store.dispatch(
      navigateTo({
        kind: 'quiz',
        missionId: firstMission.id as MissionId,
        attemptId: 'integration-forced-quiz',
      }),
    );
    await screen.findByRole('heading', { level: 1, name: `${firstMission.title} quiz` });
    await completeQuiz(user, mission, true);

    await waitFor(async () => {
      expect((await getProgress(runtime)).missions[firstMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */).toMatchObject({
        status: 'in_progress',
        checkpointCompleted: false,
      });
    });
  });

  it('QIZ-14 completes a checkpoint-qualified mission and awards its badge only once across retries', async () => {
    const runtime = await testContext.createWithProgress(quizReadyProgress());
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);

    await openReadyQuiz(user);
    await completeQuiz(user, mission, true);
    await waitFor(async () => {
      expect((await getProgress(runtime)).missions[firstMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.status).toBe('completed');
    });
    await dismissAllAwardDialogs(user);
    await user.click(screen.getByRole('button', { name: 'Retry quiz' }));
    await completeQuiz(user, mission, true);

    await waitFor(async () => {
      const progress = await getProgress(runtime);
      expect(progress.attempts).toHaveLength(2);
      expect(
        progress.earnedAwards.filter((entry) => entry.awardId === 'award-ai-basics'),
      ).toHaveLength(1);
    });
  });
});
