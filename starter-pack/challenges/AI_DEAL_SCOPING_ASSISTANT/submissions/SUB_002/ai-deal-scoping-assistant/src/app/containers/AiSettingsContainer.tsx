/** Wires the shell's `AiSettingsDialog` to AI-settings persistence and the live-connection test. */
import { useState } from 'react';
import type { ReactElement } from 'react';
import { LIVE_PROVIDER_OPTIONS } from '../../ai';
import type { AiSettings } from '../../ai';
import { useActions, useAppState } from '../../state';
import { AiSettingsDialog } from '../../ui/shell';

export interface AiSettingsContainerProps {
  open: boolean;
  onClose: () => void;
}

export function AiSettingsContainer({ open, onClose }: AiSettingsContainerProps): ReactElement {
  const { aiSettings } = useAppState();
  const actions = useActions();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleTest(): Promise<void> {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await actions.runConnectionTest());
    } finally {
      setTesting(false);
    }
  }

  function handleSave(settings: AiSettings): void {
    setTestResult(null);
    actions.updateAiSettings(settings);
  }

  return (
    <AiSettingsDialog
      open={open}
      onClose={onClose}
      settings={aiSettings}
      providerOptions={LIVE_PROVIDER_OPTIONS}
      onSave={handleSave}
      onTest={() => void handleTest()}
      testResult={testResult}
      testing={testing}
    />
  );
}
