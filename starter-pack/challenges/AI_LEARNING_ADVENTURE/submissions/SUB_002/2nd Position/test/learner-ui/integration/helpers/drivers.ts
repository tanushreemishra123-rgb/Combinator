import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MissionDetail, QuizQuestion } from '@ai-learning-adventure/types';

export type User = ReturnType<typeof userEvent.setup>;

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function openMissionsBrowser(user: User): Promise<void> {
  const buttons = await screen.findAllByRole('button', { name: 'Explore missions' });
  await user.click(buttons[0]!);
  await screen.findByRole('heading', { level: 1, name: 'Mission map' });
}

export async function startJourney(user: User): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Start the adventure' }));
}

export async function continueJourney(user: User): Promise<void> {
  await user.click(await screen.findByRole('button', { name: /Continue your adventure/ }));
}

export async function openReviewHub(user: User): Promise<void> {
  const shortcuts = await screen.findByRole('navigation', { name: 'More ways to learn' });
  await user.click(within(shortcuts).getByRole('button', { name: 'Review' }));
  await screen.findByRole('heading', { level: 1, name: 'Review' });
}

export async function openProgressDashboard(user: User): Promise<void> {
  await user.click(
    await screen.findByRole('button', { name: /Open the progress dashboard/ }),
  );
  await screen.findByRole('heading', { level: 1, name: 'Progress' });
}

export function missionStepHeading(): HTMLElement {
  return document.getElementById('mission-step-heading') as HTMLElement;
}

export async function goToStep(user: User, targetLabel: string): Promise<void> {
  await user.click(await screen.findByRole('button', { name: `Next: ${targetLabel}` }));
}

export async function goBackStep(user: User): Promise<void> {
  const stepBar = document.querySelector('.mission-step-bar');
  if (!(stepBar instanceof HTMLElement)) throw new Error('Mission step bar is not rendered.');
  await user.click(within(stepBar).getByRole('button', { name: 'Back' }));
}

export async function advanceToCheckpoint(user: User): Promise<void> {
  await goToStep(user, 'Example');
  await screen.findByRole('heading', { level: 2, name: 'Example' });
  await goToStep(user, 'Checkpoint');
  await screen.findByRole('heading', { level: 2, name: 'Checkpoint' });
}

export async function openCurrentMissionQuiz(user: User): Promise<void> {
  const openQuiz = await screen.findByRole('button', { name: 'Open the quiz' });
  await user.click(openQuiz);
  await screen.findByRole('heading', { level: 1, name: / quiz$/ });
}

export function correctOptionTexts(
  options: QuizQuestion['options'],
): string[] {
  return options.filter((option) => option.isCorrect).map((option) => option.text);
}

export function incorrectOptionTexts(
  options: QuizQuestion['options'],
): string[] {
  return options.filter((option) => !option.isCorrect).map((option) => option.text);
}

export function currentQuizQuestion(mission: MissionDetail): QuizQuestion {
  for (const question of mission.questions) {
    if (screen.queryByText(question.stem) !== null) return question;
  }
  throw new Error('No rendered quiz question matches the mission detail.');
}

export async function selectOptionsByText(user: User, texts: string[]): Promise<void> {
  for (const text of texts) {
    const button = screen.queryByRole('button', { name: text });
    if (button !== null) {
      await user.click(button);
      continue;
    }
    const option = screen.queryByLabelText(text);
    if (option !== null) {
      await user.click(option);
      continue;
    }
    throw new Error(`Could not find a selectable control for option text "${text}".`);
  }
}

export async function answerCurrentQuestion(
  user: User,
  mission: MissionDetail,
  correct: boolean,
): Promise<void> {
  const question = currentQuizQuestion(mission);
  const texts = correct ? correctOptionTexts(question.options) : incorrectOptionTexts(question.options).slice(0, 1);
  await selectOptionsByText(user, texts);
}

export async function submitAnswer(user: User): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Submit answer' }));
}

export async function completeQuiz(
  user: User,
  mission: MissionDetail,
  correct: boolean,
): Promise<void> {
  let guard = 0;
  while (guard < 40) {
    guard += 1;
    await answerCurrentQuestion(user, mission, correct);
    await submitAnswer(user);
    const seeResults = screen.queryByRole('button', { name: 'See results' });
    const nextQuestion = screen.queryByRole('button', { name: 'Next question' });
    if (seeResults !== null) {
      await user.click(seeResults);
      await screen.findByRole('region', { name: 'Quiz results' });
      return;
    }
    if (nextQuestion !== null) {
      await user.click(nextQuestion);
      continue;
    }
    throw new Error('The quiz did not advance after submitting an answer.');
  }
  throw new Error('The quiz loop exceeded its guard limit.');
}

export async function submitCorrectCheckpoint(
  user: User,
  mission: MissionDetail,
): Promise<void> {
  const option = mission.checkpoint.kind === 'single_question'
    ? mission.checkpoint.options.find((candidate) => candidate.isCorrect)
    : undefined;
  if (option === undefined) {
    throw new Error(`Mission ${mission.id} has no single-question correct checkpoint option.`);
  }
  await user.click(await screen.findByLabelText(option.text));
  await user.click(await screen.findByRole('button', { name: 'Submit' }));
}

export async function startQuizFromCheckpoint(user: User): Promise<void> {
  await user.click(await screen.findByRole('button', { name: 'Next: Quiz' }));
}

export async function dismissAllAwardDialogs(user: User): Promise<void> {
  let guard = 0;
  while (guard < 10) {
    guard += 1;
    const dialog = screen.queryByRole('dialog');
    if (dialog === null) return;
    await user.click(within(dialog).getByRole('button', { name: 'Nice!' }));
  }
}

export async function openMissionFromMap(user: User, missionTitle: string): Promise<void> {
  const node = await screen.findByRole('button', { name: new RegExp(`^Mission \\d+: ${escapeRegExp(missionTitle)}\\.`) /* nosemgrep: gitlab.eslint.detect-non-literal-regexp, javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp */ });
  await user.click(node);
  await screen.findByRole('heading', { level: 1, name: missionTitle });
}

export async function openMissionDeckFromLesson(user: User, term: string): Promise<void> {
  const keyTerm = await screen.findByRole('button', { name: term });
  await user.click(keyTerm);
  const dialog = await screen.findByRole('dialog', { name: new RegExp(escapeRegExp(term)) /* nosemgrep: gitlab.eslint.detect-non-literal-regexp, javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp */ });
  await user.click(within(dialog).getByRole('button', { name: 'Open the full deck' }));
}
