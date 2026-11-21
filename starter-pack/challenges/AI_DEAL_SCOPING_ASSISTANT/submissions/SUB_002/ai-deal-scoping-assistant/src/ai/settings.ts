/**
 * AI mode settings: mock (default, no key/network) or live (a free-tier hosted provider). Settings
 * live in `sessionStorage` only - never `localStorage`, never bundled with an exported session.
 */
import { z } from 'zod';
import { createLiveProvider, LIVE_PROVIDER_OPTIONS, type LiveProviderId } from './providers/liveProvider';
import { createMockProvider } from './providers/mockProvider';
import type { AiErrorKind, TaskRunOptions } from './types';
import { AiProviderError } from './types';
import type { ImpactContext } from './types';

export interface AiSettings {
  mode: 'mock' | 'live';
  providerId: LiveProviderId;
  model: string;
  /** Held in memory / sessionStorage only. Never persisted with the session or exported. */
  apiKey: string;
}

const SESSION_STORAGE_KEY = 'ai-deal-scoping-assistant:ai-settings';

const AiSettingsSchema = z.object({
  mode: z.enum(['mock', 'live']),
  providerId: z.enum(['gemini', 'groq', 'openrouter']),
  model: z.string().min(1),
  apiKey: z.string(),
});

/** Mock mode, the first listed provider's default model, and no key - runnable with zero setup. */
export function defaultAiSettings(): AiSettings {
  const provider = LIVE_PROVIDER_OPTIONS.at(0);
  return { mode: 'mock', providerId: provider?.id ?? 'groq', model: provider?.defaultModel ?? '', apiKey: '' };
}

export function loadAiSettings(): AiSettings {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) {
      return defaultAiSettings();
    }
    const parsed = AiSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : defaultAiSettings();
  } catch {
    return defaultAiSettings();
  }
}

export function saveAiSettings(settings: AiSettings): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // sessionStorage may be unavailable (private browsing, quota) - settings simply do not persist.
  }
}

/** Mock mode has no fallback (there is nothing to fall back from); live mode falls back to mock. */
export function resolveRunOptions(settings: AiSettings, scopeVersion: number): TaskRunOptions {
  if (settings.mode === 'mock') {
    return { provider: createMockProvider(), fallback: null, scopeVersion };
  }
  return { provider: createLiveProvider(settings), fallback: createMockProvider(), scopeVersion };
}

export function describeAiMode(settings: AiSettings): string {
  if (settings.mode === 'mock') {
    return 'Mock AI mode';
  }
  const option = LIVE_PROVIDER_OPTIONS.find((candidate) => candidate.id === settings.providerId);
  return `Live AI - ${option?.label ?? settings.providerId} (${settings.model})`;
}

const CONNECTION_ERROR_MESSAGES: ReadonlyMap<AiErrorKind, string> = new Map([
  ['auth', 'The API key was rejected. Check that you copied it correctly and that it is active.'],
  ['rate-limit', 'The provider rate-limited this request. Wait a moment and try again.'],
  ['network', 'A network error prevented reaching the provider. Check your internet connection.'],
  ['timeout', 'The provider did not respond in time. Try again, or choose a different model.'],
  ['invalid-response', 'The provider responded, but not in the expected format. Try a different model.'],
  ['provider', 'The provider reported a server error. Try again shortly.'],
]);

function describeConnectionError(error: unknown): string {
  if (error instanceof AiProviderError) {
    return CONNECTION_ERROR_MESSAGES.get(error.kind) ?? error.message;
  }
  return 'Could not reach the AI provider. Check your connection and try again.';
}

/** A minimal, self-contained context - only `system`/`prompt`/`context.task` matter for a live call. */
const CONNECTION_TEST_CONTEXT: ImpactContext = {
  task: 'explain-change-impact',
  change: { kind: 'cloud-platform', targetId: 'connection-test', label: 'Connection test', from: '', to: '' },
  affected: [],
  unaffected: [],
};

/** Sends a tiny prompt through the configured live provider and reports the outcome in plain language. */
export async function testLiveConnection(settings: AiSettings): Promise<{ ok: boolean; message: string }> {
  if (settings.mode !== 'live') {
    return { ok: false, message: 'Switch to Live AI mode before testing the connection.' };
  }
  if (settings.apiKey.trim().length === 0) {
    return { ok: false, message: 'Enter an API key before testing the connection.' };
  }
  try {
    const provider = createLiveProvider(settings);
    await provider.complete({
      system: 'You are a connectivity check for an API integration test.',
      prompt: 'Reply with the single word: ok',
      context: CONNECTION_TEST_CONTEXT,
    });
    return { ok: true, message: `Connected to ${describeAiMode(settings)}.` };
  } catch (error) {
    return { ok: false, message: describeConnectionError(error) };
  }
}
