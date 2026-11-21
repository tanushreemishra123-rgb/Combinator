import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MissionDetail } from '@ai-learning-adventure/types';
import { AI_PROVIDER_STORAGE_KEY } from '../features/ai-provider/aiProviderStorage.ts';
import { makeMissionDetail, makeSnapshot, seedCatalog } from './fixtures.ts';
import { renderApp } from './harness.tsx';

const catalog = seedCatalog();

function missionDetails(): Record<string, MissionDetail> {
  return Object.fromEntries(
    catalog.missions.map((mission) => [
      mission.id,
      makeMissionDetail({ id: mission.id, title: mission.title }),
    ]),
  );
}

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Settings' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeDefined();
  expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'AI provider' }));
}

describe('provider settings and availability', () => {
  it('shows setup guidance, opens focused settings, and dismisses only the global banner', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot());

    expect(await screen.findByText(/AI is not configured/)).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Set up AI' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeDefined();
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 2, name: 'AI provider' }));

    await user.click(screen.getByRole('button', { name: 'Back' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/AI is not configured/)).toBeNull();
  });

  it('keeps the dismissed banner hidden across reloads in the same browser session', async () => {
    const user = userEvent.setup();
    const first = renderApp(catalog, makeSnapshot());
    await user.click(await screen.findByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/AI is not configured/)).toBeNull();
    first.unmount();

    renderApp(catalog, makeSnapshot());
    await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ });
    expect(screen.queryByText(/AI is not configured/)).toBeNull();
  });

  it('saves an API key without putting the raw credential in Redux or the rendered page', async () => {
    const user = userEvent.setup();
    const { store } = renderApp(catalog, makeSnapshot());
    await openSettings(user);

    await user.type(screen.getByLabelText('API key'), 'secret-value-1234');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    const stored = localStorage.getItem(AI_PROVIDER_STORAGE_KEY) ?? '';
    expect(stored).toContain('secret-value-1234');
    expect(JSON.stringify(store.getState())).not.toContain('secret-value-1234');
    expect(document.body.textContent).not.toContain('secret-value-1234');
    expect(screen.getByRole('button', { name: 'Clear key ending in 1234' })).toBeDefined();
    expect(screen.getByText('Not tested')).toBeDefined();
  });

  it('restores a saved key as masked metadata and clears it into fallback mode', async () => {
    const user = userEvent.setup();
    const first = renderApp(catalog, makeSnapshot());
    await openSettings(user);
    await user.type(screen.getByLabelText('API key'), 'reload-secret-5678');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    first.unmount();

    renderApp(catalog, makeSnapshot());
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    expect((screen.getByLabelText('API key') as HTMLInputElement).value).toBe('');
    await user.click(screen.getByRole('button', { name: 'Clear key ending in 5678' }));
    expect(await screen.findByText('Not configured')).toBeDefined();
    expect(localStorage.getItem(AI_PROVIDER_STORAGE_KEY)).not.toContain('reload-secret-5678');
    expect(screen.getAllByText(/API key cleared/).length).toBeGreaterThan(0);
  });

  it('supports mock-only mode without making AI network requests', async () => {
    const user = userEvent.setup();
    const { fetchMock } = renderApp(catalog, makeSnapshot(), { missionDetails: missionDetails() });
    await openSettings(user);
    await user.selectOptions(screen.getByLabelText('Provider'), 'mock');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(screen.getByText('Mock mode')).toBeDefined();
    const callsBeforeAi = fetchMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Back' }));
    const shortcuts = await screen.findByRole('navigation', { name: 'More ways to learn' });
    await user.click(within(shortcuts).getByRole('button', { name: 'AI Only Mode' }));
    await screen.findByRole('heading', { level: 2, name: 'Where should we begin?' });
    await user.type(screen.getByLabelText('Ask about the mission collection'), 'Explain AI{Enter}');

    expect(await screen.findByText(/This sample tutor response is scoped to/)).toBeDefined();
    expect(screen.getByText('Sample / mock AI response')).toBeDefined();
    expect(screen.getByText('Configure AI for personalized answers.')).toBeDefined();
    const aiCalls = fetchMock.mock.calls.slice(callsBeforeAi).filter((call) => String(call[0]).includes('/chat/completions'));
    expect(aiCalls).toHaveLength(0);
  });

  it('tests an API connection and removes setup notices immediately', async () => {
    const user = userEvent.setup();
    const { fetchMock } = renderApp(catalog, makeSnapshot());
    await openSettings(user);
    await user.type(screen.getByLabelText('API key'), 'live-key-9999');
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ data: catalog }), { status: 200 }));
    await user.click(screen.getByRole('button', { name: 'Test connection' }));

    expect(await screen.findByText('Connected')).toBeDefined();
    expect(screen.queryByText(/AI is not configured/)).toBeNull();
    const modelCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith('/models'));
    expect(modelCall).toBeDefined();
    expect((modelCall?.[1]?.headers as Record<string, string>).Authorization).toBe('Bearer live-key-9999');
  });

  it('falls back after a live provider failure and shows both the error and sample label', async () => {
    localStorage.setItem(AI_PROVIDER_STORAGE_KEY, JSON.stringify({
      version: 1,
      kind: 'openai',
      endpoint: 'https://provider.example/v1',
      modelName: 'model-a',
      apiKey: 'invalid-key',
      updatedAt: '2026-08-13T00:00:00.000Z',
    }));
    const user = userEvent.setup();
    const rendered = renderApp(catalog, makeSnapshot(), { missionDetails: missionDetails() });
    const apiFetch = rendered.fetchMock;
    const apiImplementation = apiFetch.getMockImplementation();
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input).includes('provider.example')) return new Response('unauthorized', { status: 401 });
      if (apiImplementation === undefined) throw new Error('Learner API mock is unavailable.');
      return apiImplementation(input, init);
    });

    const shortcuts = await screen.findByRole('navigation', { name: 'More ways to learn' });
    await user.click(within(shortcuts).getByRole('button', { name: 'AI Only Mode' }));
    await screen.findByRole('heading', { level: 2, name: 'Where should we begin?' });
    await user.type(screen.getByLabelText('Ask about the mission collection'), 'Explain AI{Enter}');

    expect(await screen.findByText('Live AI was unavailable.')).toBeDefined();
    expect(screen.getByText('The provider rejected this API key.')).toBeDefined();
    expect(screen.getByText('Sample / mock AI response')).toBeDefined();
    expect(screen.getByText(/AI connection failed/)).toBeDefined();
    expect(document.body.textContent).not.toContain('invalid-key');
  });

  it('validates local settings and hides key controls', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot());
    await openSettings(user);
    await user.selectOptions(screen.getByLabelText('Provider'), 'local');
    expect(screen.queryByLabelText('API key')).toBeNull();
    expect((screen.getByLabelText('API endpoint') as HTMLInputElement).value).toBe('http://localhost:11434/v1');
    await user.clear(screen.getByLabelText('Model name'));
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText('Enter a model name.')).toBeDefined();
    expect((screen.getByLabelText('Model name') as HTMLInputElement).getAttribute('aria-invalid')).toBe('true');
  });

  it('fills OpenAI defaults and requires a key before saving', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot());
    await openSettings(user);
    await user.selectOptions(screen.getByLabelText('Provider'), 'openai');
    expect((screen.getByLabelText('API endpoint') as HTMLInputElement).value).toBe('https://api.openai.com/v1');
    expect((screen.getByLabelText('Model name') as HTMLInputElement).value).toBe('gpt-5.6-luna');
    expect(screen.getByLabelText('API key')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText('Enter an API key for this provider.')).toBeDefined();
  });

  it('fills Ollama cloud defaults and requires a key before saving', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot());
    await openSettings(user);
    await user.selectOptions(screen.getByLabelText('Provider'), 'ollama');
    expect((screen.getByLabelText('API endpoint') as HTMLInputElement).value).toBe('https://ollama.com/v1');
    expect((screen.getByLabelText('Model name') as HTMLInputElement).value).toBe('gpt-oss:20b');
    expect(screen.getByLabelText('API key')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText('Enter an API key for this provider.')).toBeDefined();
  });

  it('saves an OpenAI key locally and keeps it out of Redux and the rendered page', async () => {
    const user = userEvent.setup();
    const { store } = renderApp(catalog, makeSnapshot());
    await openSettings(user);
    await user.selectOptions(screen.getByLabelText('Provider'), 'openai');
    await user.type(screen.getByLabelText('API key'), 'sk-openai-4321');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    const stored = localStorage.getItem(AI_PROVIDER_STORAGE_KEY) ?? '';
    expect(stored).toContain('sk-openai-4321');
    expect(stored).toContain('"kind":"openai"');
    expect(JSON.stringify(store.getState())).not.toContain('sk-openai-4321');
    expect(document.body.textContent).not.toContain('sk-openai-4321');
    expect(screen.getByRole('button', { name: 'Clear key ending in 4321' })).toBeDefined();
  });

  it('tests an OpenAI connection using the bearer key', async () => {
    const user = userEvent.setup();
    const { fetchMock } = renderApp(catalog, makeSnapshot());
    await openSettings(user);
    await user.selectOptions(screen.getByLabelText('Provider'), 'openai');
    await user.type(screen.getByLabelText('API key'), 'sk-live-8765');
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ data: catalog }), { status: 200 }));
    await user.click(screen.getByRole('button', { name: 'Test connection' }));

    expect(await screen.findByText('Connected')).toBeDefined();
    const modelCall = fetchMock.mock.calls.find((call) => String(call[0]).endsWith('/models'));
    expect(modelCall).toBeDefined();
    expect(String(modelCall?.[0])).toBe('https://api.openai.com/v1/models');
    expect((modelCall?.[1]?.headers as Record<string, string>).Authorization).toBe('Bearer sk-live-8765');
  });

  it('recovers from corrupt provider storage as unconfigured fallback', async () => {
    localStorage.setItem(AI_PROVIDER_STORAGE_KEY, '{not-json');
    renderApp(catalog, makeSnapshot());
    expect(await screen.findByText(/AI is not configured/)).toBeDefined();
    const banner = (await screen.findByText(/AI is not configured/)).closest('[role="status"]') as HTMLElement;
    expect(within(banner).getByRole('button', { name: 'Set up AI' })).toBeDefined();
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });

  it('shows the Settings button only on the landing page', async () => {
    const user = userEvent.setup();
    renderApp(catalog, makeSnapshot());

    // On Landing page: Settings button is present in the header
    expect(await screen.findByRole('button', { name: 'Settings' })).toBeDefined();

    // Navigate to Missions browser page
    await user.click(screen.getAllByRole('button', { name: 'Explore missions' })[0]!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Mission map' })).toBeDefined();

    // On Missions page: Settings button should not be present in the header
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();

    // Navigate back to Home
    await user.click(screen.getByRole('button', { name: 'Home' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Learn AI fundamentals/ })).toBeDefined();

    // On Landing page again: Settings button is visible
    expect(screen.getByRole('button', { name: 'Settings' })).toBeDefined();
  });
});
