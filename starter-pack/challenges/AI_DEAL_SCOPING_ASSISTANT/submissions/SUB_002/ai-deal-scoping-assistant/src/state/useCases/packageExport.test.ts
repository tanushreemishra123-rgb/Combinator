import type { ScopingSession } from '../../domain';
import { downloadFile } from '../../export';
import type * as ExportModule from '../../export';
import { applicationModernizationScenario } from '../../seed';
import { runFullPipeline } from '../../test/pipelineHarness';
import { exportPackage, exportWorkspace, refreshExecutiveSummary } from './packageExport';
import { runQuality } from './quality';
import { createFakeStore } from './testSupport';

vi.mock('../../export', async (importOriginal) => {
  const actual = await importOriginal<typeof ExportModule>();
  return { ...actual, downloadFile: vi.fn() };
});

const downloadMock = vi.mocked(downloadFile);

let generated: ScopingSession;
let unchecked: ScopingSession;

beforeAll(async () => {
  const pipelineResult = await runFullPipeline(applicationModernizationScenario);
  // The pipeline harness stamps `quality.ranAt` with a fixed past timestamp while each section's
  // `meta.generatedAt` is the real wall-clock time of this test run; reset `ranAt` to now so this
  // fixture's report is genuinely current (as it always is in the app, where both come from the
  // same clock), rather than looking stale to `selectIsQualityReportOutdated` by construction.
  const { quality } = pipelineResult;
  generated = quality === null ? pipelineResult : { ...pipelineResult, quality: { ...quality, ranAt: new Date().toISOString() } };
  unchecked = { ...generated, quality: null };
});

beforeEach(() => {
  downloadMock.mockReset();
});

describe('exportPackage', () => {
  it('runs the quality gate first, downloads Markdown and names the export status', async () => {
    const store = createFakeStore(unchecked, { lagging: true });
    const status = await exportPackage(store.deps, 'markdown');

    const quality = store.activeSession()?.quality;
    expect(quality).not.toBeNull();
    expect(status).toBe(quality?.summary.exportStatus);

    const [fileName, content, mimeType] = downloadMock.mock.calls.at(0) ?? [];
    expect(fileName).toMatch(/\.md$/);
    expect(mimeType).toBe('text/markdown');
    expect(content).toContain(`**Export status:** ${status}`);
    expect(content).toContain('Mock AI mode');
    expect(store.notices().at(-1)?.message).toContain(`export status: ${status}`);
    expect(store.state().busy).toBeNull();
  });

  it('labels an export that still needs review as a draft', async () => {
    const quality = generated.quality;
    if (quality === null) {
      throw new Error('the pipeline harness runs the quality gate');
    }
    const needsReview = { ...generated, quality: { ...quality, summary: { ...quality.summary, exportStatus: 'Review Required' as const } } };
    const store = createFakeStore(needsReview);
    expect(await exportPackage(store.deps, 'markdown')).toBe('Review Required');
    expect(store.notices().at(-1)).toMatchObject({ tone: 'warning', title: 'Scoping package exported as draft' });
    expect(store.notices().at(-1)?.message).toContain('Exported as draft');
    expect(store.notices().at(-1)?.message).toContain('export status: Review Required');

    const ready = createFakeStore({ ...needsReview, quality: { ...quality, summary: { ...quality.summary, exportStatus: 'Ready' as const } } });
    expect(await exportPackage(ready.deps, 'markdown')).toBe('Ready');
    expect(ready.notices().at(-1)).toMatchObject({ tone: 'success', title: 'Scoping package exported' });
  });

  it('keeps an existing quality report and uses the right MIME type for every format', async () => {
    const store = createFakeStore(generated);
    await exportPackage(store.deps, 'html');
    await exportPackage(store.deps, 'docx');
    await exportPackage(store.deps, 'json');

    expect(store.activeSession()).toBe(generated);
    expect(downloadMock.mock.calls.map((call) => call.at(2))).toEqual([
      'text/html',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/json',
    ]);
    expect(downloadMock.mock.calls.map((call) => call.at(0))).toEqual([
      expect.stringMatching(/\.html$/),
      expect.stringMatching(/\.docx$/),
      expect.stringMatching(/\.json$/),
    ]);
    expect(downloadMock.mock.calls.at(0)?.at(1)).toContain('<svg');
    expect(downloadMock.mock.calls.at(1)?.at(1)).toBeInstanceOf(Uint8Array);
    expect(JSON.parse(String(downloadMock.mock.calls.at(2)?.at(1)))).toMatchObject({ id: generated.id });
  });

  it('recomputes the quality gate when the cached report is stale instead of exporting it as-is', async () => {
    const quality = generated.quality;
    if (quality === null) {
      throw new Error('the pipeline harness runs the quality gate');
    }
    // Simulate a scope edit after the cached report ran: the report is now stale even though it is
    // not null, so the export must not reuse its (now outdated) summary or scopeVersion.
    const stale: ScopingSession = {
      ...generated,
      scope: generated.scope === null ? null : { ...generated.scope, version: generated.scope.version + 1 },
    };
    const store = createFakeStore(stale);
    await exportPackage(store.deps, 'markdown');

    const session = store.activeSession();
    expect(session).not.toBe(stale);
    expect(session?.quality?.scopeVersion).toBe(stale.scope?.version);
    expect(session?.quality?.ranAt).toBe(store.deps.now());
    expect(session?.quality).not.toBe(quality);
  });

  it('converts a failed download into an error notice and returns null', async () => {
    downloadMock.mockImplementationOnce(() => {
      throw new Error('blocked by the browser');
    });
    const store = createFakeStore(generated);
    expect(await exportPackage(store.deps, 'markdown')).toBeNull();
    expect(store.notices().at(-1)).toMatchObject({ tone: 'error', title: 'Export failed' });
    expect(store.state().busy).toBeNull();
  });

  it('raises a notice when there is no active session', async () => {
    const store = createFakeStore(null);
    expect(await exportPackage(store.deps, 'markdown')).toBeNull();
    exportWorkspace(store.deps);
    await refreshExecutiveSummary(store.deps);
    runQuality(store.deps);
    expect(downloadMock).not.toHaveBeenCalled();
    expect(store.notices().map((notice) => notice.title)).toEqual(Array.from({ length: 4 }, () => 'No active session'));
  });
});

describe('exportWorkspace', () => {
  it('downloads the active session as workspace JSON', () => {
    const store = createFakeStore(generated);
    exportWorkspace(store.deps);

    const [fileName, content, mimeType] = downloadMock.mock.calls.at(0) ?? [];
    expect(fileName).toMatch(/\.json$/);
    expect(mimeType).toBe('application/json');
    expect(JSON.parse(String(content))).toMatchObject({ id: generated.id, name: generated.name });
    expect(store.notices().at(0)?.tone).toBe('success');
  });

  it('exports a session by id directly, without first making it the active session', () => {
    const store = createFakeStore(generated);
    const other = { ...generated, id: 'session-other', name: 'Other session' };
    store.deps.dispatch({ type: 'UPSERT_SESSION', session: other });

    exportWorkspace(store.deps, other.id);

    expect(store.activeSession()?.id).toBe(generated.id);
    const [, content] = downloadMock.mock.calls.at(0) ?? [];
    expect(JSON.parse(String(content))).toMatchObject({ id: other.id, name: other.name });
  });

  it('reports an error notice for an id that names no session', () => {
    const store = createFakeStore(generated);
    exportWorkspace(store.deps, 'no-such-session');

    expect(downloadMock).not.toHaveBeenCalled();
    expect(store.notices().at(0)).toMatchObject({ tone: 'error', title: 'Workspace export failed' });
  });
});

describe('refreshExecutiveSummary', () => {
  it('writes the executive summary and says which path produced it', async () => {
    const store = createFakeStore(generated);
    await refreshExecutiveSummary(store.deps);

    expect(store.activeSession()?.executiveSummary.length).toBeGreaterThan(100);
    expect(store.activeSession()?.outputs).toBe(generated.outputs);
    expect(store.notices().at(0)?.message).toContain('Mock AI');
    expect(store.state().busy).toBeNull();
  });
});

describe('runQuality', () => {
  it('saves the quality report and announces the export status', () => {
    const store = createFakeStore(unchecked);
    runQuality(store.deps);

    const quality = store.activeSession()?.quality;
    expect(quality?.checks).toHaveLength(12);
    expect(quality?.ranAt).toBe(store.deps.now());
    expect(store.notices().at(0)?.title).toBe('Quality gate completed');
    expect(store.notices().at(0)?.message).toContain(`Export status: ${quality?.summary.exportStatus}`);
  });
});
