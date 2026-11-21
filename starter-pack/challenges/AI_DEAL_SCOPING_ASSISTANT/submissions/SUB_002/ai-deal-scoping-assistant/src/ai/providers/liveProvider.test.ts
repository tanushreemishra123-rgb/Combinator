import { fixtureConfig, fixtureCustomer, fixtureScope } from '../../test/fixtures';
import type { AiProviderError, AiRequest, ImpactContext, PrdContext } from '../types';
import { createLiveProvider, LIVE_PROVIDER_OPTIONS, type LiveProviderId } from './liveProvider';

const CONTEXT: ImpactContext = {
  task: 'explain-change-impact',
  change: { kind: 'cloud-platform', targetId: 'T', label: 'Test change', from: 'aws', to: 'azure' },
  affected: [],
  unaffected: [],
};

const STRUCTURED_CONTEXT: PrdContext = { task: 'generate-prd', scope: fixtureScope(), customer: fixtureCustomer(), config: fixtureConfig() };
const REQUEST: AiRequest = { system: 'system prompt', prompt: 'user prompt', context: CONTEXT };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function completionBody(content: string): unknown {
  return { choices: [{ message: { content } }] };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LIVE_PROVIDER_OPTIONS', () => {
  it('lists exactly the three free-tier providers with the required fields', () => {
    const ids = LIVE_PROVIDER_OPTIONS.map((option) => option.id).sort();
    expect(ids).toEqual(['gemini', 'groq', 'openrouter']);
    for (const option of LIVE_PROVIDER_OPTIONS) {
      expect(option.defaultModel.length).toBeGreaterThan(0);
      expect(option.models).toContain(option.defaultModel);
      expect(option.keyHelpUrl).toMatch(/^https:\/\//);
      expect(option.freeTierNote.length).toBeGreaterThan(0);
    }
  });
});

describe('createLiveProvider - request shape', () => {
  it('sends exactly one POST request to the endpoint for the configured provider, with the model, key and prompts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, completionBody('ok')));
    vi.stubGlobal('fetch', fetchMock);

    const provider = createLiveProvider({ mode: 'live', providerId: 'groq', model: 'llama-3.3-70b-versatile', apiKey: 'test-key' });
    await provider.complete(REQUEST);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls.at(0) as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body as string) as { model: string; messages: { role: string; content: string }[] };
    expect(body.model).toBe('llama-3.3-70b-versatile');
    expect(body.messages).toEqual([
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ]);
  });

  it('selects the correct endpoint for each provider id', async () => {
    const endpoints: Record<LiveProviderId, string> = {
      gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      groq: 'https://api.groq.com/openai/v1/chat/completions',
      openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    };
    for (const [providerId, endpoint] of Object.entries(endpoints) as [LiveProviderId, string][]) {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, completionBody('ok')));
      vi.stubGlobal('fetch', fetchMock);
      const provider = createLiveProvider({ mode: 'live', providerId, model: 'any-model', apiKey: 'test-key' });
      await provider.complete(REQUEST);
      const [url] = fetchMock.mock.calls.at(0) as [string, RequestInit];
      expect(url).toBe(endpoint);
    }
  });

  it('requests JSON mode for a structured task but not for a free-text task', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, completionBody('ok'))));
    vi.stubGlobal('fetch', fetchMock);
    const provider = createLiveProvider({ mode: 'live', providerId: 'groq', model: 'm', apiKey: 'test-key' });

    await provider.complete({ ...REQUEST, context: STRUCTURED_CONTEXT });
    const [, structuredInit] = fetchMock.mock.calls.at(0) as [string, RequestInit];
    const structuredBody = JSON.parse(structuredInit.body as string) as Record<string, unknown>;
    expect(structuredBody.response_format).toEqual({ type: 'json_object' });

    await provider.complete(REQUEST);
    const [, textInit] = fetchMock.mock.calls.at(1) as [string, RequestInit];
    const textBody = JSON.parse(textInit.body as string) as Record<string, unknown>;
    expect(textBody.response_format).toBeUndefined();
  });

  it('returns the completion content on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, completionBody('{"ok":true}')));
    vi.stubGlobal('fetch', fetchMock);
    const provider = createLiveProvider({ mode: 'live', providerId: 'groq', model: 'm', apiKey: 'test-key' });
    await expect(provider.complete(REQUEST)).resolves.toBe('{"ok":true}');
  });
});

describe('createLiveProvider - error mapping', () => {
  async function expectErrorKind(fetchImpl: () => Promise<Response> | never, kind: AiProviderError['kind']): Promise<void> {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(fetchImpl));
    const provider = createLiveProvider({ mode: 'live', providerId: 'groq', model: 'm', apiKey: 'test-key' });
    await expect(provider.complete(REQUEST)).rejects.toMatchObject({ kind });
  }

  it('maps HTTP 401 to auth', async () => {
    await expectErrorKind(() => Promise.resolve(jsonResponse(401, { error: 'unauthorized' })), 'auth');
  });

  it('maps HTTP 403 to auth', async () => {
    await expectErrorKind(() => Promise.resolve(jsonResponse(403, { error: 'forbidden' })), 'auth');
  });

  it('maps HTTP 429 to rate-limit', async () => {
    await expectErrorKind(() => Promise.resolve(jsonResponse(429, { error: 'slow down' })), 'rate-limit');
  });

  it('maps HTTP 500+ to provider', async () => {
    await expectErrorKind(() => Promise.resolve(jsonResponse(503, { error: 'unavailable' })), 'provider');
  });

  it('maps a thrown TypeError to network', async () => {
    await expectErrorKind(() => Promise.reject(new TypeError('Failed to fetch')), 'network');
  });

  it('maps an AbortError to timeout', async () => {
    await expectErrorKind(() => Promise.reject(new DOMException('The operation was aborted.', 'AbortError')), 'timeout');
  });

  it('maps a response with no choices to invalid-response', async () => {
    await expectErrorKind(() => Promise.resolve(jsonResponse(200, { choices: [] })), 'invalid-response');
  });

  it('maps a response missing the expected shape entirely to invalid-response', async () => {
    await expectErrorKind(() => Promise.resolve(jsonResponse(200, { unexpected: true })), 'invalid-response');
  });
});
