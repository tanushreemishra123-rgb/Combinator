import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AdminMissionDoc } from '@ai-learning-adventure/types';
import {
  apiErrorResponse,
  exportBundle,
  getContent,
  installApiInterceptor,
  listContent,
  saveContent,
  seedStatus,
} from './helpers/api.ts';
import {
  firstMission,
  makeImportBundle,
  makeMissionDoc,
  seededMissions,
} from './helpers/fixtures.ts';
import { integrationTestContext } from './helpers/setup.ts';

const testContext = integrationTestContext();

async function waitForSettings(): Promise<void> {
  await screen.findByRole('heading', { level: 1, name: 'Settings' });
  await screen.findByRole('heading', { level: 2, name: 'Seed content' });
  await screen.findByText(/missions · .*questions · .*flashcards · .*awards/);
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error('Settings file input was not rendered.');
  return input;
}

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Blob could not be read.'));
    reader.readAsText(blob);
  });
}

function installDownloadSpies() {
  let capturedBlob: Blob | undefined;
  let downloadName: string | undefined;
  const createObjectURL = vi.fn((blob: Blob) => {
    capturedBlob = blob;
    return 'blob:admin-integration-export';
  });
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloadName = this.download;
  });
  return {
    createObjectURL,
    revokeObjectURL,
    click,
    blob: () => capturedBlob,
    filename: () => downloadName,
  };
}

describe('settings and content data', () => {
  it('SET-01 renders seed counts and integrity checks from the backend', async () => {
    const runtime = await testContext.create({ route: '/settings' });
    const expected = await seedStatus(runtime);
    await waitForSettings();

    expect(
      screen.getByText(
        `${expected.counts.missions} missions · ${expected.counts.questions} questions · ${expected.counts.flashcards} flashcards · ${expected.counts.awards} awards`,
      ),
    ).toBeDefined();
    for (const row of expected.integrity.slice(0, 2)) {
      expect(screen.getByText(row.title || row.missionId)).toBeDefined();
    }
  });

  it('SET-02 cancels seed reload without changing admin content', async () => {
    const runtime = await testContext.create({ route: '/settings', deferRender: true });
    const item = await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id);
    await saveContent(
      runtime,
      'mission',
      item.id,
      { ...item.doc, title: 'Locally edited seed mission' },
      item.revision,
    );
    testContext.mount(runtime);
    const user = userEvent.setup();
    await waitForSettings();

    await user.click(screen.getByRole('button', { name: 'Reload seed pack' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reload the seed pack?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect((await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id)).doc.title).toBe(
      'Locally edited seed mission',
    );
  });

  it('SET-03 confirms seed reload and replaces admin edits', async () => {
    const runtime = await testContext.create({ route: '/settings', deferRender: true });
    const item = await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id);
    await saveContent(
      runtime,
      'mission',
      item.id,
      { ...item.doc, title: 'Mission replaced by seed reload' },
      item.revision,
    );
    testContext.mount(runtime);
    const user = userEvent.setup();
    await waitForSettings();

    await user.click(screen.getByRole('button', { name: 'Reload seed pack' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reload the seed pack?' });
    await user.click(within(dialog).getByRole('button', { name: 'Reload seed pack' }));

    await waitFor(async () => {
      expect((await getContent<AdminMissionDoc>(runtime, 'mission', firstMission.id)).doc.title).toBe(firstMission.title);
    });
    expect(screen.queryByRole('dialog', { name: 'Reload the seed pack?' })).toBeNull();
  });

  it('SET-04 exports the current content bundle with the expected filename', async () => {
    const runtime = await testContext.create({ route: '/settings' });
    const user = userEvent.setup();
    const download = installDownloadSpies();
    await waitForSettings();

    await user.click(screen.getByRole('button', { name: 'Export bundle' }));

    await waitFor(() => expect(download.click).toHaveBeenCalledTimes(1));
    expect(download.filename()).toBe('ai-quest-content-bundle.json');
    const blob = download.blob();
    if (blob === undefined) throw new Error('Export did not create a Blob.');
    const exported = JSON.parse(await readBlob(blob)) as { missions: AdminMissionDoc[] };
    expect(exported.missions).toHaveLength(seededMissions.length);
    expect(exported.missions.some((mission) => mission.id === firstMission.id)).toBe(true);
    expect(download.revokeObjectURL).toHaveBeenCalledWith('blob:admin-integration-export');
    expect(runtime.serverLog).toContain('GET /api/v1/admin/content/export');
  });

  it('SET-05 previews a valid merge import without mutating content', async () => {
    const runtime = await testContext.create({ route: '/settings' });
    const user = userEvent.setup();
    await waitForSettings();
    const imported = makeMissionDoc('mission-import-dry-run', {
      slug: 'integration-import-dry-run',
      title: 'Dry-run imported mission',
    });
    const file = new File(
      [JSON.stringify(makeImportBundle({ missions: [imported] }))],
      'merge-bundle.json',
      { type: 'application/json' },
    );

    await user.upload(fileInput(), file);

    expect(await screen.findByRole('heading', { level: 3, name: 'Dry run' })).toBeDefined();
    const missionRow = screen.getByRole('row', { name: /mission\s+1\s+0\s+0\s+0/i });
    expect(missionRow).toBeDefined();
    expect((await listContent(runtime, 'mission')).items.some((item) => item.id === imported.id)).toBe(false);
    expect(screen.getByRole('button', { name: 'Apply import' }).hasAttribute('disabled')).toBe(false);
  });

  it('SET-06 reruns a dry run with replace mode selected', async () => {
    const runtime = await testContext.create({ route: '/settings', deferRender: true });
    const observedModes: string[] = [];
    const interceptor = installApiInterceptor(runtime);
    interceptor.block(
      (url, init) => url.endsWith('/api/v1/admin/content/import') && init?.method === 'POST',
      (url, init) => {
        observedModes.push((JSON.parse(String(init?.body)) as { mode: string }).mode);
        return runtime.apiFetch(url, init);
      },
    );
    testContext.mount(runtime);
    const user = userEvent.setup();
    await waitForSettings();
    const bundle = makeImportBundle({
      missions: [makeMissionDoc('mission-replace-dry-run', { slug: 'replace-dry-run' })],
    });

    await user.upload(fileInput(), new File([JSON.stringify(bundle)], 'replace-1.json', { type: 'application/json' }));
    await screen.findByRole('heading', { level: 3, name: 'Dry run' });
    await user.click(screen.getByRole('radio', { name: /Replace/ }));
    await user.upload(fileInput(), new File([JSON.stringify(bundle)], 'replace-2.json', { type: 'application/json' }));

    await waitFor(() => expect(observedModes.at(-1)).toBe('replace'));
    expect((await listContent(runtime, 'mission')).items.some((item) => item.id === 'mission-replace-dry-run')).toBe(false);
  });

  it('SET-07 applies a validated import and creates draft inventory content', async () => {
    const runtime = await testContext.create({ route: '/settings' });
    const user = userEvent.setup();
    await waitForSettings();
    const imported = makeMissionDoc('mission-applied-import', {
      slug: 'applied-integration-import',
      title: 'Applied imported mission',
    });
    const file = new File(
      [JSON.stringify(makeImportBundle({ missions: [imported] }))],
      'applied-bundle.json',
      { type: 'application/json' },
    );
    await user.upload(fileInput(), file);
    await screen.findByRole('heading', { level: 3, name: 'Dry run' });

    await user.click(screen.getByRole('button', { name: 'Apply import' }));

    expect(await screen.findByRole('heading', { level: 3, name: 'Import result' })).toBeDefined();
    const persisted = await getContent<AdminMissionDoc>(runtime, 'mission', imported.id);
    expect(persisted.doc.title).toBe('Applied imported mission');
    expect(persisted.status).toBe('draft');
  });

  it('SET-08 rejects invalid JSON without sending an import request', async () => {
    const runtime = await testContext.create({ route: '/settings' });
    const user = userEvent.setup();
    await waitForSettings();
    const before = runtime.serverLog.filter((entry) => entry === 'POST /api/v1/admin/content/import').length;

    await user.upload(fileInput(), new File(['{ not-json'], 'invalid.json', { type: 'application/json' }));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'The file is not valid JSON.');
    expect(runtime.serverLog.filter((entry) => entry === 'POST /api/v1/admin/content/import')).toHaveLength(before);
  });

  it('SET-09 reports structurally invalid bundle entities without mutating content', async () => {
    const runtime = await testContext.create({ route: '/settings' });
    const user = userEvent.setup();
    await waitForSettings();
    const invalid = makeMissionDoc('mission-invalid-import', {
      slug: 'invalid-import',
      title: '',
    });

    await user.upload(
      fileInput(),
      new File([JSON.stringify(makeImportBundle({ missions: [invalid] }))], 'invalid-bundle.json', {
        type: 'application/json',
      }),
    );

    const report = await screen.findByRole('heading', { level: 3, name: 'Dry run' });
    expect(report.parentElement?.textContent).toContain('Mission title is required.');
    expect((await listContent(runtime, 'mission')).items.some((item) => item.id === invalid.id)).toBe(false);
  });

  it('SET-10 presents import failure and preserves existing content', async () => {
    const runtime = await testContext.create({ route: '/settings', deferRender: true });
    const totalBefore = (await listContent(runtime, 'mission')).total;
    const interceptor = installApiInterceptor(runtime);
    interceptor.block(
      (url, init) => url.endsWith('/api/v1/admin/content/import') && init?.method === 'POST',
      () => apiErrorResponse(503, 'import_unavailable', 'Import service is temporarily unavailable.'),
    );
    testContext.mount(runtime);
    const user = userEvent.setup();
    await waitForSettings();
    const bundle = makeImportBundle({
      missions: [makeMissionDoc('mission-failed-import', { slug: 'failed-import' })],
    });

    await user.upload(
      fileInput(),
      new File([JSON.stringify(bundle)], 'failed-import.json', { type: 'application/json' }),
    );

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Import service is temporarily unavailable.',
    );
    expect((await listContent(runtime, 'mission')).total).toBe(totalBefore);
  });

  it('SET-11 presents export failure and does not trigger a download', async () => {
    const runtime = await testContext.create({ route: '/settings' });
    const user = userEvent.setup();
    const download = installDownloadSpies();
    await waitForSettings();
    const interceptor = installApiInterceptor(runtime);
    interceptor.block(
      (url, init) => url.endsWith('/api/v1/admin/content/export') && (init?.method ?? 'GET') === 'GET',
      () => apiErrorResponse(503, 'export_unavailable', 'Export service is temporarily unavailable.'),
    );

    await user.click(screen.getByRole('button', { name: 'Export bundle' }));

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Export service is temporarily unavailable.',
    );
    expect(download.click).not.toHaveBeenCalled();
  });
});
