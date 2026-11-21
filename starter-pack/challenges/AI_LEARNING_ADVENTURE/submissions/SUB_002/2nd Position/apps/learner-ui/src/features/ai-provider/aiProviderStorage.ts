import type {
  AiProviderConfigMeta,
  AiProviderKind,
  AiProviderRuntimeConfig,
} from '@ai-learning-adventure/types';
import {
  DEFAULT_LOCAL_AI_ENDPOINT,
  DEFAULT_LOCAL_AI_MODEL,
  DEFAULT_OLLAMA_AI_ENDPOINT,
  DEFAULT_OLLAMA_AI_MODEL,
  DEFAULT_OPENAI_ENDPOINT,
  DEFAULT_OPENAI_MODEL,
  isAiProviderConfigured,
} from '@ai-learning-adventure/learner';

export const AI_PROVIDER_STORAGE_KEY = 'learner-ui.ai-provider.v1';
const AI_PROVIDER_STORAGE_VERSION = 1;

interface StoredAiProviderConfig {
  version: number;
  kind: AiProviderKind;
  endpoint?: string;
  modelName?: string;
  apiKey?: string;
  timeoutMs?: number;
  updatedAt: string;
}

export interface LoadedAiProviderConfig {
  config: AiProviderRuntimeConfig;
  updatedAt?: string;
}

function openaiEndpoint(): string {
  return import.meta.env.VITE_OPENAI_ENDPOINT?.trim() || DEFAULT_OPENAI_ENDPOINT;
}

function openaiModel(): string {
  return import.meta.env.VITE_OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

function ollamaEndpoint(): string {
  return import.meta.env.VITE_OLLAMA_ENDPOINT?.trim() || DEFAULT_OLLAMA_AI_ENDPOINT;
}

function ollamaModel(): string {
  return import.meta.env.VITE_OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_AI_MODEL;
}

export function defaultAiProviderConfig(kind: AiProviderKind = 'openai'): AiProviderRuntimeConfig {
  if (kind === 'mock') return { kind: 'mock' };
  if (kind === 'local') {
    return { kind, endpoint: DEFAULT_LOCAL_AI_ENDPOINT, modelName: DEFAULT_LOCAL_AI_MODEL };
  }
  if (kind === 'ollama') {
    return { kind, endpoint: ollamaEndpoint(), modelName: ollamaModel() };
  }
  return { kind: 'openai', endpoint: openaiEndpoint(), modelName: openaiModel() };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function isProviderKind(value: unknown): value is AiProviderKind {
  return (
    value === 'openai' || value === 'ollama' || value === 'local' || value === 'mock'
  );
}

export function loadAiProviderConfig(): LoadedAiProviderConfig {
  try {
    const raw = localStorage.getItem(AI_PROVIDER_STORAGE_KEY);
    if (raw === null) return { config: defaultAiProviderConfig() };
    const parsed = JSON.parse(raw) as Partial<StoredAiProviderConfig> | null;
    if (
      parsed === null ||
      parsed.version !== AI_PROVIDER_STORAGE_VERSION ||
      !isProviderKind(parsed.kind)
    ) {
      return { config: defaultAiProviderConfig() };
    }
    const defaults = defaultAiProviderConfig(parsed.kind);
    const endpoint = optionalString(parsed.endpoint) ?? defaults.endpoint;
    const modelName = optionalString(parsed.modelName) ?? defaults.modelName;
    const apiKey = optionalString(parsed.apiKey);
    const timeoutMs =
      typeof parsed.timeoutMs === 'number' && Number.isFinite(parsed.timeoutMs) && parsed.timeoutMs >= 1000
        ? Math.min(parsed.timeoutMs, 120000)
        : undefined;
    return {
      config: {
        kind: parsed.kind,
        ...(endpoint !== undefined ? { endpoint } : {}),
        ...(modelName !== undefined ? { modelName } : {}),
        ...(apiKey !== undefined ? { apiKey } : {}),
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      },
      ...(typeof parsed.updatedAt === 'string' ? { updatedAt: parsed.updatedAt } : {}),
    };
  } catch {
    return { config: defaultAiProviderConfig() };
  }
}

export function saveAiProviderConfig(config: AiProviderRuntimeConfig, updatedAt: string): boolean {
  try {
    const stored: StoredAiProviderConfig = {
      version: AI_PROVIDER_STORAGE_VERSION,
      kind: config.kind,
      ...(config.endpoint !== undefined ? { endpoint: config.endpoint.trim() } : {}),
      ...(config.modelName !== undefined ? { modelName: config.modelName.trim() } : {}),
      ...(config.apiKey !== undefined && config.apiKey.trim().length > 0
        ? { apiKey: config.apiKey.trim() }
        : {}),
      ...(config.timeoutMs !== undefined ? { timeoutMs: config.timeoutMs } : {}),
      updatedAt,
    };
    localStorage.setItem(AI_PROVIDER_STORAGE_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export function toAiProviderConfigMeta(
  config: AiProviderRuntimeConfig,
  updatedAt?: string,
): AiProviderConfigMeta {
  const key = config.apiKey?.trim();
  return {
    kind: config.kind,
    configured: isAiProviderConfigured(config),
    ...(config.endpoint !== undefined ? { endpoint: config.endpoint } : {}),
    ...(config.modelName !== undefined ? { modelName: config.modelName } : {}),
    ...(key !== undefined && key.length > 0 ? { keyLastFour: key.slice(-4) } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {}),
  };
}
