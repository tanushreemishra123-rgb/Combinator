import type { AiProviderKind } from '@ai-learning-adventure/types';
import { aiProviderRequiresKey } from '@ai-learning-adventure/learner';
import { useAiProviderSettings } from '../hooks/useAiProviderSettings.ts';
import { ProviderStatusPill } from './ProviderStatusPill.tsx';

const KIND_DESCRIPTIONS: Record<AiProviderKind, string> = {
  openai: 'Calls OpenAI directly from this browser using its chat completions API.',
  ollama: 'Calls Ollama cloud directly from this browser using its OpenAI-compatible API.',
  local: 'Connects to an OpenAI-compatible service on your device, such as Ollama.',
  mock: 'Uses deterministic sample responses and makes no AI network requests.',
};

export function AiProviderSettingsCard() {
  const settings = useAiProviderSettings();
  const testing = settings.status.status === 'testing';
  return (
    <form
      id="ai-provider-settings"
      className="ai-provider-card"
      aria-labelledby="ai-provider-heading"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="ai-provider-card__heading">
        <div>
          <p className="ai-eyebrow">Personalized learning responses</p>
          <h2 id="ai-provider-heading" tabIndex={-1}>AI provider</h2>
        </div>
        <ProviderStatusPill status={settings.status.status} />
      </div>

      <div className="ai-provider-field">
        <label htmlFor="ai-provider-kind">Provider</label>
        <select
          id="ai-provider-kind"
          value={settings.draft.kind}
          onChange={(event) => settings.selectKind(event.target.value as AiProviderKind)}
        >
          <option value="openai">OpenAI</option>
          <option value="ollama">Ollama (cloud)</option>
          <option value="local">Local model</option>
          <option value="mock">Mock only</option>
        </select>
        <small>{KIND_DESCRIPTIONS[settings.draft.kind] /* nosemgrep: gitlab.eslint.detect-object-injection */}</small>
      </div>

      {settings.draft.kind !== 'mock' && (
        <>
          <div className="ai-provider-field">
            <label htmlFor="ai-provider-model">Model name</label>
            <input
              id="ai-provider-model"
              type="text"
              value={settings.draft.modelName}
              aria-invalid={settings.errors.modelName !== undefined}
              aria-describedby="ai-provider-model-help ai-provider-model-error"
              onChange={(event) => settings.setField('modelName', event.target.value)}
            />
            <small id="ai-provider-model-help">Use the exact model identifier exposed by the provider.</small>
            {settings.errors.modelName !== undefined && <span id="ai-provider-model-error" className="ai-provider-field__error">{settings.errors.modelName}</span>}
          </div>

          <div className="ai-provider-field">
            <label htmlFor="ai-provider-endpoint">API endpoint</label>
            <input
              id="ai-provider-endpoint"
              type="url"
              value={settings.draft.endpoint}
              aria-invalid={settings.errors.endpoint !== undefined}
              aria-describedby="ai-provider-endpoint-help ai-provider-endpoint-error"
              onChange={(event) => settings.setField('endpoint', event.target.value)}
            />
            <small id="ai-provider-endpoint-help">Enter the API root ending in <code>/v1</code>, without <code>/chat/completions</code>.</small>
            {settings.errors.endpoint !== undefined && <span id="ai-provider-endpoint-error" className="ai-provider-field__error">{settings.errors.endpoint}</span>}
          </div>
        </>
      )}

      {aiProviderRequiresKey(settings.draft.kind) && (
        <div className="ai-provider-key-group">
          <div className="ai-provider-field">
            <label htmlFor="ai-provider-key">API key</label>
            <input
              id="ai-provider-key"
              type="password"
              autoComplete="off"
              value={settings.draft.apiKey}
              placeholder={
                settings.hasSavedKey
                  ? `Saved key ending in ${settings.metadata.keyLastFour}`
                  : settings.draft.kind === 'openai'
                    ? 'Enter your OpenAI API key'
                    : 'Enter your Ollama API key'
              }
              aria-invalid={settings.errors.apiKey !== undefined}
              aria-describedby="ai-provider-key-help ai-provider-key-error"
              onChange={(event) => settings.setField('apiKey', event.target.value)}
            />
            <small id="ai-provider-key-help">Stored in this browser only and sent directly to the provider. Anyone with access to this browser profile can read it.</small>
            {settings.errors.apiKey !== undefined && <span id="ai-provider-key-error" className="ai-provider-field__error">{settings.errors.apiKey}</span>}
          </div>
          {settings.hasSavedKey && (
            <button type="button" className="button button--ghost button--small ai-provider-clear-key" onClick={settings.clearKey}>
              Clear key ending in {settings.metadata.keyLastFour}
            </button>
          )}
        </div>
      )}

      <div className="ai-provider-card__status" aria-live="polite">
        <strong>{settings.status.message ?? 'Choose a provider and save your settings.'}</strong>
        {settings.status.status === 'error' && <span> Sample responses remain available while you update the setup.</span>}
        {settings.formMessage !== undefined && settings.formMessage !== settings.status.message && <span> {settings.formMessage}</span>}
      </div>

      <div className="ai-provider-card__actions">
        <button type="button" className="button button--primary" disabled={testing} onClick={settings.save}>Save settings</button>
        {settings.draft.kind !== 'mock' && (
          testing ? (
            <button type="button" className="button button--secondary" onClick={settings.cancelTest}>Cancel test</button>
          ) : (
            <button type="button" className="button button--secondary" onClick={() => void settings.testConnection()}>Test connection</button>
          )
        )}
      </div>

      <div className="ai-provider-card__help">
        <p><strong>No paid access is required.</strong> Mock mode supports every AI learning surface.</p>
        {settings.draft.kind === 'openai' && <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">Create an OpenAI API key</a>}
        {settings.draft.kind === 'ollama' && <a href="https://ollama.com/settings/keys" target="_blank" rel="noreferrer">Get an Ollama API key</a>}
      </div>
    </form>
  );
}
