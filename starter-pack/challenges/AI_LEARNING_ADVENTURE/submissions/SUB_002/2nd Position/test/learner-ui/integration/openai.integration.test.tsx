import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OPENAI_ENDPOINT,
  DEFAULT_OPENAI_MODEL,
} from '@ai-learning-adventure/learner';
import type { PortableProgressSnapshot } from '@ai-learning-adventure/types';
import { AI_PROVIDER_STORAGE_KEY } from '../../../apps/learner-ui/src/features/ai-provider/aiProviderStorage.ts';
import type { IntegrationApp } from './harness.tsx';
import {
  getMission,
  importProgress,
  installApiInterceptor,
} from './helpers/api.ts';
import {
  continueJourney,
  currentQuizQuestion,
  escapeRegExp,
  openCurrentMissionQuiz,
  startJourney,
  type User,
} from './helpers/drivers.ts';
import {
  makeMissionProgress,
  makePortableProgress,
  seededMissions,
} from './helpers/fixtures.ts';
import { integrationTestContext } from './helpers/setup.ts';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim() ?? '';
const OPENAI_ENDPOINT = DEFAULT_OPENAI_ENDPOINT;
const OPENAI_MODEL = DEFAULT_OPENAI_MODEL;

const PROVIDER_REQUEST_TIMEOUT_MS = 120000;
const LIVE_TEST_TIMEOUT_MS = 180000;
const WAIT_TIMEOUT = { timeout: LIVE_TEST_TIMEOUT_MS };

const nativeNodeFetch = globalThis.fetch;

const testContext = integrationTestContext();
const firstMission = seededMissions[0]!;

interface RecordedAiRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

interface LiveApp {
  runtime: IntegrationApp;
  requests: RecordedAiRequest[];
}

function requestHeaderValue(record: RecordedAiRequest, name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(record.headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

function seedOpenAiProvider(): void {
  localStorage.setItem(
    AI_PROVIDER_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      kind: 'openai',
      endpoint: OPENAI_ENDPOINT,
      modelName: OPENAI_MODEL,
      apiKey: OPENAI_API_KEY,
      timeoutMs: PROVIDER_REQUEST_TIMEOUT_MS,
      updatedAt: '2026-08-14T00:00:00.000Z',
    }),
  );
}

function recordOpenAiTraffic(runtime: IntegrationApp, requests: RecordedAiRequest[]): void {
  const interceptor = installApiInterceptor(runtime);
  interceptor.block(
    (url) => url.startsWith(OPENAI_ENDPOINT),
    (url, init) => {
      const headers: Record<string, string> = {};
      if (init?.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] /* nosemgrep: gitlab.eslint.detect-object-injection */ = value;
        });
      } else if (Array.isArray(init?.headers)) {
        for (const [key, value] of init.headers) headers[key] /* nosemgrep: gitlab.eslint.detect-object-injection */ = value;
      } else if (init?.headers !== undefined && typeof init.headers === 'object') {
        for (const [key, value] of Object.entries(init.headers)) headers[key] /* nosemgrep: gitlab.eslint.detect-object-injection */ = String(value);
      }
      requests.push({
        url,
        method: init?.method ?? 'GET',
        headers,
        ...(typeof init?.body === 'string' ? { body: init.body } : {}),
      });
      return nativeNodeFetch(url, init);
    },
  );
}

async function renderLiveApp(options: { progress?: PortableProgressSnapshot } = {}): Promise<LiveApp> {
  seedOpenAiProvider();
  const runtime = await testContext.create({ deferRender: true });
  if (options.progress !== undefined) {
    await importProgress(runtime, options.progress);
  }
  const requests: RecordedAiRequest[] = [];
  recordOpenAiTraffic(runtime, requests);
  testContext.mount(runtime);
  return { runtime, requests };
}

function expectApiKeyNotExposed(runtime: IntegrationApp): void {
  expect(document.body.textContent).not.toContain(OPENAI_API_KEY);
  expect(JSON.stringify(runtime.store.getState())).not.toContain(OPENAI_API_KEY);
}

function expectNoFallbackAiText(): void {
  const bodyText = document.body.textContent ?? '';
  expect(bodyText).not.toContain('Live AI was unavailable');
  expect(bodyText).not.toContain('Sample / mock AI response');
  expect(bodyText).not.toContain('Set up AI');
}

async function openFirstMissionLesson(user: User): Promise<void> {
  await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
  await startJourney(user);
  await screen.findByRole('heading', { level: 1, name: firstMission.title });
}

async function openInlineTutor(user: User): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', { name: 'Ask the tutor' }));
  return screen.findByRole('dialog', { name: 'AI Tutor' });
}

async function openAiOnly(user: User): Promise<void> {
  const shortcuts = await screen.findByRole('navigation', { name: 'More ways to learn' });
  await user.click(within(shortcuts).getByRole('button', { name: 'AI Only Mode' }));
  await screen.findByRole('heading', { level: 1, name: 'AI Only Mode' });
  await screen.findByRole('heading', { level: 2, name: 'Where should we begin?' });
}

function quizReadyProgress(): PortableProgressSnapshot {
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

function lastAiTutorMessage(): HTMLElement {
  const conversation = screen.getByRole('log', { name: 'AI learning conversation' });
  const messages = within(conversation).getAllByRole('article', { name: 'AI tutor message' });
  const last = messages[messages.length - 1] /* nosemgrep: gitlab.eslint.detect-object-injection */;
  if (last === undefined) throw new Error('No AI tutor message was rendered.');
  return last;
}

describe.skipIf(OPENAI_API_KEY.length === 0)('live OpenAI provider integration', () => {
  it('LIVE-AI-01 tests the OpenAI connection using the environment key', async () => {
    const { runtime, requests } = await renderLiveApp();
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await user.click(await screen.findByRole('button', { name: 'Settings' }));
    await screen.findByRole('heading', { level: 2, name: 'AI provider' });
    await user.click(screen.getByRole('button', { name: 'Test connection' }));

    expect(await screen.findByText('Connected', {}, WAIT_TIMEOUT)).toBeDefined();
    expect(await screen.findByText(`Connected to ${OPENAI_MODEL}.`, {}, WAIT_TIMEOUT)).toBeDefined();
    expectNoFallbackAiText();

    const modelRequest = requests.find((request) => request.url.endsWith('/models'));
    expect(modelRequest).toBeDefined();
    expect(modelRequest?.url).toBe(`${OPENAI_ENDPOINT}/models`);
    expect(requestHeaderValue(modelRequest!, 'authorization')).toBe(`Bearer ${OPENAI_API_KEY}`);
    expectApiKeyNotExposed(runtime);
  }, LIVE_TEST_TIMEOUT_MS);

  it('LIVE-AI-02 sends an inline tutor question and renders a live streamed reply', async () => {
    const { runtime, requests } = await renderLiveApp();
    const user = userEvent.setup();

    await openFirstMissionLesson(user);
    const dialog = await openInlineTutor(user);
    await user.type(within(dialog).getByLabelText('Ask the tutor'), 'Explain narrow AI{Enter}');

    expect(within(dialog).getByText('Explain narrow AI')).toBeDefined();
    await waitFor(() => {
      expect(within(dialog).getByRole('button', { name: 'Stop' })).toBeDefined();
    }, WAIT_TIMEOUT);
    await waitFor(() => {
      expect(within(dialog).queryByRole('button', { name: 'Stop' })).toBeNull();
    }, WAIT_TIMEOUT);

    const assistant = dialog.querySelector('.ai-message--assistant');
    if (assistant === null || !(assistant instanceof HTMLElement)) {
      throw new Error('No assistant message was rendered in the tutor dialog.');
    }
    const text = assistant.querySelector('.ai-message__text');
    expect((text?.textContent ?? '').trim().length).toBeGreaterThan(0);
    expect(text?.textContent).not.toBe('Thinking…');
    expectNoFallbackAiText();

    const completion = requests.find((request) => request.url.endsWith('/chat/completions'));
    expect(completion).toBeDefined();
    expect(completion?.body).toContain(OPENAI_MODEL);
    expect(requestHeaderValue(completion!, 'authorization')).toContain(`Bearer ${OPENAI_API_KEY}`);
    expectApiKeyNotExposed(runtime);
  }, LIVE_TEST_TIMEOUT_MS);

  it('LIVE-AI-03 generates a live mission summary grounded in the selected mission', async () => {
    const { runtime, requests } = await renderLiveApp();
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await openAiOnly(user);
    await user.click(quickAction('Summarize a mission'));
    const dialog = await screen.findByRole('dialog', { name: 'Choose a mission to summarize' });
    await user.click(within(dialog).getByRole('button', { name: 'Create summary' }));

    const summaryMessage = await waitFor(() => {
      const message = lastAiTutorMessage();
      if (message.querySelector('.ai-structured-card') === null) {
        throw new Error('The structured summary card is not rendered yet.');
      }
      return message;
    }, WAIT_TIMEOUT);
    const card = summaryMessage.querySelector('.ai-structured-card') as HTMLElement;
    expect(within(card).getByRole('heading', { level: 3, name: 'Key takeaways' })).toBeDefined();
    expect(within(card).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
    expectNoFallbackAiText();
    expect(within(summaryMessage).getByLabelText('Sources')).toBeDefined();
    expect(
      within(summaryMessage).getByRole('button', { name: new RegExp(escapeRegExp(firstMission.title)) /* nosemgrep: gitlab.eslint.detect-non-literal-regexp, javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp */ }),
    ).toBeDefined();

    expect(requests.some((request) => request.url.endsWith('/chat/completions'))).toBe(true);
    expectApiKeyNotExposed(runtime);
  }, LIVE_TEST_TIMEOUT_MS);

  it('LIVE-AI-04 requests a live quiz hint that never reveals a correct option', async () => {
    const { runtime, requests } = await renderLiveApp({ progress: quizReadyProgress() });
    const user = userEvent.setup();
    const mission = await getMission(runtime, firstMission.id);

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await continueJourney(user);
    await screen.findByRole('heading', { level: 1, name: firstMission.title });
    await openCurrentMissionQuiz(user);
    const question = currentQuizQuestion(mission);
    await user.click(screen.getByRole('button', { name: 'Get a hint' }));

    const hint = await screen.findByRole('region', { name: 'Hint 1 of 3' }, WAIT_TIMEOUT);
    for (const correctOption of question.options.filter((option) => option.isCorrect)) {
      expect(hint.textContent).not.toContain(correctOption.text);
    }
    expectNoFallbackAiText();

    expect(requests.some((request) => request.url.endsWith('/chat/completions'))).toBe(true);
    expectApiKeyNotExposed(runtime);
  }, LIVE_TEST_TIMEOUT_MS);

  it('LIVE-AI-05 answers an AI Only question live with the mission scope and sources', async () => {
    const { runtime, requests } = await renderLiveApp();
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await openAiOnly(user);
    await user.selectOptions(screen.getByLabelText('Learning scope'), `mission:${firstMission.id}`);
    await screen.findByRole('heading', { level: 2, name: new RegExp(escapeRegExp(firstMission.title)) /* nosemgrep: gitlab.eslint.detect-non-literal-regexp, javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp */ });
    await user.type(screen.getByLabelText(`Ask about ${firstMission.title}`), 'Explain this mission{Enter}');

    expect(screen.getByText('Explain this mission')).toBeDefined();
    const assistant = await waitFor(() => {
      const message = lastAiTutorMessage();
      if (
        within(message).queryByText('Thinking…') !== null ||
        within(message).queryByLabelText('Sources') === null
      ) {
        throw new Error('The live response is still pending.');
      }
      return message;
    }, WAIT_TIMEOUT);
    expectNoFallbackAiText();
    const text = assistant.querySelector('.ai-message__text');
    expect((text?.textContent ?? '').trim().length).toBeGreaterThan(0);
    expect(within(assistant).getByLabelText('Sources')).toBeDefined();
    expect(
      within(assistant).getByRole('button', { name: new RegExp(escapeRegExp(firstMission.title)) /* nosemgrep: gitlab.eslint.detect-non-literal-regexp, javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp */ }),
    ).toBeDefined();
    expect((screen.getByLabelText('Learning scope') as HTMLSelectElement).value).toBe(
      `mission:${firstMission.id}`,
    );

    expect(requests.some((request) => request.url.endsWith('/chat/completions'))).toBe(true);
    expectApiKeyNotExposed(runtime);
  }, LIVE_TEST_TIMEOUT_MS);

  it('LIVE-AI-06 reviews a written answer and renders live structured feedback', async () => {
    const { runtime, requests } = await renderLiveApp();
    const user = userEvent.setup();

    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    await openAiOnly(user);
    await user.click(quickAction('Review my answer'));
    const dialog = await screen.findByRole('dialog', { name: 'Share an answer for coaching' });
    await user.type(
      within(dialog).getByLabelText('Your answer or reasoning'),
      'AI performs bounded tasks and people still need to review important output.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Get feedback' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Share an answer for coaching' })).toBeNull();
    }, WAIT_TIMEOUT);
    expect(await screen.findByText('What you got right', {}, WAIT_TIMEOUT)).toBeDefined();
    expect(screen.getByText("What's missing")).toBeDefined();
    expect(screen.getByText('One improvement')).toBeDefined();
    expect(screen.getByText('Encouragement')).toBeDefined();
    expectNoFallbackAiText();

    expect(requests.some((request) => request.url.endsWith('/chat/completions'))).toBe(true);
    expectApiKeyNotExposed(runtime);
  }, LIVE_TEST_TIMEOUT_MS);
});
