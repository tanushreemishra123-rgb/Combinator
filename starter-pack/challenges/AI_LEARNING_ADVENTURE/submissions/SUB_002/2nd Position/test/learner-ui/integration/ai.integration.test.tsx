import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AI_PROVIDER_STORAGE_KEY } from '../../../apps/learner-ui/src/features/ai-provider/aiProviderStorage.ts';
import { getMission, getProgress, installApiInterceptor } from './helpers/api.ts';
import {
  answerCurrentQuestion,
  continueJourney,
  currentQuizQuestion,
  escapeRegExp,
  incorrectOptionTexts,
  openCurrentMissionQuiz,
  startJourney,
  submitAnswer,
} from './helpers/drivers.ts';
import {
  makeMissionProgress,
  makePortableProgress,
  seededMissions,
} from './helpers/fixtures.ts';
import { integrationTestContext } from './helpers/setup.ts';

const testContext = integrationTestContext();
const firstMission = seededMissions[0]!;

async function openFirstMissionLesson(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
  await startJourney(user);
  await screen.findByRole('heading', { level: 1, name: firstMission.title });
}

async function openInlineTutor(user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', { name: 'Ask the tutor' }));
  return screen.findByRole('dialog', { name: 'AI Tutor' });
}

async function openAiOnly(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const shortcuts = await screen.findByRole('navigation', { name: 'More ways to learn' });
  await user.click(within(shortcuts).getByRole('button', { name: 'AI Only Mode' }));
  await screen.findByRole('heading', { level: 1, name: 'AI Only Mode' });
  await screen.findByRole('heading', { level: 2, name: 'Where should we begin?' });
}

function quizReadyProgress() {
  return makePortableProgress({
    missions: {
      [firstMission.id]: makeMissionProgress(firstMission.id, {
        status: 'in_progress',
        furthestStep: 'quiz',
        checkpointCompleted: true,
      }),
    },
  });
}

function quickAction(name: string): HTMLElement {
  const buttons = screen.getAllByRole('button', { name });
  const button = buttons[0];
  if (button === undefined) throw new Error(`AI Only quick action "${name}" was not rendered.`);
  return button;
}

describe('inline tutor and AI fallback', () => {
  it('AI-01 opens the lesson tutor with mission and step context', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await openFirstMissionLesson(user);
    const dialog = await openInlineTutor(user);

    expect(within(dialog).getByText('AI Tutor')).toBeDefined();
    expect(within(dialog).getByText(`${firstMission.title} · lesson`)).toBeDefined();
    expect(within(dialog).getByText(/AI can make mistakes/)).toBeDefined();
    expect(document.activeElement).toBe(within(dialog).getByLabelText('Ask the tutor'));
  });

  it('AI-02 sends a tutor question and shows a clearly labeled sample reply', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await openFirstMissionLesson(user);
    const dialog = await openInlineTutor(user);
    await user.type(within(dialog).getByLabelText('Ask the tutor'), 'Explain narrow AI{Enter}');

    expect(await within(dialog).findByText('Explain narrow AI')).toBeDefined();
    expect(await within(dialog).findByText('Sample / mock AI response')).toBeDefined();
    expect(within(dialog).getByText(/Configure AI for personalized answers/)).toBeDefined();
  });

  it('AI-03 runs simpler-explanation, example, and mission-summary tutor actions', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await openFirstMissionLesson(user);
    const dialog = await openInlineTutor(user);
    for (const name of ['Explain simply', 'Give an example', 'Summarize this mission']) {
      await user.click(within(dialog).getByRole('button', { name }));
      await waitFor(() => {
        expect(within(dialog).getAllByText('Sample / mock AI response').length).toBeGreaterThanOrEqual(
          ['Explain simply', 'Give an example', 'Summarize this mission'].indexOf(name) + 1,
        );
      });
    }

    expect(within(dialog).getByText('Explain the current concept simply.')).toBeDefined();
    expect(within(dialog).getByText('Give me a fresh example.')).toBeDefined();
    expect(within(dialog).getByText('Summarize this mission.')).toBeDefined();
  });

  it('AI-04 provides a quiz hint without revealing a correct option', async () => {
    const runtime = await testContext.createWithProgress(quizReadyProgress());
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await continueJourney(user);
    await screen.findByRole('heading', { level: 1, name: firstMission.title });
    await openCurrentMissionQuiz(user);
    const question = currentQuizQuestion(mission);
    await user.click(screen.getByRole('button', { name: 'Get a hint' }));

    const hint = await screen.findByRole('region', { name: 'Hint 1 of 3' });
    for (const correctOption of question.options.filter((option) => option.isCorrect)) {
      expect(hint.textContent).not.toContain(correctOption.text);
    }
    expect(within(hint).getByText('Sample / mock AI response')).toBeDefined();
  });

  it('AI-05 explains both correct and incorrect submitted answers in context', async () => {
    const runtime = await testContext.createWithProgress(quizReadyProgress());
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await continueJourney(user);
    await screen.findByRole('heading', { level: 1, name: firstMission.title });
    await openCurrentMissionQuiz(user);

    await answerCurrentQuestion(user, mission, true);
    await submitAnswer(user);
    await user.click(await screen.findByRole('button', { name: 'Why is this right?' }));
    expect(await screen.findByRole('region', { name: 'AI explanation' })).toBeDefined();
    expect(screen.getByText('Sample / mock AI response')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Next question' }));

    const secondQuestion = currentQuizQuestion(mission);
    await user.click(screen.getByRole('button', { name: incorrectOptionTexts(secondQuestion.options)[0]! }));
    await submitAnswer(user);
    await user.click(await screen.findByRole('button', { name: 'Why was I wrong?' }));

    const explanations = await screen.findAllByRole('region', { name: 'AI explanation' });
    expect(explanations).toHaveLength(1);
    expect(within(explanations[0]!).getByText('Sample / mock AI response')).toBeDefined();
  });

  it('AI-06 retains the mission conversation after the tutor is closed and reopened', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await openFirstMissionLesson(user);
    let dialog = await openInlineTutor(user);
    await user.type(within(dialog).getByLabelText('Ask the tutor'), 'Remember this question{Enter}');
    await within(dialog).findByText('Sample / mock AI response');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'AI Tutor' })).toBeNull();

    dialog = await openInlineTutor(user);
    expect(within(dialog).getByText('Remember this question')).toBeDefined();
    expect(within(dialog).getByText('Sample / mock AI response')).toBeDefined();
  });
});

describe('AI Only Mode', () => {
  it('AI-07 asks a grounded question and exposes its mission source', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await openAiOnly(user);
    await user.type(screen.getByLabelText('Ask about the mission collection'), 'What is artificial intelligence?{Enter}');

    expect(await screen.findByText(/This sample tutor response is scoped to/)).toBeDefined();
    expect(screen.getByText('Sample / mock AI response')).toBeDefined();
    expect(within(screen.getByLabelText('Sources')).getByRole('button', { name: new RegExp(escapeRegExp(firstMission.title)) /* nosemgrep: gitlab.eslint.detect-non-literal-regexp, javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp */ })).toBeDefined();
  });

  it('AI-08 narrows subsequent conversation to the selected mission scope', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await openAiOnly(user);
    await user.selectOptions(screen.getByLabelText('Learning scope'), `mission:${firstMission.id}`);
    expect(await screen.findByRole('heading', { level: 2, name: new RegExp(escapeRegExp(firstMission.title)) /* nosemgrep: gitlab.eslint.detect-non-literal-regexp, javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp */ })).toBeDefined();
    await user.type(screen.getByLabelText(`Ask about ${firstMission.title}`), 'Explain this mission{Enter}');

    expect(await screen.findByText('Explain this mission')).toBeDefined();
    expect(await screen.findByText(/This sample tutor response is scoped to/)).toBeDefined();
    expect(
      within(screen.getByLabelText('Sources')).getByRole('button', {
        name: new RegExp(escapeRegExp(firstMission.title)) /* nosemgrep: gitlab.eslint.detect-non-literal-regexp, javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp */,
      }),
    ).toBeDefined();
  });

  it('AI-09 exercises all six AI Only quick-action interaction patterns', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await openAiOnly(user);

    await user.click(quickAction('Explain simply'));
    await screen.findByText('Sample / mock AI response');
    await user.click(quickAction('Give an example'));
    await waitFor(() => expect(screen.getAllByText('Sample / mock AI response').length).toBeGreaterThanOrEqual(2));

    await user.click(quickAction('Give me a hint'));
    let dialog = await screen.findByRole('dialog', { name: 'Choose a question for your hint' });
    await user.click(within(dialog).getByRole('button', { name: 'Get hint' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Choose a question for your hint' })).toBeNull());

    await user.click(quickAction('Summarize a mission'));
    dialog = await screen.findByRole('dialog', { name: 'Choose a mission to summarize' });
    await user.click(within(dialog).getByRole('button', { name: 'Create summary' }));
    expect(await screen.findByRole('heading', { level: 3, name: 'Key takeaways' })).toBeDefined();

    await user.click(quickAction('What should I learn next?'));
    expect(await screen.findByText('Progress-aware next step')).toBeDefined();

    await user.click(quickAction('Review my answer'));
    dialog = await screen.findByRole('dialog', { name: 'Share an answer for coaching' });
    await user.type(
      within(dialog).getByLabelText('Your answer or reasoning'),
      'AI performs bounded tasks and people still need to review important output.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Get feedback' }));
    expect(await screen.findByText('What you got right')).toBeDefined();
    expect(screen.getByText("What's missing")).toBeDefined();
  });

  it('AI-10 advances an authored conversational walkthrough and persists covered steps', async () => {
    const runtime = await testContext.create();
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await openAiOnly(user);
    await user.selectOptions(screen.getByLabelText('Learning scope'), `mission:${firstMission.id}`);
    await user.click(await screen.findByRole('button', { name: 'Walk me through this mission' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Your objective' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'I get it - next' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Lesson' })).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'I get it - next' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Example' })).toBeDefined();

    await waitFor(async () => {
      expect((await getProgress(runtime)).missions[firstMission.id] /* nosemgrep: gitlab.eslint.detect-object-injection */?.furthestStep).toBe('example');
    });
    expect(screen.getByText('Progress updated for this mission.')).toBeDefined();
  });

  it('AI-11 restores conversation, mission scope, and walkthrough position after exit and re-entry', async () => {
    await testContext.create();
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await openAiOnly(user);
    await user.selectOptions(screen.getByLabelText('Learning scope'), `mission:${firstMission.id}`);
    await user.type(screen.getByLabelText(`Ask about ${firstMission.title}`), 'Keep this conversation{Enter}');
    await screen.findByText('Sample / mock AI response');
    await user.click(screen.getByRole('button', { name: 'Walk me through this mission' }));
    await user.click(screen.getByRole('button', { name: 'I get it - next' }));
    await screen.findByRole('heading', { level: 2, name: 'Lesson' });

    await user.click(within(screen.getByRole('navigation', { name: 'Screen navigation' })).getByRole('button', { name: 'Back' }));
    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'AI Only Mode' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'AI Only Mode' })).toBeDefined();
    expect((screen.getByLabelText('Learning scope') as HTMLSelectElement).value).toBe(`mission:${firstMission.id}`);
    expect(screen.getByText('Keep this conversation')).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Lesson' })).toBeDefined();
  });

  it('AI-12 shows setup guidance and labeled sample output when no provider is configured', async () => {
    await testContext.create();
    const user = userEvent.setup();

    expect(await screen.findByText(/AI is not configured/)).toBeDefined();
    await openAiOnly(user);
    await user.type(screen.getByLabelText('Ask about the mission collection'), 'Give me an example{Enter}');

    expect(await screen.findByText('Sample / mock AI response')).toBeDefined();
    expect(screen.getByText('Configure AI for personalized answers.')).toBeDefined();
  });

  it('AI-13 exposes a live-provider error and then renders labeled fallback content', async () => {
    const runtime = await testContext.create({ deferRender: true });
    localStorage.setItem(
      AI_PROVIDER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        kind: 'openai',
        endpoint: 'https://provider.example/v1',
        modelName: 'integration-model',
        apiKey: 'integration-invalid-key',
        updatedAt: '2026-08-14T00:00:00.000Z',
      }),
    );
    const interceptor = installApiInterceptor(runtime);
    interceptor.block(
      (url) => url.startsWith('https://provider.example/v1/'),
      () => new Response('unauthorized', { status: 401 }),
    );
    testContext.mount(runtime);
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await openAiOnly(user);
    await user.type(screen.getByLabelText('Ask about the mission collection'), 'Explain AI{Enter}');

    expect(await screen.findByText('Live AI was unavailable.')).toBeDefined();
    expect(screen.getByText(/provider rejected this API key/i)).toBeDefined();
    expect(screen.getByText('Sample / mock AI response')).toBeDefined();
    expect(document.body.textContent).not.toContain('integration-invalid-key');
  });

  it('AI-14 makes no unapproved network request while configured for mock-only mode', async () => {
    const runtime = await testContext.create({ deferRender: true });
    localStorage.setItem(
      AI_PROVIDER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        kind: 'mock',
        updatedAt: '2026-08-14T00:00:00.000Z',
      }),
    );
    testContext.mount(runtime);
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await openAiOnly(user);
    await user.type(screen.getByLabelText('Ask about the mission collection'), 'Explain AI{Enter}');
    expect(await screen.findByText('Sample / mock AI response')).toBeDefined();

    const unexpected = runtime.requestUrls.filter(
      (url) => !url.startsWith('/api/v1') && !url.startsWith(runtime.baseUrl),
    );
    expect(unexpected).toEqual([]);
    expect(runtime.requestUrls.some((url) => url.includes('/chat/completions'))).toBe(false);
  });
});
