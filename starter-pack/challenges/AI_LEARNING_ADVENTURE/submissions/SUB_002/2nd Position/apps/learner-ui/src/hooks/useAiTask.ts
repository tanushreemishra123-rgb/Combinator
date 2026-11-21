import { useCallback, useEffect, useRef, useState } from 'react';
import type { AiProviderSafeError, AiResult, AiTaskRequest } from '@ai-learning-adventure/types';
import { executeAiTask } from '@ai-learning-adventure/learner';
import { useAiProviderRuntime } from '../features/ai-provider/AiProviderRuntime.tsx';

export type AiTaskStatus = 'idle' | 'running' | 'complete' | 'stopped' | 'error';

export interface UseAiTaskResult {
  data?: AiResult;
  partialText: string;
  status: AiTaskStatus;
  error?: string;
  fallbackError?: AiProviderSafeError;
  run: (
    request: AiTaskRequest,
    options?: {
      correctOptionTexts?: readonly string[];
      onToken?: (token: string) => void;
    },
  ) => Promise<AiResult | undefined>;
  cancel: () => void;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function useAiTask(): UseAiTaskResult {
  const runtime = useAiProviderRuntime();
  const abortRef = useRef<AbortController | undefined>(undefined);
  const requestRef = useRef(0);
  const [data, setData] = useState<AiResult | undefined>(undefined);
  const [partialText, setPartialText] = useState('');
  const [status, setStatus] = useState<AiTaskStatus>('idle');
  const [error, setError] = useState<string | undefined>(undefined);
  const [fallbackError, setFallbackError] = useState<AiProviderSafeError | undefined>(undefined);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = undefined;
    setStatus((current) => (current === 'running' ? 'stopped' : current));
  }, []);

  useEffect(() => cancel, [cancel]);

  const run = useCallback(
    async (
      request: AiTaskRequest,
      options: { correctOptionTexts?: readonly string[]; onToken?: (token: string) => void } = {},
    ): Promise<AiResult | undefined> => {
      cancel();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestRef.current;
      const shouldStream = request.task === 'chat' || request.task === 'explain' || request.task === 'example';
      setData(undefined);
      setPartialText('');
      setError(undefined);
      setFallbackError(undefined);
      setStatus('running');
      const requestProvider = runtime.provider;
      const requestRevision = runtime.revision;

      try {
        const result = await executeAiTask({
          provider: requestProvider,
          request,
          ...(options.correctOptionTexts !== undefined
            ? { correctOptionTexts: options.correctOptionTexts }
            : {}),
          ...(shouldStream
            ? {
                onToken: (token: string) => {
                  if (requestId !== requestRef.current || controller.signal.aborted) return;
                  setPartialText((current) => current + token);
                  options.onToken?.(token);
                },
              }
            : {}),
          signal: controller.signal,
          timeoutMs: runtime.config.timeoutMs ?? 30000,
        });
        if (requestId !== requestRef.current || controller.signal.aborted) return undefined;
        setData(result);
        setPartialText(result.text);
        setFallbackError(result.fallbackError);
        setStatus('complete');
        abortRef.current = undefined;
        runtime.reportResult(result, requestRevision);
        return result;
      } catch (caught) {
        if (requestId !== requestRef.current || isAbortError(caught)) {
          if (requestId === requestRef.current) setStatus('stopped');
          return undefined;
        }
        const message = caught instanceof Error ? caught.message : 'The AI request failed.';
        setError(message);
        setStatus('error');
        abortRef.current = undefined;
        return undefined;
      }
    },
    [cancel, runtime],
  );

  return {
    ...(data !== undefined ? { data } : {}),
    partialText,
    status,
    ...(error !== undefined ? { error } : {}),
    ...(fallbackError !== undefined ? { fallbackError } : {}),
    run,
    cancel,
  };
}
