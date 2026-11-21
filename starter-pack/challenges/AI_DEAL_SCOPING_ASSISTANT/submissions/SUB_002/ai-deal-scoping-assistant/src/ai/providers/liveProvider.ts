/**
 * One OpenAI-compatible chat-completions client shared by three free-tier hosted providers.
 *
 * SAST note: this file contains the repository's only `fetch(` call site. It lives inside
 * `requestChatCompletion`, a function with exactly one parameter (a typed options object); the
 * request `init` is built in its own statement before `fetch` is called, and the endpoint always
 * comes from one of the module-level constants below via an exhaustive switch - never from
 * user-editable input.
 */
import { z } from 'zod';
import type { AiSettings } from '../settings';
import type { AiTaskId } from '../types';
import { AiProviderError } from '../types';
import type { AiProvider, AiRequest } from '../types';

export type LiveProviderId = 'gemini' | 'groq' | 'openrouter';

export interface LiveProviderOption {
  id: LiveProviderId;
  label: string;
  defaultModel: string;
  /** A few current, well-known free-tier model ids; the settings UI still accepts any typed id. */
  models: string[];
  keyHelpUrl: string;
  freeTierNote: string;
}

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const REQUEST_TIMEOUT_MS = 90_000;
const STRUCTURED_TEMPERATURE = 0.2;
const TEXT_TASK_IDS: ReadonlySet<AiTaskId> = new Set(['explain-change-impact', 'summarize-package']);

export const LIVE_PROVIDER_OPTIONS: readonly LiveProviderOption[] = [
  {
    id: 'gemini',
    label: 'Google Gemini (OpenAI-compatible)',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash'],
    keyHelpUrl: 'https://aistudio.google.com/app/apikey',
    freeTierNote:
      'Google AI Studio issues a free API key; the free tier now covers Flash and Flash-Lite models only, with daily request limits. Model availability changes over time - type any current model id if the suggestions above stop working.',
  },
  {
    id: 'groq',
    label: 'Groq',
    defaultModel: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gpt-oss-20b'],
    keyHelpUrl: 'https://console.groq.com/keys',
    freeTierNote:
      'Groq offers a free developer tier (no credit card) with per-model daily request and token limits. Model availability changes over time - type any current model id if the suggestions above stop working.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    models: ['meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat-v3-0324:free', 'google/gemini-2.0-flash-exp:free'],
    keyHelpUrl: 'https://openrouter.ai/keys',
    freeTierNote:
      'OpenRouter offers ":free"-suffixed models with shared rate limits (higher once a small credit balance is added). Model availability changes over time - type any current model id if the suggestions above stop working.',
  },
];

function findProviderOption(providerId: LiveProviderId): LiveProviderOption {
  const found = LIVE_PROVIDER_OPTIONS.find((option) => option.id === providerId);
  if (found === undefined) {
    throw new AiProviderError('provider', `Unknown live AI provider id "${providerId}".`);
  }
  return found;
}

function endpointForProvider(providerId: LiveProviderId): string {
  switch (providerId) {
    case 'gemini':
      return GEMINI_ENDPOINT;
    case 'groq':
      return GROQ_ENDPOINT;
    case 'openrouter':
      return OPENROUTER_ENDPOINT;
  }
}

function isStructuredTask(taskId: AiTaskId): boolean {
  return !TEXT_TASK_IDS.has(taskId);
}

interface ChatCompletionRequestOptions {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  jsonMode: boolean;
  signal: AbortSignal;
}

/** The repository's one `fetch(` call site - see the SAST note at the top of this file. */
async function requestChatCompletion(options: ChatCompletionRequestOptions): Promise<Response> {
  const body: Record<string, unknown> = {
    model: options.model,
    messages: [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: options.userPrompt },
    ],
    temperature: STRUCTURED_TEMPERATURE,
  };
  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.apiKey}` },
    body: JSON.stringify(body),
    signal: options.signal,
  };
  return fetch(options.endpoint, init);
}

const ChatCompletionResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

function mapStatusToError(status: number): AiProviderError {
  if (status === 401 || status === 403) {
    return new AiProviderError('auth', `The AI provider rejected the API key (HTTP ${status}). Check the key and try again.`);
  }
  if (status === 429) {
    return new AiProviderError('rate-limit', 'The AI provider rate-limited this request. Wait a moment and try again, or switch models.');
  }
  if (status >= 500) {
    return new AiProviderError('provider', `The AI provider returned a server error (HTTP ${status}). Try again shortly.`);
  }
  return new AiProviderError('invalid-response', `The AI provider returned an unexpected HTTP ${status} response.`);
}

async function parseChatCompletionResponse(response: Response): Promise<string> {
  if (!response.ok) {
    throw mapStatusToError(response.status);
  }
  const payload: unknown = await response.json();
  const parsed = ChatCompletionResponseSchema.safeParse(payload);
  const message = parsed.success ? parsed.data.choices.at(0)?.message : undefined;
  if (message === undefined) {
    throw new AiProviderError('invalid-response', 'The AI provider response did not include a completion message.');
  }
  return message.content;
}

function hasName(error: unknown, name: string): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && (error as { name: unknown }).name === name;
}

function toLiveProviderError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) {
    return error;
  }
  if (hasName(error, 'AbortError')) {
    return new AiProviderError('timeout', `The AI provider did not respond within ${REQUEST_TIMEOUT_MS / 1000} seconds.`);
  }
  if (error instanceof TypeError) {
    return new AiProviderError('network', 'A network error prevented reaching the AI provider. Check connectivity and try again.');
  }
  const message = error instanceof Error ? error.message : 'Unknown error contacting the AI provider.';
  return new AiProviderError('provider', message);
}

async function completeWithLiveProvider(settings: AiSettings, request: AiRequest): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await requestChatCompletion({
      endpoint: endpointForProvider(settings.providerId),
      apiKey: settings.apiKey,
      model: settings.model,
      systemPrompt: request.system,
      userPrompt: request.prompt,
      jsonMode: isStructuredTask(request.context.task),
      signal: controller.signal,
    });
    return await parseChatCompletionResponse(response);
  } catch (error) {
    throw toLiveProviderError(error);
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Builds a live `AiProvider` for the given provider id, model and API key. */
export function createLiveProvider(settings: AiSettings): AiProvider {
  const option = findProviderOption(settings.providerId);
  return {
    id: settings.providerId,
    label: `${option.label} (${settings.model})`,
    mode: 'live',
    complete: (request: AiRequest) => completeWithLiveProvider(settings, request),
  };
}
