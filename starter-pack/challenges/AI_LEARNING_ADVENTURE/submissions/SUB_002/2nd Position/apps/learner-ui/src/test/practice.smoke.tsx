import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type {
  Flashcard,
  MissionDetail,
  QuizAttempt,
  QuizQuestion,
} from '@ai-learning-adventure/types';
import {
  makeMissionDetail,
  makeMissionProgress,
  makeSnapshot,
  seedCatalog,
} from './fixtures.ts';
import { renderApp } from './harness.tsx';

const catalog = seedCatalog();

function quizQuestions(): QuizQuestion[] {
  return [
    {
      id: 'q-1' as never,
      missionId: 'mission-1' as never,
      type: 'multiple_choice',
      stem: 'What does AI learn from?',
      selectionMode: 'single',
      options: [
        { id: 'q1-a', text: 'Data', isCorrect: true },
        { id: 'q1-b', text: 'Guesses', isCorrect: false },
      ],
      correctExplanation: 'AI learns patterns from data.',
      incorrectExplanation: 'AI learns patterns from data, not guesses.',
      conceptTags: ['data'],
    },
    {
      id: 'q-2' as never,
      missionId: 'mission-1' as never,
      type: 'multiple_choice',
      stem: 'Which is a narrow AI example?',
      selectionMode: 'single',
      options: [
        { id: 'q2-a', text: 'Spam filter', isCorrect: true },
        { id: 'q2-b', text: 'A toaster', isCorrect: false },
      ],
      correctExplanation: 'A spam filter performs one specific task.',
      incorrectExplanation: 'A spam filter is a narrow tool for one task.',
      conceptTags: ['data'],
    },
  ];
}

function multiSelectQuestion(): QuizQuestion {
  return {
    id: 'q-1' as never,
    missionId: 'mission-1' as never,
    type: 'multiple_choice',
    stem: 'Which are AI capabilities?',
    selectionMode: 'multiple',
    options: [
      { id: 'm-a', text: 'Recognizing patterns', isCorrect: true },
      { id: 'm-b', text: 'Processing language', isCorrect: true },
      { id: 'm-c', text: 'Needing no data', isCorrect: false },
    ],
    correctExplanation: 'AI can recognize patterns and process language.',
    incorrectExplanation: 'AI systems still need data.',
    conceptTags: ['data'],
  };
}

function trueFalseQuestion(): QuizQuestion {
  return {
    id: 'q-1' as never,
    missionId: 'mission-1' as never,
    type: 'true_false',
    stem: 'AI systems can be narrow without human-level intelligence.',
    selectionMode: 'single',
    options: [
      { id: 'tf-true', text: 'True', isCorrect: true },
      { id: 'tf-false', text: 'False', isCorrect: false },
    ],
    correctExplanation: 'Most deployed AI is narrow.',
    incorrectExplanation: 'AI does not need to be general.',
    conceptTags: ['data'],
  };
}

function scenarioQuestion(): QuizQuestion {
  return {
    id: 'q-1' as never,
    missionId: 'mission-1' as never,
    type: 'scenario',
    stem: 'What is the best next step?',
    scenario: 'A teammate pastes a customer email into a public chatbot.',
    selectionMode: 'single',
    options: [
      { id: 's-a', text: 'Stop and flag the data risk', isCorrect: true },
      {
        id: 's-b',
        text: 'Ignore it once',
        isCorrect: false,
        incorrectReason: 'The risk repeats every time.',
      },
    ],
    correctExplanation: 'Customer data must never be shared with logging tools.',
    incorrectExplanation: 'Even one paste can leak data.',
    conceptTags: ['data'],
    allowsReasoning: true,
  };
}

function reviewCards(): Flashcard[] {
  return [
    {
      id: 'fc-data' as never,
      missionId: 'mission-1' as never,
      concept: 'Data',
      definition: 'Information used to train AI systems.',
      example: 'Labelled emails for a spam filter.',
      conceptTags: ['data'],
    },
    {
      id: 'fc-models' as never,
      missionId: 'mission-1' as never,
      concept: 'Models',
      definition: 'Programs trained to recognize patterns.',
      example: 'A traffic predictor.',
      conceptTags: ['models'],
    },
  ];
}

function failedAttempt(): QuizAttempt {
  return {
    id: 'attempt-failed',
    missionId: 'mission-1' as never,
    contentVersion: 1,
    answers: [
      {
        questionId: 'q-1' as never,
        selectedOptionIds: ['q1-b'],
        isCorrect: false,
        conceptTags: ['data'],
      },
    ],
    scorePercent: 0,
    correctCount: 0,
    questionCount: 1,
    result: 'needs_review',
    weakTopics: ['data'],
    startedAt: '2026-08-01T10:00:00.000Z' as never,
    completedAt: '2026-08-01T10:05:00.000Z' as never,
  };
}

function quizReadySnapshot() {
  return makeSnapshot({
    missions: {
      'mission-1': makeMissionProgress('mission-1', {
        status: 'in_progress',
        furthestStep: 'quiz',
        checkpointCompleted: true,
      }),
    },
  });
}

function detailsFor(overrides: Record<string, MissionDetail> = {}): Record<string, MissionDetail> {
  return {
    'mission-1': makeMissionDetail({
      id: 'mission-1',
      title: 'What Is AI?',
      questions: quizQuestions(),
    }),
    ...overrides,
  };
}

async function openQuiz(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Record<string, MissionDetail> = {},
) {
  await user.click(await screen.findByRole('button', { name: /Continue your adventure/ }));
  await screen.findByRole('heading', { level: 2, name: 'Quiz' });
  await user.click(screen.getByRole('button', { name: 'Open the quiz' }));
  await screen.findByRole('heading', { level: 1, name: 'What Is AI? quiz' });
}

function quizAttemptPosts(fetchMock: ReturnType<typeof renderApp>['fetchMock']) {
  return fetchMock.mock.calls.filter(
    (call) => String(call[0]).includes('/quiz-attempts') && call[1]?.method === 'POST',
  );
}

describe('quiz runner', () => {
  it('grades answers, explains them, and shows results with score and weak topics', async () => {
    const user = userEvent.setup();
    const { fetchMock } = renderApp(catalog, quizReadySnapshot(), { missionDetails: detailsFor() });
    await openQuiz(user);

    expect(screen.getByText('Question 1 of 2')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Submit answer' }).hasAttribute('disabled')).toBe(true);

    await user.click(screen.getByLabelText('Data'));
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect(await screen.findByText('Nice — here’s why that’s right')).toBeDefined();
    expect(screen.getByText('AI learns patterns from data.')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Next question' }));
    expect(await screen.findByText('Question 2 of 2')).toBeDefined();

    await user.click(screen.getByLabelText('A toaster'));
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect(await screen.findByText('Not quite — here’s why')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'See results' }));

    expect(await screen.findByText('1/2')).toBeDefined();
    expect(screen.getByText('50%', { selector: '.score-dial__percent' })).toBeDefined();
    expect(screen.getByText('Needs review', { selector: '.result-pill' })).toBeDefined();
    expect(screen.getByRole('button', { name: /data\s+1/ })).toBeDefined();

    const posts = quizAttemptPosts(fetchMock);
    expect(posts).toHaveLength(1);
    const body = JSON.parse(String(posts[0]?.[1]?.body)) as { attempt: { answers: unknown[] } };
    expect(body.attempt.answers).toHaveLength(2);

    const recap = screen.getByRole('list', { name: 'Question recap' });
    expect(within(recap).getByText(/Correct/)).toBeDefined();
    expect(within(recap).getByText(/Incorrect/)).toBeDefined();
  });

  it('passes at the threshold and offers retry and next mission', async () => {
    const user = userEvent.setup();
    renderApp(catalog, quizReadySnapshot(), { missionDetails: detailsFor() });
    await openQuiz(user);

    await user.click(screen.getByLabelText('Data'));
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    await user.click(await screen.findByRole('button', { name: 'Next question' }));
    await user.click(screen.getByLabelText('Spam filter'));
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    await user.click(screen.getByRole('button', { name: 'See results' }));

    expect(await screen.findByText('Passed', { selector: '.result-pill' })).toBeDefined();
    expect(screen.getByText('Why this next')).toBeDefined();
    expect(
      screen.getByText('Generative AI', { selector: '.recommendation-card__title' }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start mission' })).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Retry quiz' }));
    expect(await screen.findByText('Question 1 of 2')).toBeDefined();
  });

  it('requires every correct option for multi-select credit', async () => {
    const user = userEvent.setup();
    renderApp(catalog, quizReadySnapshot(), {
      missionDetails: detailsFor({
        'mission-1': makeMissionDetail({
          id: 'mission-1',
          title: 'What Is AI?',
          questions: [multiSelectQuestion()],
        }),
      }),
    });
    await openQuiz(user);

    expect(screen.getByText('Select all that apply')).toBeDefined();
    await user.click(screen.getByLabelText('Recognizing patterns'));
    await user.click(screen.getByLabelText('Processing language'));
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect(await screen.findByText('Nice — here’s why that’s right')).toBeDefined();
  });

  it('marks a partial multi-select answer incorrect and shows the missed option', async () => {
    const user = userEvent.setup();
    renderApp(catalog, quizReadySnapshot(), {
      missionDetails: detailsFor({
        'mission-1': makeMissionDetail({
          id: 'mission-1',
          title: 'What Is AI?',
          questions: [multiSelectQuestion()],
        }),
      }),
    });
    await openQuiz(user);

    await user.click(screen.getByLabelText('Recognizing patterns'));
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect(await screen.findByText('Not quite — here’s why')).toBeDefined();
    expect(screen.getByLabelText('Processing language').closest('.quiz-option')?.className).toContain(
      'quiz-option--missed',
    );
  });

  it('renders true/false buttons and scores them', async () => {
    const user = userEvent.setup();
    renderApp(catalog, quizReadySnapshot(), {
      missionDetails: detailsFor({
        'mission-1': makeMissionDetail({
          id: 'mission-1',
          title: 'What Is AI?',
          questions: [trueFalseQuestion()],
        }),
      }),
    });
    await openQuiz(user);

    expect(screen.getByText('Question 1 of 1')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'True' }));
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect(await screen.findByText('Nice — here’s why that’s right')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'See results' }));
    expect(await screen.findByText('Passed', { selector: '.result-pill' })).toBeDefined();
  });

  it('renders the scenario panel, collects reasoning, and explains near misses', async () => {
    const user = userEvent.setup();
    renderApp(catalog, quizReadySnapshot(), {
      missionDetails: detailsFor({
        'mission-1': makeMissionDetail({
          id: 'mission-1',
          title: 'What Is AI?',
          questions: [scenarioQuestion()],
        }),
      }),
    });
    await openQuiz(user);

    expect(screen.getByText('A teammate pastes a customer email into a public chatbot.')).toBeDefined();
    await user.type(screen.getByLabelText('Explain your reasoning (optional)'), 'Data is risky here.');
    await user.click(screen.getByLabelText('Ignore it once'));
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    expect(await screen.findByText('Not quite — here’s why')).toBeDefined();
    expect(screen.getByText('The risk repeats every time.')).toBeDefined();
    expect(screen.getByLabelText('Explain your reasoning (optional)').hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('lets the learner review answered questions read-only via the dots', async () => {
    const user = userEvent.setup();
    renderApp(catalog, quizReadySnapshot(), { missionDetails: detailsFor() });
    await openQuiz(user);

    await user.click(screen.getByLabelText('Data'));
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    await user.click(await screen.findByRole('button', { name: 'Next question' }));
    expect(await screen.findByText('Question 2 of 2')).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Review question 1' }));
    expect(await screen.findByText('Question 1 of 2')).toBeDefined();
    expect(screen.getByText('Nice — here’s why that’s right')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Submit answer' })).toBeNull();
  });

  it('shows a save error and lets the learner retry saving the result', async () => {
    const user = userEvent.setup();
    const { fetchMock } = renderApp(catalog, quizReadySnapshot(), {
      missionDetails: detailsFor({
        'mission-1': makeMissionDetail({
          id: 'mission-1',
          title: 'What Is AI?',
          questions: [trueFalseQuestion()],
        }),
      }),
    });
    await openQuiz(user);

    const baseFetch = window.fetch;
    vi.stubGlobal(
      'fetch',
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes('/quiz-attempts')) {
          throw new TypeError('network down');
        }
        return baseFetch(input, init);
      },
    );

    await user.click(screen.getByRole('button', { name: 'True' }));
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    await user.click(screen.getByRole('button', { name: 'See results' }));
    expect(await screen.findByText('Passed', { selector: '.result-pill' })).toBeDefined();
    expect(await screen.findByText(/could not be saved yet/)).toBeDefined();

    vi.stubGlobal('fetch', baseFetch);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    const posts = quizAttemptPosts(fetchMock);
    await waitFor(() => {
      expect(posts.length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText(/could not be saved yet/)).toBeNull();
  });

  it('resumes an unfinished quiz after the page reloads', async () => {
    const user = userEvent.setup();
    const first = renderApp(catalog, quizReadySnapshot(), { missionDetails: detailsFor() });
    await openQuiz(user);

    await user.click(screen.getByLabelText('Data'));
    await user.click(screen.getByRole('button', { name: 'Submit answer' }));
    await user.click(await screen.findByRole('button', { name: 'Next question' }));
    expect(await screen.findByText('Question 2 of 2')).toBeDefined();

    first.unmount();

    const second = renderApp(catalog, quizReadySnapshot(), { missionDetails: detailsFor() });
    expect(await screen.findByText('Question 2 of 2')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Review question 1' })).toBeDefined();
    second.unmount();
  });
});

async function openDeck(user: ReturnType<typeof userEvent.setup>) {
  const shortcuts = await screen.findByRole('navigation', { name: 'More ways to learn' });
  await user.click(within(shortcuts).getByRole('button', { name: 'Explore missions' }));
  await user.click(await screen.findByRole('button', { name: /Mission 1: What Is AI\?/ }));
  await screen.findByRole('heading', { level: 1, name: 'What Is AI?' });
  await user.click(screen.getByRole('button', { name: 'Step 5 of 5: Result' }));
  await user.click(await screen.findByRole('button', { name: 'Review flashcards' }));
  await screen.findByRole('heading', { level: 1, name: 'What Is AI? flashcards' });
}

function deckReadySnapshot() {
  return makeSnapshot({
    missions: {
      'mission-1': makeMissionProgress('mission-1', {
        status: 'completed',
        furthestStep: 'result',
        checkpointCompleted: true,
      }),
    },
    attempts: [
      {
        ...failedAttempt(),
        id: 'attempt-passed',
        scorePercent: 100,
        correctCount: 1,
        result: 'passed',
        weakTopics: [],
      },
    ],
  });
}

describe('flashcard deck', () => {
  const deckDetails = (): Record<string, MissionDetail> => ({
    'mission-1': makeMissionDetail({
      id: 'mission-1',
      title: 'What Is AI?',
      flashcards: reviewCards(),
    }),
  });

  it('flips cards, rates them, and shows the deck summary', async () => {
    const user = userEvent.setup();
    const { fetchMock } = renderApp(catalog, deckReadySnapshot(), {
      missionDetails: deckDetails(),
    });
    await openDeck(user);

    expect(screen.getByText(/Card 1 of 2/)).toBeDefined();
    expect(screen.getByText('Data')).toBeDefined();

    expect(screen.getByRole('button', { name: 'Got it' }).hasAttribute('disabled')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Flip' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(screen.getByRole('button', { name: /Card front: “Data”/ }));
    expect(await screen.findByText('Information used to train AI systems.')).toBeDefined();
    expect(screen.getByText('Labelled emails for a spam filter.')).toBeDefined();
    expect(document.querySelector('.flashcard')?.classList.contains('flashcard--flipped')).toBe(true);
    const ratingPuts = fetchMock.mock.calls.filter(
      (call) => String(call[0]).includes('/flashcards/fc-data/rating') && call[1]?.method === 'PUT',
    );
    expect(ratingPuts).toHaveLength(1);
    const body = JSON.parse(String(ratingPuts[0]?.[1]?.body)) as { rating: string };
    expect(body.rating).toBe('got_it');

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText(/Card 2 of 2/)).toBeDefined();
    await user.click(screen.getByRole('button', { name: /Card front:/ }));
    await user.click(screen.getByRole('button', { name: 'Needs work' }));
    await user.click(screen.getByRole('button', { name: 'Finish deck' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'What Is AI? flashcards' })).toBeDefined();
    expect(screen.getByText(/got it/).textContent).toContain('1');
    expect(screen.getByText(/needs work/).textContent).toContain('1');

    await user.click(screen.getByRole('button', { name: 'Review needs-work only' }));
    expect(await screen.findByText(/Card 1 of 1/)).toBeDefined();
  });

  it('supports shuffle, restart, and keyboard navigation', async () => {
    const user = userEvent.setup();
    renderApp(catalog, deckReadySnapshot(), { missionDetails: deckDetails() });
    await openDeck(user);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText(/Card 2 of 2/)).toBeDefined();

    await user.keyboard('{ArrowLeft}');
    expect(await screen.findByText(/Card 1 of 2/)).toBeDefined();
    await user.keyboard('{ArrowRight}');
    expect(await screen.findByText(/Card 2 of 2/)).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Shuffle' }));
    expect(await screen.findByText(/Card \d of 2/)).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Restart deck' }));
    expect(await screen.findByText(/Card 1 of/)).toBeDefined();
  });
});

describe('weak-topic review', () => {
  const reviewDetails = (): Record<string, MissionDetail> => ({
    'mission-1': makeMissionDetail({
      id: 'mission-1',
      title: 'What Is AI?',
      flashcards: reviewCards(),
    }),
  });

  it('ranks weak topics from quiz misses and needs-work ratings', async () => {
    const user = userEvent.setup();
    renderApp(
      catalog,
      makeSnapshot({
        attempts: [failedAttempt()],
        flashcardRatings: {
          'fc-models': { rating: 'needs_work', reviewCount: 1, updatedAt: '2026-08-01T00:00:00.000Z' as never },
        },
      }),
      { missionDetails: reviewDetails() },
    );

    await user.click(await screen.findByRole('button', { name: 'Review' }));
    await screen.findByRole('heading', { level: 1, name: 'Review' });

    expect(screen.getByText('Your weak topics')).toBeDefined();
    const topics = screen.getByRole('list', { name: 'Weak topics' });
    expect(within(topics).getByRole('button', { name: /data/ })).toBeDefined();
    expect(within(topics).getByRole('button', { name: /models/ })).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Start review' }));
    expect(await screen.findByText(/Card 1 of 2/)).toBeDefined();
  });

  it('opens a topic-filtered deck from a weak-topic chip', async () => {
    const user = userEvent.setup();
    renderApp(
      catalog,
      makeSnapshot({ attempts: [failedAttempt()] }),
      { missionDetails: reviewDetails() },
    );

    await user.click(await screen.findByRole('button', { name: 'Review' }));
    await screen.findByRole('heading', { level: 1, name: 'Review' });
    await user.click(screen.getByRole('button', { name: /data/ }));

    expect(await screen.findByText('Review · data')).toBeDefined();
    expect(screen.getByText(/Card 1 of 1/)).toBeDefined();
    expect(screen.getByText('Data')).toBeDefined();
  });

  it('keeps Needs work enabled on the review deck front and flips the card', async () => {
    const user = userEvent.setup();
    const { fetchMock } = renderApp(
      catalog,
      makeSnapshot({ attempts: [failedAttempt()] }),
      { missionDetails: reviewDetails() },
    );

    await user.click(await screen.findByRole('button', { name: 'Review' }));
    await screen.findByRole('heading', { level: 1, name: 'Review' });
    await user.click(screen.getByRole('button', { name: 'Start review' }));
    await screen.findByText(/Card 1 of 1/);

    const needsWork = screen.getByRole('button', { name: 'Needs work' });
    expect(needsWork.hasAttribute('disabled')).toBe(false);
    await user.click(needsWork);
    expect(needsWork.className).toContain('flashcard-deck__rating--active');

    await waitFor(() => {
      const ratingPuts = fetchMock.mock.calls.filter(
        (call) => String(call[0]).includes('/flashcards/fc-data/rating') && call[1]?.method === 'PUT',
      );
      expect(ratingPuts).toHaveLength(1);
    });

    await user.click(screen.getByRole('button', { name: /Card front: “Data”/ }));
    expect(await screen.findByText('Information used to train AI systems.')).toBeDefined();
    expect(document.querySelector('.flashcard')?.classList.contains('flashcard--flipped')).toBe(true);
  });

  it('shows the encouraging empty state when there is nothing to review', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot(), { missionDetails: reviewDetails() });

    await user.click(await screen.findByRole('button', { name: 'Review' }));
    expect(await screen.findByText(/Nothing to review yet — great work!/)).toBeDefined();
  });

  it('restarts the deck when re-entering review after ratings change', async () => {
    const user = userEvent.setup();
    renderApp(
      catalog,
      makeSnapshot({
        attempts: [failedAttempt()],
        flashcardRatings: {
          'fc-models': {
            rating: 'needs_work',
            reviewCount: 1,
            updatedAt: '2026-08-01T00:00:00.000Z' as never,
          },
        },
      }),
      { missionDetails: reviewDetails() },
    );

    await user.click(await screen.findByRole('button', { name: 'Review' }));
    await screen.findByRole('heading', { level: 1, name: 'Review' });
    await user.click(screen.getByRole('button', { name: 'Start review' }));
    expect(await screen.findByText(/Card 1 of 2/)).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Got it' }));

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await screen.findByRole('heading', { level: 1, name: 'Review' });
    await user.click(screen.getByRole('button', { name: 'Start review' }));

    expect(await screen.findByText(/Card 1 of 1/)).toBeDefined();
  });
});
