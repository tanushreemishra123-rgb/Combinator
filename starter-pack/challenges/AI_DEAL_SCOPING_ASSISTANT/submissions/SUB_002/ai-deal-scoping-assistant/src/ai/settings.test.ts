import { LIVE_PROVIDER_OPTIONS } from './providers/liveProvider';
import { defaultAiSettings, describeAiMode, loadAiSettings, resolveRunOptions, saveAiSettings, testLiveConnection, type AiSettings } from './settings';

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('defaultAiSettings', () => {
  it('defaults to mock mode with no API key', () => {
    const settings = defaultAiSettings();
    expect(settings.mode).toBe('mock');
    expect(settings.apiKey).toBe('');
  });

  it('picks a real listed provider and its default model', () => {
    const settings = defaultAiSettings();
    const option = LIVE_PROVIDER_OPTIONS.find((candidate) => candidate.id === settings.providerId);
    expect(option).toBeDefined();
    expect(settings.model).toBe(option?.defaultModel);
  });
});

describe('saveAiSettings / loadAiSettings', () => {
  it('round-trips settings through sessionStorage', () => {
    const settings: AiSettings = { mode: 'live', providerId: 'groq', model: 'llama-3.3-70b-versatile', apiKey: 'test-key' };
    saveAiSettings(settings);
    expect(loadAiSettings()).toEqual(settings);
  });

  it('never writes to localStorage', () => {
    saveAiSettings({ mode: 'live', providerId: 'groq', model: 'm', apiKey: 'test-key' });
    expect(localStorage.getItem('ai-deal-scoping-assistant:ai-settings')).toBeNull();
  });

  it('returns the default settings when nothing is stored', () => {
    expect(loadAiSettings()).toEqual(defaultAiSettings());
  });

  it('returns the default settings when the stored value fails schema validation', () => {
    sessionStorage.setItem('ai-deal-scoping-assistant:ai-settings', JSON.stringify({ mode: 'not-a-mode' }));
    expect(loadAiSettings()).toEqual(defaultAiSettings());
  });

  it('returns the default settings when the stored value is not valid JSON', () => {
    sessionStorage.setItem('ai-deal-scoping-assistant:ai-settings', '{not json');
    expect(loadAiSettings()).toEqual(defaultAiSettings());
  });

  it('does not throw when sessionStorage access itself throws', () => {
    const throwingStorage: Storage = {
      length: 0,
      clear: () => undefined,
      key: () => null,
      getItem: () => {
        throw new Error('sessionStorage disabled');
      },
      setItem: () => {
        throw new Error('sessionStorage disabled');
      },
      removeItem: () => undefined,
    };
    vi.stubGlobal('sessionStorage', throwingStorage);
    expect(() => loadAiSettings()).not.toThrow();
    expect(loadAiSettings()).toEqual(defaultAiSettings());
    expect(() => saveAiSettings(defaultAiSettings())).not.toThrow();
  });
});

describe('resolveRunOptions', () => {
  it('mock mode: uses a mock provider and no fallback', () => {
    const options = resolveRunOptions({ mode: 'mock', providerId: 'groq', model: 'm', apiKey: '' }, 4);
    expect(options.provider.mode).toBe('mock');
    expect(options.fallback).toBeNull();
    expect(options.scopeVersion).toBe(4);
  });

  it('live mode: uses a live provider with a mock fallback', () => {
    const options = resolveRunOptions({ mode: 'live', providerId: 'groq', model: 'llama-3.3-70b-versatile', apiKey: 'test-key' }, 2);
    expect(options.provider.mode).toBe('live');
    expect(options.fallback?.mode).toBe('mock');
  });
});

describe('describeAiMode', () => {
  it('describes mock mode plainly', () => {
    expect(describeAiMode({ mode: 'mock', providerId: 'groq', model: 'm', apiKey: '' })).toBe('Mock AI mode');
  });

  it('describes live mode with the provider label and model id', () => {
    const description = describeAiMode({ mode: 'live', providerId: 'groq', model: 'llama-3.3-70b-versatile', apiKey: 'test-key' });
    expect(description).toContain('Groq');
    expect(description).toContain('llama-3.3-70b-versatile');
  });
});

describe('testLiveConnection', () => {
  it('reports a friendly message when the mode is not live', async () => {
    const result = await testLiveConnection({ mode: 'mock', providerId: 'groq', model: 'm', apiKey: '' });
    expect(result.ok).toBe(false);
    expect(result.message.toLowerCase()).toContain('live');
  });

  it('reports a friendly message when the API key is missing', async () => {
    const result = await testLiveConnection({ mode: 'live', providerId: 'groq', model: 'm', apiKey: '  ' });
    expect(result.ok).toBe(false);
    expect(result.message.toLowerCase()).toContain('api key');
  });

  it('reports success when the provider responds normally', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 })),
    );
    const result = await testLiveConnection({ mode: 'live', providerId: 'groq', model: 'm', apiKey: 'test-key' });
    expect(result.ok).toBe(true);
    expect(result.message).toContain('Groq');
  });

  it('reports a friendly, kind-specific message on an auth failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'nope' }), { status: 401 })));
    const result = await testLiveConnection({ mode: 'live', providerId: 'groq', model: 'm', apiKey: 'test-key' });
    expect(result.ok).toBe(false);
    expect(result.message.toLowerCase()).toContain('api key');
  });
});
