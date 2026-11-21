import { AiProviderError } from '../../ai';
import { analyzeRequirements } from '../../analysis';
import type * as AnalysisModule from '../../analysis';
import type { ScopingSession } from '../../domain';
import { applicationModernizationScenario } from '../../seed';
import { runFullPipeline } from '../../test/pipelineHarness';
import { ANALYSIS_PATH_ISSUE_CODE, runAnalysis } from './analysis';
import { createFakeStore } from './testSupport';

vi.mock('../../analysis', async (importOriginal) => {
  const actual = await importOriginal<typeof AnalysisModule>();
  return { ...actual, analyzeRequirements: vi.fn(actual.analyzeRequirements) };
});

const analyzeMock = vi.mocked(analyzeRequirements);

let generated: ScopingSession;

beforeAll(async () => {
  const session = await runFullPipeline(applicationModernizationScenario);
  generated = { ...session, executiveSummary: 'An earlier summary.' };
});

beforeEach(() => {
  analyzeMock.mockClear();
});

describe('runAnalysis', () => {
  it('stops with an error notice that lists the input issues when the text is not usable', async () => {
    const store = createFakeStore({ ...generated, input: { ...generated.input, rawText: 'too short' } });
    await runAnalysis(store.deps);

    expect(analyzeMock).not.toHaveBeenCalled();
    expect(store.notices().at(0)).toMatchObject({ tone: 'error', title: 'Requirements cannot be analyzed yet' });
    expect(store.notices().at(0)?.message).toContain('characters');
    expect(store.activeSession()?.outputs).toBe(generated.outputs);
  });

  it('stores the scope and resets every downstream deliverable, the change log, quality and summary', async () => {
    const store = createFakeStore(generated, { lagging: true });
    await runAnalysis(store.deps);

    const session = store.activeSession();
    expect(session?.scope?.items.length).toBeGreaterThan(5);
    expect(session?.scope?.approvedVersion).toBeNull();
    expect(session?.input.normalized?.wordCount).toBeGreaterThan(50);
    expect(session?.outputs.prd).toEqual({ data: null, status: 'empty', reviewed: false, meta: null, staleReasons: [] });
    expect(session?.outputs.estimate.data).toBeNull();
    expect(session?.changeLog).toEqual([]);
    expect(session?.quality).toBeNull();
    expect(session?.executiveSummary).toBe('');
    expect(store.state().busy).toBeNull();
  });

  it('says how many items were extracted and that the recorded seeded response produced them', async () => {
    const store = createFakeStore(generated);
    await runAnalysis(store.deps);

    const notice = store.notices().at(0);
    expect(notice?.tone).toBe('success');
    expect(notice?.message).toMatch(/Extracted \d+ requirements, \d+ clarification questions and \d+ gaps\./);
    expect(notice?.message).toContain('Mock AI');
    expect(notice?.message).toContain('recorded response for this seeded scenario');
    expect(store.activeSession()?.scope?.issues.at(0)?.code).toBe(ANALYSIS_PATH_ISSUE_CODE);
  });

  it('says that custom text was analysed by the deterministic heuristic engine', async () => {
    const rawText = `${applicationModernizationScenario.requirementsText}\nThe portal must also support Spanish.`;
    const store = createFakeStore({ ...generated, input: { ...generated.input, rawText, scenarioId: null } });
    await runAnalysis(store.deps);

    expect(store.notices().at(0)?.message).toContain('deterministic heuristic analysis engine for custom text');
  });

  it('warns when live AI failed and clearly-labelled mock output was used', async () => {
    analyzeMock.mockImplementationOnce(async (input, run) => {
      const actual = await vi.importActual<typeof AnalysisModule>('../../analysis');
      const result = await actual.analyzeRequirements(input, run);
      const fallbackIssue = { severity: 'warning' as const, code: 'live-fallback', message: 'The live AI provider could not produce a usable result (rate limited).', refs: [] };
      return { scope: result.scope, meta: { ...result.meta, usedFallback: true, issues: [fallbackIssue] } };
    });
    const store = createFakeStore(generated);
    await runAnalysis(store.deps);

    expect(store.notices().map((notice) => notice.tone)).toEqual(['success', 'warning']);
    expect(store.notices().at(1)?.message).toContain('rate limited');
    expect(store.notices().at(1)?.message).toContain('Mock AI');
  });

  it('converts a provider failure into an error notice and keeps the session as it was', async () => {
    analyzeMock.mockRejectedValueOnce(new AiProviderError('rate-limit', 'HTTP 429'));
    const store = createFakeStore(generated);
    await expect(runAnalysis(store.deps)).resolves.toBeUndefined();

    expect(store.notices().at(0)).toMatchObject({ tone: 'error', title: 'Analysis failed' });
    expect(store.notices().at(0)?.message).toContain('rate-limited');
    expect(store.activeSession()).toBe(generated);
    expect(store.state().busy).toBeNull();
  });

  it('raises a notice when there is no active session', async () => {
    const store = createFakeStore(null);
    await runAnalysis(store.deps);
    expect(store.notices().at(0)?.title).toBe('No active session');
  });
});
