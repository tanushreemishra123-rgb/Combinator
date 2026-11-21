/**
 * AI mode settings dialog (spec "AI and Model Usage" - the assistant must clearly show whether it
 * is running in mock or live mode). Mock is the safe default; switching to Live reveals the
 * provider, model and API-key fields plus a connection test, and a privacy note about where the
 * key is kept and when requirements leave the browser.
 */
import { useId, useState } from 'react';
import type { ReactElement } from 'react';
import type { AiSettings, LiveProviderOption } from '../../ai';
import { Button, Callout, Field, Modal, Select, TextInput, Toggle } from '../common';

export interface AiSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: AiSettings;
  providerOptions: readonly LiveProviderOption[];
  onSave: (settings: AiSettings) => void;
  onTest: () => void;
  testResult?: { ok: boolean; message: string } | null;
  testing?: boolean;
}

function findProvider(options: readonly LiveProviderOption[], id: string): LiveProviderOption | undefined {
  return options.find((option) => option.id === id);
}

export function AiSettingsDialog({
  open,
  onClose,
  settings,
  providerOptions,
  onSave,
  onTest,
  testResult = null,
  testing = false,
}: AiSettingsDialogProps): ReactElement {
  const [draft, setDraft] = useState<AiSettings>(settings);
  const [wasOpen, setWasOpen] = useState(open);
  const modelListId = useId();

  // Re-seed the draft from `settings` on every open (not while it stays open) - adjusting state
  // during render, per React's guidance, rather than in an effect that would flash stale defaults.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraft(settings);
    }
  }

  const isLive = draft.mode === 'live';
  const selectedProvider = findProvider(providerOptions, draft.providerId);

  function handleProviderChange(providerId: string): void {
    const option = findProvider(providerOptions, providerId);
    setDraft((prev) => ({ ...prev, providerId: providerId as AiSettings['providerId'], model: option?.defaultModel ?? prev.model }));
  }

  function handleSave(): void {
    onSave(draft);
    onClose();
  }

  return (
    <Modal
      open={open}
      title="AI settings"
      description="Choose whether generation runs on deterministic mock content or a live AI provider."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save settings
          </Button>
        </>
      }
    >
      <div className="stack stack-md">
        <Toggle
          checked={isLive}
          onChange={(checked) => setDraft((prev) => ({ ...prev, mode: checked ? 'live' : 'mock' }))}
          label={isLive ? 'Live AI mode' : 'Mock AI mode (default)'}
        />
        <Callout tone="info" title="Privacy">
          Your API key is kept only in this browser tab&apos;s session storage - it is never saved with the session or exported.
          Requirements text is sent to the provider only while Live AI mode is selected.
        </Callout>
        {isLive ? (
          <>
            <Field label="Provider">
              {(controlProps) => (
                <Select
                  {...controlProps}
                  value={draft.providerId}
                  onChange={handleProviderChange}
                  options={providerOptions.map((option) => ({ value: option.id, label: option.label }))}
                />
              )}
            </Field>
            <Field label="Model" hint={selectedProvider?.freeTierNote}>
              {(controlProps) => (
                <>
                  <TextInput
                    {...controlProps}
                    value={draft.model}
                    onChange={(model) => setDraft((prev) => ({ ...prev, model }))}
                    list={modelListId}
                    placeholder="Model id"
                  />
                  <datalist id={modelListId}>
                    {(selectedProvider?.models ?? []).map((model) => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="API key">
              {(controlProps) => (
                <TextInput
                  {...controlProps}
                  type="password"
                  value={draft.apiKey}
                  onChange={(apiKey) => setDraft((prev) => ({ ...prev, apiKey }))}
                  placeholder="Paste your API key"
                  autoComplete="off"
                />
              )}
            </Field>
            <div className="cluster">
              <Button variant="secondary" busy={testing} onClick={onTest}>
                Test connection
              </Button>
            </div>
            {testResult ? (
              <Callout tone={testResult.ok ? 'success' : 'danger'}>{testResult.message}</Callout>
            ) : null}
          </>
        ) : null}
      </div>
    </Modal>
  );
}
