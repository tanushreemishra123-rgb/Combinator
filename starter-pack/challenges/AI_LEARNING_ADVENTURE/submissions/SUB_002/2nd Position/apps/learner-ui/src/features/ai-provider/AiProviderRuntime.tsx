import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AiProviderConfigMeta,
  AiProviderConnectionStatus,
  AiProviderRuntimeConfig,
  AiProviderSafeError,
  AiProviderTestResult,
  AiResult,
  LearnerAiProvider,
} from '@ai-learning-adventure/types';
import { createAiProvider, isAiProviderConfigured } from '@ai-learning-adventure/learner';
import { useAppDispatch } from '../../store/index.ts';
import { setProviderConfigMeta, setProviderStatus } from '../../store/aiSlice.ts';
import {
  loadAiProviderConfig,
  saveAiProviderConfig,
  toAiProviderConfigMeta,
} from './aiProviderStorage.ts';

interface RuntimeStatus {
  status: AiProviderConnectionStatus;
  message?: string;
  error?: AiProviderSafeError;
  checkedAt?: string;
}

const CONNECTION_TEST_TIMEOUT_MS = 10000;

interface SaveResult {
  ok: boolean;
  message: string;
}

export interface AiProviderRuntimeValue {
  config: AiProviderRuntimeConfig;
  metadata: AiProviderConfigMeta;
  provider: LearnerAiProvider;
  revision: number;
  status: RuntimeStatus;
  save: (config: AiProviderRuntimeConfig, preserveExistingKey?: boolean) => SaveResult;
  clearKey: () => SaveResult;
  test: (config?: AiProviderRuntimeConfig, preserveExistingKey?: boolean) => Promise<AiProviderTestResult>;
  cancelTest: () => void;
  reportResult: (result: AiResult, requestRevision: number) => void;
}

const AiProviderRuntimeContext = createContext<AiProviderRuntimeValue | undefined>(undefined);

function initialStatus(config: AiProviderRuntimeConfig): RuntimeStatus {
  if (config.kind === 'mock') return { status: 'mock', message: 'Sample AI mode is active.' };
  if (!isAiProviderConfigured(config)) {
    return { status: 'not_configured', message: 'AI setup is required for personalized responses.' };
  }
  return { status: 'unknown', message: 'Provider saved. Test the connection to verify it.' };
}

function storageFailure(): SaveResult {
  return { ok: false, message: 'The provider settings could not be stored in this browser.' };
}

export function AiProviderRuntimeProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const initial = useMemo(loadAiProviderConfig, []);
  const [config, setConfig] = useState(initial.config);
  const [updatedAt, setUpdatedAt] = useState(initial.updatedAt);
  const [status, setStatus] = useState<RuntimeStatus>(() => initialStatus(initial.config));
  const [revision, setRevision] = useState(0);
  const revisionRef = useRef(0);
  const configRef = useRef(config);
  const testAbortRef = useRef<AbortController | undefined>(undefined);
  const testIdRef = useRef(0);
  const provider = useMemo(() => createAiProvider(config), [config]);
  const metadata = useMemo(() => toAiProviderConfigMeta(config, updatedAt), [config, updatedAt]);

  const replaceConfig = useCallback(
    (next: AiProviderRuntimeConfig, preserveExistingKey = true): SaveResult => {
      const normalized: AiProviderRuntimeConfig = {
        ...next,
        endpoint: next.endpoint?.trim(),
        modelName: next.modelName?.trim(),
        apiKey:
          next.apiKey?.trim() ||
          (preserveExistingKey && next.kind === configRef.current.kind
            ? configRef.current.apiKey
            : undefined),
      };
      const nextUpdatedAt = new Date().toISOString();
      if (!saveAiProviderConfig(normalized, nextUpdatedAt)) return storageFailure();
      testIdRef.current += 1;
      testAbortRef.current?.abort();
      configRef.current = normalized;
      setConfig(normalized);
      setUpdatedAt(nextUpdatedAt);
      revisionRef.current += 1;
      setRevision(revisionRef.current);
      setStatus(initialStatus(normalized));
      return { ok: true, message: normalized.kind === 'mock' ? 'Mock mode is active.' : 'Provider settings saved.' };
    },
    [],
  );

  const clearKey = useCallback((): SaveResult => {
    const current = configRef.current;
    return replaceConfig({ ...current, apiKey: undefined }, false);
  }, [replaceConfig]);

  const cancelTest = useCallback(() => {
    testIdRef.current += 1;
    testAbortRef.current?.abort();
    testAbortRef.current = undefined;
    setStatus(initialStatus(configRef.current));
  }, []);

  const test = useCallback(
    async (
      candidate: AiProviderRuntimeConfig = configRef.current,
      preserveExistingKey = true,
    ): Promise<AiProviderTestResult> => {
      const saved = replaceConfig(candidate, preserveExistingKey);
      if (!saved.ok) return { ok: false, message: saved.message };
      const activeConfig = configRef.current;
      if (activeConfig.kind === 'mock') return { ok: true, message: 'Sample mode is ready.' };
      if (!isAiProviderConfigured(activeConfig)) {
        const error: AiProviderSafeError = {
          code: 'not_configured',
          message: 'AI setup is incomplete. Configure a provider to use personalized responses.',
          retryable: false,
        };
        setStatus({ status: 'not_configured', message: error.message, error });
        return { ok: false, message: error.message, error };
      }
      const testId = ++testIdRef.current;
      const controller = new AbortController();
      testAbortRef.current = controller;
      setStatus({ status: 'testing', message: 'Testing the provider connection...' });
      const testProvider = createAiProvider(activeConfig);
      let timedOut = false;
      let rejectTestControl: (reason: unknown) => void = () => undefined;
      const testControl = new Promise<never>((_resolve, reject) => {
        rejectTestControl = reject;
      });
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
        rejectTestControl(new DOMException('Connection test timed out.', 'AbortError'));
      }, CONNECTION_TEST_TIMEOUT_MS);
      let result: AiProviderTestResult;
      try {
        result = await Promise.race([testProvider.test(controller.signal), testControl]);
      } catch {
        result = {
          ok: false,
          message: timedOut ? 'The provider took too long to respond.' : 'Connection test cancelled.',
          error: timedOut
            ? { code: 'timeout', message: 'The provider took too long to respond.', retryable: true }
            : { code: 'aborted', message: 'The AI request was cancelled.', retryable: false },
        };
      } finally {
        clearTimeout(timeout);
      }
      if (testId !== testIdRef.current) return result;
      testAbortRef.current = undefined;
      const checkedAt = new Date().toISOString();
      const normalizedResult: AiProviderTestResult = timedOut
        ? {
            ok: false,
            message: 'The provider took too long to respond.',
            error: { code: 'timeout', message: 'The provider took too long to respond.', retryable: true },
          }
        : result;
      if (normalizedResult.ok) {
        setStatus({ status: 'connected', message: normalizedResult.message, checkedAt });
      } else if (normalizedResult.error?.code === 'aborted') {
        setStatus(initialStatus(activeConfig));
      } else {
        setStatus({ status: 'error', message: normalizedResult.message, error: normalizedResult.error, checkedAt });
      }
      return normalizedResult;
    },
    [replaceConfig],
  );

  const reportResult = useCallback((result: AiResult, requestRevision: number) => {
    if (requestRevision !== revisionRef.current) return;
    const checkedAt = new Date().toISOString();
    if (!result.isMock) {
      setStatus({ status: 'connected', message: 'AI provider connected.', checkedAt });
    } else if (result.fallbackError !== undefined) {
      setStatus({
        status: 'error',
        message: result.fallbackError.message,
        error: result.fallbackError,
        checkedAt,
      });
    }
  }, []);

  useEffect(() => {
    dispatch(setProviderConfigMeta(metadata));
    dispatch(setProviderStatus({
      status: status.status,
      ...(status.message !== undefined ? { message: status.message } : {}),
      ...(status.checkedAt !== undefined ? { checkedAt: status.checkedAt } : {}),
    }));
  }, [dispatch, metadata, status]);

  useEffect(
    () => () => {
      testIdRef.current += 1;
      testAbortRef.current?.abort();
    },
    [],
  );

  const value = useMemo<AiProviderRuntimeValue>(
    () => ({
      config,
      metadata,
      provider,
      revision,
      status,
      save: replaceConfig,
      clearKey,
      test,
      cancelTest,
      reportResult,
    }),
    [cancelTest, clearKey, config, metadata, provider, replaceConfig, reportResult, revision, status, test],
  );
  return <AiProviderRuntimeContext.Provider value={value}>{children}</AiProviderRuntimeContext.Provider>;
}

export function useAiProviderRuntime(): AiProviderRuntimeValue {
  const context = useContext(AiProviderRuntimeContext);
  if (context === undefined) {
    throw new Error('useAiProviderRuntime must be used inside AiProviderRuntimeProvider.');
  }
  return context;
}
