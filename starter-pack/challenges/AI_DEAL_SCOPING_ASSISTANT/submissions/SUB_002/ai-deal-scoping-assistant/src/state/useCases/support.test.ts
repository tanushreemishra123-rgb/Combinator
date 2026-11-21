import { AiProviderError } from '../../ai';
import { IngestionError } from '../../ingestion';
import { ScopeItemNotFoundError } from '../../scope';
import { fixtureSession } from '../../test/fixtures';
import { describeError, requireActiveSession, runBusy, runGuarded, saveSession, UseCaseError } from './support';
import { createFakeStore, TEST_NOW } from './testSupport';

describe('describeError', () => {
  it('uses kind-specific wording for every AI provider failure', () => {
    expect(describeError(new AiProviderError('auth', 'raw'))).toContain('rejected the API key');
    expect(describeError(new AiProviderError('rate-limit', 'raw'))).toContain('rate-limited');
    expect(describeError(new AiProviderError('network', 'raw'))).toContain('could not be reached');
    expect(describeError(new AiProviderError('timeout', 'raw'))).toContain('did not respond in time');
    expect(describeError(new AiProviderError('invalid-response', 'raw'))).toContain('could not be used');
    expect(describeError(new AiProviderError('provider', 'raw'))).toContain('server error');
  });

  it('shows reviewer-facing messages as written and hides technical ones', () => {
    expect(describeError(new IngestionError('empty', 'The file is empty.'))).toBe('The file is empty.');
    expect(describeError(new ScopeItemNotFoundError('FR_99'))).toContain('FR_99');
    expect(describeError(new UseCaseError('Do this first.'))).toBe('Do this first.');
    const technical = describeError(new TypeError('x is not a function'));
    expect(technical).toContain('TypeError');
    expect(technical).not.toContain('is not a function');
    expect(describeError('boom')).toContain('unknown error');
  });
});

describe('store helpers', () => {
  it('raises a notice when there is no active session', () => {
    const store = createFakeStore(null);
    expect(requireActiveSession(store.deps)).toBeNull();
    expect(store.notices().at(0)).toMatchObject({ tone: 'error', title: 'No active session' });
  });

  it('stamps updatedAt when saving', () => {
    const store = createFakeStore(fixtureSession());
    const saved = saveSession(store.deps, { ...fixtureSession(), name: 'Renamed' });
    expect(saved.updatedAt).toBe(TEST_NOW);
    expect(store.activeSession()?.name).toBe('Renamed');
  });

  it('always ends the busy state and converts a rejection into an error notice', async () => {
    const store = createFakeStore(fixtureSession());
    const result = await runBusy(store.deps, { label: 'Working...', stageId: 'prd', errorTitle: 'Failed', fallback: 'fallback' }, async () => {
      expect(store.state().busy).toEqual({ label: 'Working...', stageId: 'prd' });
      throw new AiProviderError('network', 'raw');
    });
    expect(result).toBe('fallback');
    expect(store.state().busy).toBeNull();
    expect(store.notices().at(0)).toMatchObject({ tone: 'error', title: 'Failed' });
  });

  it('converts a synchronous failure into an error notice', () => {
    const store = createFakeStore(fixtureSession());
    const result = runGuarded(store.deps, 'Failed', 0, () => {
      throw new UseCaseError('Not possible yet.');
    });
    expect(result).toBe(0);
    expect(store.notices().at(0)?.message).toBe('Not possible yet.');
  });
});
