import { toWorkspaceJson } from '../../export';
import { fixtureSession } from '../../test/fixtures';
import { importSession } from './sessions';
import { createFakeStore } from './testSupport';

describe('importSession', () => {
  it('imports a valid workspace file, assigns a fresh id and makes it active', async () => {
    const file = new File([toWorkspaceJson(fixtureSession())], 'workspace.json', { type: 'application/json' });
    const store = createFakeStore(null);

    const result = await importSession(store.deps, file);

    expect(result.ok).toBe(true);
    expect(store.activeSession()?.name).toBe(fixtureSession().name);
    expect(store.notices().at(0)).toMatchObject({ tone: 'success', title: 'Session imported' });
  });

  it('reports invalid JSON as a readable notice instead of throwing', async () => {
    const file = new File(['not json'], 'workspace.json', { type: 'application/json' });
    const store = createFakeStore(null);

    const result = await importSession(store.deps, file);

    expect(result.ok).toBe(false);
    expect(store.notices().at(0)).toMatchObject({ tone: 'error', title: 'Import failed' });
    expect(store.activeSession()).toBeNull();
  });

  it('surfaces a notice, not an unhandled rejection, when the file itself cannot be read', async () => {
    const file = new File(['irrelevant'], 'workspace.json', { type: 'application/json' });
    vi.spyOn(file, 'text').mockRejectedValue(new Error('the file was removed'));
    const store = createFakeStore(null);

    const result = await importSession(store.deps, file);

    expect(result).toEqual({ ok: false, errors: ['The file could not be read.'] });
    expect(store.notices().at(0)).toMatchObject({ tone: 'error', title: 'Import failed', message: 'The file could not be read.' });
  });
});
