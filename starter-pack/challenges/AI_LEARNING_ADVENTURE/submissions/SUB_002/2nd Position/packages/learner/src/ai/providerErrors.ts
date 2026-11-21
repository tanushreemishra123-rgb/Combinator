import { APICallError } from 'ai';
import type {
  AiProviderErrorCode,
  AiProviderKind,
  AiProviderSafeError,
} from '@ai-learning-adventure/types';

export function aiProviderRequiresKey(kind: AiProviderKind): boolean {
  return kind === 'openai' || kind === 'ollama';
}

const ERROR_MESSAGES: Record<AiProviderErrorCode, string> = {
  not_configured: 'AI setup is incomplete. Configure a provider to use personalized responses.',
  unauthorized: 'The provider rejected this API key.',
  rate_limited: 'The provider free-tier limit was reached. Try again later.',
  network: 'The provider could not be reached from this browser. Check the endpoint and CORS settings.',
  timeout: 'The provider took too long to respond.',
  invalid_response: 'The provider returned an unsupported response.',
  aborted: 'The AI request was cancelled.',
};

export class AiProviderError extends Error {
  readonly code: AiProviderErrorCode;
  readonly retryable: boolean;

  constructor(code: AiProviderErrorCode, options: { retryable?: boolean; cause?: unknown } = {}) {
    super(ERROR_MESSAGES[code], { cause: options.cause }); // nosemgrep: gitlab.eslint.detect-object-injection
    this.name = 'AiProviderError';
    this.code = code;
    this.retryable = options.retryable ?? (code === 'rate_limited' || code === 'network' || code === 'timeout');
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof AiProviderError && error.code === 'aborted') ||
    (typeof error === 'object' && error !== null && 'name' in error && (error as { name: string }).name === 'AbortError')
  );
}

export function providerErrorForStatus(status: number): AiProviderError {
  if (status === 401 || status === 403) return new AiProviderError('unauthorized');
  if (status === 429) return new AiProviderError('rate_limited');
  return new AiProviderError(status >= 500 ? 'network' : 'invalid_response');
}

export function mapExternalAiError(error: unknown): AiProviderError {
  if (error instanceof AiProviderError) return error;
  if (isAbortError(error)) return new AiProviderError('aborted', { cause: error });
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return new AiProviderError('unauthorized', { cause: error });
    }
    if (error.statusCode === 429) {
      return new AiProviderError('rate_limited', { cause: error });
    }
    if (error.statusCode !== undefined && error.statusCode >= 500) {
      return new AiProviderError('network', { cause: error });
    }
    return new AiProviderError('invalid_response', { cause: error });
  }
  if (typeof error === 'object' && error !== null) {
    const err = error as { status?: number; statusCode?: number; name?: string; code?: string };
    const status = err.statusCode ?? err.status;
    if (status !== undefined) return providerErrorForStatus(status);
    if (err.name === 'AbortError') return new AiProviderError('aborted', { cause: error });
  }
  return new AiProviderError('network', { cause: error });
}

export function toAiProviderSafeError(error: unknown): AiProviderSafeError {
  const normalized = error instanceof AiProviderError ? error : mapExternalAiError(error);
  return {
    code: normalized.code,
    message: normalized.message,
    retryable: normalized.retryable,
  };
}
