/** AI mode settings use cases: persist a settings change and run a live-connection test. */
import { saveAiSettings, testLiveConnection } from '../../ai';
import type { AiSettings } from '../../ai';
import type { UseCaseDeps } from '../types';
import { makeNotice } from './notices';

export function updateAiSettings(deps: UseCaseDeps, settings: AiSettings): void {
  saveAiSettings(settings);
  deps.dispatch({ type: 'UPDATE_AI_SETTINGS', settings });
}

/** Sends a small test prompt through the configured live provider and reports the outcome as a notice. */
export async function runConnectionTest(deps: UseCaseDeps): Promise<{ ok: boolean; message: string }> {
  deps.dispatch({ type: 'START_BUSY', label: 'Testing the connection...', stageId: null });
  try {
    const result = await testLiveConnection(deps.getState().aiSettings);
    const tone = result.ok ? 'success' : 'error';
    const title = result.ok ? 'Connection succeeded' : 'Connection failed';
    deps.dispatch({ type: 'ADD_NOTICE', notice: makeNotice(tone, title, result.message) });
    return result;
  } finally {
    deps.dispatch({ type: 'END_BUSY' });
  }
}
