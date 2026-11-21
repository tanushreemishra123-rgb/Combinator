import { aiEnabledScenario } from '../../seed';
import { addUploadedFile, setCustomerContext, setRequirementsText } from './input';
import { createSessionFromScenario } from './sessions';
import { createFakeStore, TEST_NOW } from './testSupport';
import type { FakeStore } from './testSupport';

function storeWithScenario(): FakeStore {
  const store = createFakeStore(null);
  createSessionFromScenario(store.deps, aiEnabledScenario.id);
  return store;
}

describe('setRequirementsText', () => {
  it('keeps the seed-scenario link only while the text is the unedited seed text', () => {
    const store = storeWithScenario();
    setRequirementsText(store.deps, aiEnabledScenario.requirementsText);
    expect(store.activeSession()?.input.scenarioId).toBe(aiEnabledScenario.id);

    setRequirementsText(store.deps, `${aiEnabledScenario.requirementsText}\nOne more requirement.`);
    expect(store.activeSession()?.input.scenarioId).toBeNull();
    expect(store.activeSession()?.input.rawText).toContain('One more requirement.');
    expect(store.activeSession()?.updatedAt).toBe(TEST_NOW);

    setRequirementsText(store.deps, aiEnabledScenario.requirementsText);
    expect(store.activeSession()?.input.scenarioId).toBeNull();
  });

  it('raises a notice when there is no active session', () => {
    const store = createFakeStore(null);
    setRequirementsText(store.deps, 'text');
    setCustomerContext(store.deps, { industry: 'Retail' });
    expect(store.notices().map((notice) => notice.title)).toEqual(['No active session', 'No active session']);
  });
});

describe('setCustomerContext', () => {
  it('merges a partial edit into the customer context', () => {
    const store = storeWithScenario();
    setCustomerContext(store.deps, { region: 'EMEA' });
    expect(store.activeSession()?.customer.region).toBe('EMEA');
    expect(store.activeSession()?.customer.customerName).toBe(aiEnabledScenario.customer.customerName);
  });
});

describe('addUploadedFile', () => {
  it('appends the document text under its own heading and records the document', async () => {
    const store = storeWithScenario();
    await addUploadedFile(store.deps, new File(['The portal must support Spanish.'], 'addendum.txt', { type: 'text/plain' }));

    const input = store.activeSession()?.input;
    expect(input?.rawText.startsWith(aiEnabledScenario.requirementsText)).toBe(true);
    expect(input?.rawText).toContain('\n\n# Uploaded document: addendum.txt\nThe portal must support Spanish.');
    expect(input?.documents).toEqual([{ name: 'addendum.txt', format: 'text', characters: 32, addedAt: TEST_NOW }]);
    expect(input?.scenarioId).toBeNull();
    expect(store.state().busy).toBeNull();
    expect(store.notices().at(-1)?.tone).toBe('success');
  });

  it('starts the text with the heading when nothing was pasted yet', async () => {
    const store = storeWithScenario();
    setRequirementsText(store.deps, '');
    await addUploadedFile(store.deps, new File(['Body'], 'notes.md', { type: 'text/markdown' }));
    expect(store.activeSession()?.input.rawText).toBe('# Uploaded document: notes.md\nBody');
  });

  it('turns an ingestion error into an error notice and leaves the text untouched', async () => {
    const store = storeWithScenario();
    await addUploadedFile(store.deps, new File(['binary'], 'diagram.png', { type: 'image/png' }));

    expect(store.activeSession()?.input.rawText).toBe(aiEnabledScenario.requirementsText);
    expect(store.notices().at(-1)).toMatchObject({ tone: 'error', title: 'Upload failed' });
    expect(store.notices().at(-1)?.message).toContain('not a supported file type');
    expect(store.state().busy).toBeNull();
  });

  it('raises a notice when there is no active session', async () => {
    const store = createFakeStore(null);
    await addUploadedFile(store.deps, new File(['text'], 'a.txt'));
    expect(store.notices().at(0)?.title).toBe('No active session');
  });
});
