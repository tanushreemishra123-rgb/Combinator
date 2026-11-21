import { useEffect, useState } from 'react';
import type {
  AiProviderKind,
  AiProviderRuntimeConfig,
  AiProviderTestResult,
} from '@ai-learning-adventure/types';
import { aiProviderRequiresKey } from '@ai-learning-adventure/learner';
import { announceLive } from '../../../hooks/ui/useLiveAnnouncement.ts';
import { defaultAiProviderConfig } from '../aiProviderStorage.ts';
import { useAiProviderRuntime } from '../AiProviderRuntime.tsx';

export interface AiProviderSettingsDraft {
  kind: AiProviderKind;
  endpoint: string;
  modelName: string;
  apiKey: string;
}

interface FieldErrors {
  endpoint?: string;
  modelName?: string;
  apiKey?: string;
}

function draftFor(config: AiProviderRuntimeConfig): AiProviderSettingsDraft {
  return {
    kind: config.kind,
    endpoint: config.endpoint ?? '',
    modelName: config.modelName ?? '',
    apiKey: '',
  };
}

function validate(draft: AiProviderSettingsDraft, hasSavedKey: boolean): FieldErrors {
  if (draft.kind === 'mock') return {};
  const errors: FieldErrors = {};
  if (draft.endpoint.trim().length === 0) {
    errors.endpoint = 'Enter the provider API endpoint.';
  } else {
    try {
      const url = new URL(draft.endpoint);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') errors.endpoint = 'Use an http or https URL.';
    } catch {
      errors.endpoint = 'Enter a valid endpoint URL.';
    }
  }
  if (draft.modelName.trim().length === 0) errors.modelName = 'Enter a model name.';
  if (aiProviderRequiresKey(draft.kind) && draft.apiKey.trim().length === 0 && !hasSavedKey) {
    // nosemgrep: ajinabraham.njsscan.generic.hardcoded_secrets.node_api_key
    Object.assign(errors, { apiKey: 'Enter an API key for this provider.' });
  }
  return errors;
}

export function useAiProviderSettings() {
  const runtime = useAiProviderRuntime();
  const [draft, setDraft] = useState(() => draftFor(runtime.config));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    setDraft(draftFor(runtime.config));
  }, [runtime.config]);

  const hasSavedKey = runtime.metadata.keyLastFour !== undefined && draft.kind === runtime.metadata.kind;

  function configFromDraft(): AiProviderRuntimeConfig {
    return {
      kind: draft.kind,
      ...(draft.kind !== 'mock'
        ? { endpoint: draft.endpoint.trim(), modelName: draft.modelName.trim() }
        : {}),
      ...(draft.apiKey.trim().length > 0 ? { apiKey: draft.apiKey.trim() } : {}),
    };
  }

  function prepare(): AiProviderRuntimeConfig | undefined {
    const nextErrors = validate(draft, hasSavedKey);
    setErrors(nextErrors);
    setFormMessage(undefined);
    if (Object.keys(nextErrors).length > 0) return undefined;
    return configFromDraft();
  }

  function save(): boolean {
    const config = prepare();
    if (config === undefined) return false;
    const result = runtime.save(config, true);
    setFormMessage(result.message);
    if (result.ok) announceLive(result.message);
    return result.ok;
  }

  async function testConnection(): Promise<AiProviderTestResult | undefined> {
    const config = prepare();
    if (config === undefined) return undefined;
    const result = await runtime.test(config, true);
    const message = result.error?.code === 'aborted' ? 'Connection test cancelled.' : result.message;
    setFormMessage(message);
    announceLive(result.ok ? 'AI provider connected.' : message, result.error?.code === 'aborted' ? 'polite' : result.ok ? 'polite' : 'assertive');
    return result;
  }

  function clearKey(): void {
    const result = runtime.clearKey();
    setDraft((current) => ({ ...current, apiKey: '' }));
    setFormMessage(result.ok ? 'API key cleared. Sample responses are active.' : result.message);
    announceLive(result.ok ? 'API key cleared. Sample responses are active.' : result.message);
  }

  function selectKind(kind: AiProviderKind): void {
    const defaults = defaultAiProviderConfig(kind);
    setDraft({
      kind,
      endpoint: defaults.endpoint ?? '',
      modelName: defaults.modelName ?? '',
      apiKey: '',
    });
    setErrors({});
    setFormMessage(undefined);
  }

  return {
    draft,
    errors,
    formMessage,
    metadata: runtime.metadata,
    status: runtime.status,
    hasSavedKey,
    setField: (field: 'endpoint' | 'modelName' | 'apiKey', value: string) => {
      setDraft((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
      setFormMessage(undefined);
    },
    selectKind,
    save,
    clearKey,
    testConnection,
    cancelTest: runtime.cancelTest,
  };
}
