import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import type {
  AiProviderKind,
  AiProviderRuntimeConfig,
  AiResult,
  AiTaskRequest,
  LearnerAiProvider,
  MissionId,
} from '@ai-learning-adventure/types';
import { contextMissionIds } from './context.ts';
import { buildAiPrompt } from './prompts.ts';
import { parseSummary, parseWrittenFeedback } from './parsers.ts';
import {
  AiProviderError,
  aiProviderRequiresKey,
  isAbortError,
  mapExternalAiError,
  providerErrorForStatus,
  toAiProviderSafeError,
} from './providerErrors.ts';

export interface OpenAiCompatibleConfig {
  kind: Exclude<AiProviderKind, 'mock'>;
  endpoint: string;
  modelName: string;
  apiKey?: string;
}

export function trimEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '');
}

export function resolveEndpoint(endpoint: string): string {
  const trimmed = trimEndpoint(endpoint);
  if (typeof window !== 'undefined' && /^https?:\/\/ollama\.com(\/|$)/i.test(trimmed)) {
    return trimmed.replace(/^https?:\/\/ollama\.com/i, '/ollama-proxy');
  }
  return trimmed;
}

export function headers(config: OpenAiCompatibleConfig): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(config.apiKey !== undefined && config.apiKey.length > 0
      ? { Authorization: `Bearer ${config.apiKey}` }
      : {}),
  };
}

function resultFor(
  config: OpenAiCompatibleConfig,
  request: AiTaskRequest,
  text: string,
  id?: string,
): AiResult {
  const result: AiResult = {
    id: id ?? `${config.kind}-${crypto.randomUUID()}`,
    text,
    provider: config.kind,
    isMock: false,
    sourceMissionIds: [...new Set(contextMissionIds(request.context))] as MissionId[],
    safety: {
      redirected: false,
      uncertain: request.task === 'chat' || request.task === 'explain',
      hintLeakChecked: request.task === 'hint',
    },
  };
  if (request.task === 'written_feedback') {
    const feedback = parseWrittenFeedback(result);
    if (feedback !== undefined) result.structured = { kind: 'written_feedback', feedback };
  }
  if (request.task === 'summary') {
    const summary = parseSummary(result);
    if (summary !== undefined) result.structured = { kind: 'summary', summary };
  }
  return result;
}

function taskTemperature(request: AiTaskRequest): number {
  return request.task === 'hint' || request.task === 'answer_feedback' ? 0.2 : 0.5;
}

function createOpenAiClient(config: OpenAiCompatibleConfig) {
  const endpoint = resolveEndpoint(config.endpoint);
  return createOpenAI({
    baseURL: endpoint,
    apiKey: config.apiKey ?? 'not-needed',
    headers: config.apiKey !== undefined && config.apiKey.length > 0
      ? { Authorization: `Bearer ${config.apiKey}` }
      : {},
  });
}

async function complete(
  config: OpenAiCompatibleConfig,
  request: AiTaskRequest,
  signal?: AbortSignal,
): Promise<AiResult> {
  const openai = createOpenAiClient(config);
  const prompt = buildAiPrompt(request);
  const temperature = taskTemperature(request);

  try {
    const response = await generateText({
      model: openai.chat(config.modelName),
      system: prompt.system,
      prompt: prompt.user,
      temperature,
      abortSignal: signal,
    });

    const content = response.text.trim();
    if (content.length === 0) {
      throw new AiProviderError('invalid_response');
    }

    const responseId = response.response?.id;
    return resultFor(config, request, content, responseId);
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw error;
    throw mapExternalAiError(error);
  }
}

async function stream(
  config: OpenAiCompatibleConfig,
  request: AiTaskRequest,
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<AiResult> {
  const openai = createOpenAiClient(config);
  const prompt = buildAiPrompt(request);
  const temperature = taskTemperature(request);

  try {
    const streamResult = streamText({
      model: openai.chat(config.modelName),
      system: prompt.system,
      prompt: prompt.user,
      temperature,
      abortSignal: signal,
    });

    let fullText = '';
    for await (const part of streamResult.fullStream) {
      if (signal?.aborted) throw new DOMException('The AI request was aborted.', 'AbortError');
      if (part.type === 'text-delta') {
        const text = 'text' in part && typeof part.text === 'string'
          ? part.text
          : ('textDelta' in part && typeof part.textDelta === 'string' ? part.textDelta : '');
        if (text.length > 0) {
          fullText += text;
          onToken(text);
        }
      } else if (part.type === 'error') {
        throw part.error;
      }
    }

    if (fullText.trim().length === 0) {
      throw new AiProviderError('invalid_response');
    }

    const responseId = (await streamResult.response)?.id;
    return resultFor(config, request, fullText.trim(), responseId);
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw error;
    throw mapExternalAiError(error);
  }
}

export function createOpenAiCompatibleProvider(
  runtimeConfig: AiProviderRuntimeConfig,
): LearnerAiProvider {
  if (runtimeConfig.kind === 'mock') {
    throw new AiProviderError('not_configured');
  }
  const endpoint = trimEndpoint(runtimeConfig.endpoint ?? '');
  const modelName = runtimeConfig.modelName?.trim() ?? '';
  const apiKey = runtimeConfig.apiKey?.trim();
  if (endpoint.length === 0 || modelName.length === 0) {
    throw new AiProviderError('not_configured');
  }
  if (aiProviderRequiresKey(runtimeConfig.kind) && (apiKey === undefined || apiKey.length === 0)) {
    throw new AiProviderError('not_configured');
  }
  const config: OpenAiCompatibleConfig = {
    kind: runtimeConfig.kind,
    endpoint,
    modelName,
    ...(apiKey !== undefined && apiKey.length > 0 ? { apiKey } : {}),
  };
  return {
    kind: config.kind,
    complete: (request, signal) => complete(config, request, signal),
    stream: (request, onToken, signal) => stream(config, request, onToken, signal),
    async test(signal) {
      try {
        const endpoint = resolveEndpoint(config.endpoint);
        const response = await fetch(`${endpoint}/models`, {
          method: 'GET',
          headers: headers(config),
          signal,
        });
        if (!response.ok) throw providerErrorForStatus(response.status);
        return { ok: true, message: `Connected to ${config.modelName}.` };
      } catch (error) {
        const safeError = toAiProviderSafeError(error);
        return { ok: false, message: safeError.message, error: safeError };
      }
    },
  };
}
