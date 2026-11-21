import type {
  AiProviderRuntimeConfig,
  LearnerAiProvider,
} from '@ai-learning-adventure/types';
import { createOpenAiCompatibleProvider } from './openAiCompatible.ts';
import { createMockAiProvider } from './provider.ts';
import { aiProviderRequiresKey } from './providerErrors.ts';

export const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1';
export const DEFAULT_OPENAI_MODEL = 'gpt-5.6-luna';
export const DEFAULT_OLLAMA_AI_ENDPOINT = 'https://ollama.com/v1';
export const DEFAULT_OLLAMA_AI_MODEL = 'gpt-oss:20b';
export const DEFAULT_LOCAL_AI_ENDPOINT = 'http://localhost:11434/v1';
export const DEFAULT_LOCAL_AI_MODEL = 'llama3.2:3b';

export function isAiProviderConfigured(config: AiProviderRuntimeConfig): boolean {
  if (config.kind === 'mock') return true;
  if ((config.endpoint?.trim().length ?? 0) === 0 || (config.modelName?.trim().length ?? 0) === 0) {
    return false;
  }
  return !aiProviderRequiresKey(config.kind) || (config.apiKey?.trim().length ?? 0) > 0;
}

export function createAiProvider(config: AiProviderRuntimeConfig): LearnerAiProvider {
  if (config.kind === 'mock' || !isAiProviderConfigured(config)) return createMockAiProvider();
  return createOpenAiCompatibleProvider(config);
}
