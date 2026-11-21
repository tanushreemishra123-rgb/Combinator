import type {
  AiProviderSafeError,
  AiResult,
  AiTaskRequest,
  LearnerAiProvider,
} from '@ai-learning-adventure/types';
import { guardTaskResult } from './guardrails.ts';
import { createMockAiResult, createSafeMockAiResult } from './mockLibrary.ts';
import { isAnswerRevealRequest, isObviouslyOffScope } from './normalize.ts';
import { AiProviderError, isAbortError, toAiProviderSafeError } from './providerErrors.ts';

export function createMockAiProvider(): LearnerAiProvider {
  return {
    kind: 'mock',
    async complete(request, signal) {
      if (signal?.aborted) throw new DOMException('The AI request was aborted.', 'AbortError');
      await Promise.resolve();
      if (signal?.aborted) throw new DOMException('The AI request was aborted.', 'AbortError');
      return createMockAiResult(request);
    },
    async stream(request, onToken, signal) {
      const result = await this.complete(request, signal);
      const tokens = result.text.match(/\S+\s*/g) ?? [result.text];
      for (const token of tokens) {
        if (signal?.aborted) throw new DOMException('The AI request was aborted.', 'AbortError');
        onToken(token);
        await Promise.resolve();
      }
      return result;
    },
    async test(signal) {
      if (signal?.aborted) return { ok: false, message: 'Connection test cancelled.' };
      return { ok: true, message: 'Sample mode is ready.' };
    },
  };
}

export interface ExecuteAiTaskOptions {
  provider: LearnerAiProvider;
  request: AiTaskRequest;
  correctOptionTexts?: readonly string[];
  onToken?: (token: string) => void;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function executeAiTask({
  provider,
  request,
  correctOptionTexts = [],
  onToken,
  signal,
  timeoutMs = 30000,
}: ExecuteAiTaskOptions): Promise<AiResult> {
  async function emitSafeResult(safeResult: AiResult): Promise<AiResult> {
    if (onToken !== undefined) {
      const tokens = safeResult.text.match(/\S+\s*/g) ?? [safeResult.text];
      for (const token of tokens) {
        if (signal?.aborted) throw new DOMException('The AI request was aborted.', 'AbortError');
        onToken(token);
        await Promise.resolve();
      }
    }
    return safeResult;
  }

  if (
    request.task === 'chat' &&
    (isAnswerRevealRequest(request.message ?? '') || isObviouslyOffScope(request.message ?? ''))
  ) {
    const redirected = createSafeMockAiResult(
      request,
      isAnswerRevealRequest(request.message ?? '') ? 'answer_reveal' : 'scope',
    );
    return emitSafeResult(redirected);
  }
  let result: AiResult;
  let streamed = false;
  const providerController = new AbortController();
  let timedOut = false;
  let rejectControl: (reason: unknown) => void = () => undefined;
  const control = new Promise<never>((_resolve, reject) => {
    rejectControl = reject;
  });
  const forwardAbort = () => {
    providerController.abort(signal?.reason);
    rejectControl(new DOMException('The AI request was aborted.', 'AbortError'));
  };
  if (signal?.aborted) forwardAbort();
  else signal?.addEventListener('abort', forwardAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    providerController.abort();
    rejectControl(new AiProviderError('timeout'));
  }, timeoutMs);
  try {
    let providerRequest: Promise<AiResult>;
    if (provider.stream !== undefined && onToken !== undefined) {
      providerRequest = provider.stream(
        request,
        (token) => {
          streamed = true;
          onToken(token);
        },
        providerController.signal,
      );
    } else {
      providerRequest = provider.complete(request, providerController.signal);
    }
    result = await Promise.race([providerRequest, control]);
  } catch (error) {
    if (signal?.aborted || (isAbortError(error) && !timedOut)) throw error;
    const fallbackError: AiProviderSafeError = timedOut
      ? toAiProviderSafeError(new AiProviderError('timeout'))
      : toAiProviderSafeError(error);
    result = createSafeMockAiResult(request, 'provider_failure');
    result.fallbackError = fallbackError;
    return emitSafeResult(result);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', forwardAbort);
  }
  const guarded = guardTaskResult(request, result, correctOptionTexts);
  if (guarded.accepted && guarded.result !== undefined) {
    return streamed ? guarded.result : emitSafeResult(guarded.result);
  }

  const fallback = createSafeMockAiResult(request, guarded.reason ?? 'failed_guard');
  fallback.fallbackError = toAiProviderSafeError(new AiProviderError('invalid_response'));
  const fallbackGuard = guardTaskResult(request, fallback, correctOptionTexts);
  if (fallbackGuard.accepted && fallbackGuard.result !== undefined) return emitSafeResult(fallbackGuard.result);
  return emitSafeResult(fallback);
}
