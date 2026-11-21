import { AiProviderError, defaultAiSettings, resolveRunOptions } from '../../ai';
import { generateArchitecture } from '../../architecture';
import type * as ArchitectureModule from '../../architecture';
import type { ScopingSession } from '../../domain';
import { generateEstimate } from '../../estimation';
import type * as EstimationModule from '../../estimation';
import { applyImpactReport, createImpactReport, describeChanges } from '../../impact';
import { generatePrd } from '../../prd';
import type * as PrdModule from '../../prd';
import { aiEnabledScenario, applicationModernizationScenario } from '../../seed';
import { generateAiStrategy, generateDataIntegration } from '../../strategy';
import type * as StrategyModule from '../../strategy';
import { fixtureSession } from '../../test/fixtures';
import { analyseAndApprove, runFullPipeline } from '../../test/pipelineHarness';
import { generateAll, generateStage, regenerateStale, setStageReviewed } from './generation';
import { createFakeStore, TEST_NOW } from './testSupport';

vi.mock('../../prd', async (importOriginal) => {
  const actual = await importOriginal<typeof PrdModule>();
  return { ...actual, generatePrd: vi.fn(actual.generatePrd) };
});
vi.mock('../../architecture', async (importOriginal) => {
  const actual = await importOriginal<typeof ArchitectureModule>();
  return { ...actual, generateArchitecture: vi.fn(actual.generateArchitecture) };
});
vi.mock('../../strategy', async (importOriginal) => {
  const actual = await importOriginal<typeof StrategyModule>();
  return { ...actual, generateDataIntegration: vi.fn(actual.generateDataIntegration), generateAiStrategy: vi.fn(actual.generateAiStrategy) };
});
vi.mock('../../estimation', async (importOriginal) => {
  const actual = await importOriginal<typeof EstimationModule>();
  return { ...actual, generateEstimate: vi.fn(actual.generateEstimate) };
});

const prdMock = vi.mocked(generatePrd);
const architectureMock = vi.mocked(generateArchitecture);
const dataIntegrationMock = vi.mocked(generateDataIntegration);
const aiStrategyMock = vi.mocked(generateAiStrategy);
const estimateMock = vi.mocked(generateEstimate);

let approved: ScopingSession;
let generated: ScopingSession;

beforeAll(async () => {
  approved = await analyseAndApprove(aiEnabledScenario);
  generated = await runFullPipeline(applicationModernizationScenario);
});

beforeEach(() => {
  vi.clearAllMocks();
});

function busyLabels(actions: readonly { type: string; label?: string }[]): string[] {
  return actions.flatMap((action) => (action.type === 'START_BUSY' && action.label !== undefined ? [action.label] : []));
}

function markStale(session: ScopingSession, stages: readonly ('architecture' | 'dataIntegration' | 'estimate')[]): ScopingSession {
  const { outputs } = session;
  return {
    ...session,
    outputs: {
      ...outputs,
      architecture: stages.includes('architecture') ? { ...outputs.architecture, status: 'stale', reviewed: true, staleReasons: ['Expected users changed'] } : outputs.architecture,
      dataIntegration: stages.includes('dataIntegration') ? { ...outputs.dataIntegration, status: 'stale', staleReasons: ['Expected users changed'] } : outputs.dataIntegration,
      estimate: stages.includes('estimate') ? { ...outputs.estimate, status: 'stale', staleReasons: ['Expected users changed'] } : outputs.estimate,
    },
  };
}

/** A session whose estimate is stale only because of a logged contingency change (engine-only refresh). */
async function withPendingRecalculation(session: ScopingSession): Promise<ScopingSession> {
  const after = { ...session, estimationConfig: { ...session.estimationConfig, contingencyPct: session.estimationConfig.contingencyPct + 5 } };
  const change = describeChanges(session, after).at(0);
  if (change === undefined) {
    throw new Error('a contingency change was expected');
  }
  const report = await createImpactReport(after, change, resolveRunOptions(defaultAiSettings(), 1), TEST_NOW);
  return applyImpactReport(after, report);
}

describe('generateStage', () => {
  it('refuses with the prerequisite message until the requirements are approved', async () => {
    const session = fixtureSession();
    const store = createFakeStore({ ...session, scope: session.scope === null ? null : { ...session.scope, approvedVersion: null } });
    await generateStage(store.deps, 'prd');

    expect(prdMock).not.toHaveBeenCalled();
    expect(store.notices().at(0)).toMatchObject({ tone: 'error', message: 'Approve the requirements before generating deliverables.' });
    expect(store.actions.some((action) => action.type === 'START_BUSY')).toBe(false);
  });

  it('names the missing upstream deliverable', async () => {
    const store = createFakeStore(approved);
    await generateStage(store.deps, 'architecture');
    expect(store.notices().at(0)?.message).toBe('Generate the PRD before designing the solution.');
  });

  it('writes a current, unreviewed section with its generation meta and clears the quality report', async () => {
    const store = createFakeStore({ ...approved, quality: generated.quality });
    await generateStage(store.deps, 'prd');

    const prd = store.activeSession()?.outputs.prd;
    expect(prd).toMatchObject({ status: 'current', reviewed: false, staleReasons: [] });
    expect(prd?.data?.functionalScope.capabilities.length).toBeGreaterThan(0);
    expect(prd?.meta).toMatchObject({ mode: 'mock', usedFallback: false, scopeVersion: approved.scope?.version });
    expect(store.activeSession()?.quality).toBeNull();
    expect(busyLabels(store.actions)).toEqual(['Generating the PRD...']);
    expect(store.actions.at(-2)?.type).toBe('END_BUSY');
    expect(store.notices().at(0)).toMatchObject({ tone: 'success', title: 'PRD and functional scope generated' });
    expect(store.notices().at(0)?.message).toContain('Mock AI');
  });

  it('warns when live AI failed and mock output was used', async () => {
    prdMock.mockImplementationOnce(async (input, run) => {
      const actual = await vi.importActual<typeof PrdModule>('../../prd');
      const result = await actual.generatePrd(input, run);
      return { bundle: result.bundle, meta: { ...result.meta, usedFallback: true } };
    });
    const store = createFakeStore(approved);
    await generateStage(store.deps, 'prd');

    expect(store.notices().map((notice) => notice.tone)).toEqual(['success', 'warning']);
    expect(store.activeSession()?.outputs.prd.meta?.usedFallback).toBe(true);
  });

  it('raises a notice when there is no active session', async () => {
    const store = createFakeStore(null);
    await generateStage(store.deps, 'prd');
    await generateAll(store.deps);
    await regenerateStale(store.deps);
    setStageReviewed(store.deps, 'prd', true);
    expect(store.notices().map((notice) => notice.title)).toEqual(Array.from({ length: 4 }, () => 'No active session'));
  });
});

describe('generateAll', () => {
  it('generates the five stages of a seed scenario in dependency order, threading the session locally', async () => {
    const store = createFakeStore(approved, { lagging: true });
    await generateAll(store.deps);

    const session = store.activeSession();
    const { outputs } = session ?? approved;
    expect([outputs.prd.status, outputs.architecture.status, outputs.dataIntegration.status, outputs.aiStrategy.status, outputs.estimate.status]).toEqual(
      Array.from({ length: 5 }, () => 'current'),
    );
    expect(busyLabels(store.actions)).toEqual([
      'Generating the PRD...',
      'Designing the solution...',
      'Planning the data flow...',
      'Selecting the AI approach...',
      'Estimating the delivery...',
    ]);
    expect(session?.config.cloudPlatform).toBe(outputs.architecture.data?.platform);
    expect(session?.changeLog).toEqual([]);
    expect(outputs.estimate.data?.result.totals.effortDays.likely).toBeGreaterThan(0);
    expect(store.state().busy).toBeNull();
    expect(store.notices().filter((notice) => notice.tone === 'success')).toHaveLength(1);
  });

  it('stops at the first failure with an error notice and keeps what was already generated', async () => {
    architectureMock.mockRejectedValueOnce(new AiProviderError('auth', 'HTTP 401'));
    const store = createFakeStore(approved);
    await expect(generateAll(store.deps)).resolves.toBeUndefined();

    const session = store.activeSession();
    expect(session?.outputs.prd.status).toBe('current');
    expect(session?.outputs.architecture.status).toBe('empty');
    expect(dataIntegrationMock).not.toHaveBeenCalled();
    expect(estimateMock).not.toHaveBeenCalled();
    const error = store.notices().find((notice) => notice.tone === 'error');
    expect(error?.title).toBe('Cloud solution architecture failed');
    expect(error?.message).toContain('rejected the API key');
    expect(store.state().busy).toBeNull();
  });
});

describe('regenerateStale', () => {
  it('regenerates only the stale stages, in dependency order, leaving current stages untouched by reference', async () => {
    const stale = markStale(generated, ['architecture', 'dataIntegration', 'estimate']);
    const store = createFakeStore(stale, { lagging: true });
    await regenerateStale(store.deps);

    const session = store.activeSession();
    expect(session?.outputs.prd).toBe(stale.outputs.prd);
    expect(session?.outputs.aiStrategy).toBe(stale.outputs.aiStrategy);
    expect(prdMock).not.toHaveBeenCalled();
    expect(aiStrategyMock).not.toHaveBeenCalled();

    expect(session?.outputs.architecture).toMatchObject({ status: 'current', reviewed: false, staleReasons: [] });
    expect(session?.outputs.dataIntegration.status).toBe('current');
    expect(session?.outputs.estimate.status).toBe('current');
    const order = [architectureMock, dataIntegrationMock, estimateMock].map((mock) => mock.mock.invocationCallOrder.at(0) ?? 0);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((position) => position > 0)).toBe(true);
    expect(dataIntegrationMock.mock.calls.at(0)?.at(0)).toMatchObject({ design: session?.outputs.architecture.data });
  });

  it('recalculates the estimate with the engine alone when every pending action is a recalculation', async () => {
    const pending = await withPendingRecalculation(generated);
    expect(pending.outputs.estimate.status).toBe('stale');
    const store = createFakeStore(pending);
    await regenerateStale(store.deps);

    const session = store.activeSession();
    expect(estimateMock).not.toHaveBeenCalled();
    expect(session?.outputs.estimate.status).toBe('current');
    expect(session?.outputs.estimate.meta).toBe(generated.outputs.estimate.meta);
    expect(session?.outputs.estimate.data?.result.totals.contingency).not.toEqual(generated.outputs.estimate.data?.result.totals.contingency);
    expect(session?.outputs.architecture).toBe(generated.outputs.architecture);
    expect(session?.changeLog.at(0)?.resolvedSections.length).toBeGreaterThan(0);
    expect(busyLabels(store.actions)).toEqual(['Recalculating the estimate...']);
    expect(store.notices().at(0)).toMatchObject({ tone: 'success', title: 'Effort, timeline and ROM recalculated' });
  });

  it('asks for re-approval before regenerating AI-derived stages', async () => {
    const stale = markStale(generated, ['architecture']);
    const unapproved = { ...stale, scope: stale.scope === null ? null : { ...stale.scope, version: stale.scope.version + 1 } };
    const store = createFakeStore(unapproved);
    await regenerateStale(store.deps);

    expect(architectureMock).not.toHaveBeenCalled();
    expect(store.notices().at(0)).toMatchObject({ tone: 'error', message: 'Approve the requirements before generating deliverables.' });
    expect(store.activeSession()).toBe(unapproved);
  });

  it('says so when nothing is stale', async () => {
    const store = createFakeStore(generated);
    await regenerateStale(store.deps);
    expect(store.notices().at(0)).toMatchObject({ tone: 'info', title: 'Nothing to regenerate' });
    expect(store.activeSession()).toBe(generated);
  });

  it('with a stage id, regenerates only that stage even though another stage is also stale', async () => {
    const stale = markStale(generated, ['architecture', 'estimate']);
    const store = createFakeStore(stale, { lagging: true });
    await regenerateStale(store.deps, 'estimate');

    expect(architectureMock).not.toHaveBeenCalled();
    const session = store.activeSession();
    expect(session?.outputs.architecture).toBe(stale.outputs.architecture);
    expect(session?.outputs.estimate.status).toBe('current');
  });

  it('says the named stage is up to date when it is not the stale one', async () => {
    const stale = markStale(generated, ['architecture']);
    const store = createFakeStore(stale);
    await regenerateStale(store.deps, 'estimate');

    expect(architectureMock).not.toHaveBeenCalled();
    expect(estimateMock).not.toHaveBeenCalled();
    expect(store.notices().at(0)).toMatchObject({ tone: 'info', title: 'Nothing to regenerate', message: 'Effort, timeline and ROM is already up to date.' });
    expect(store.activeSession()).toBe(stale);
  });
});

describe('setStageReviewed', () => {
  it('records the sign-off on one stage only', () => {
    const store = createFakeStore(generated);
    setStageReviewed(store.deps, 'architecture', true);

    expect(store.activeSession()?.outputs.architecture.reviewed).toBe(true);
    expect(store.activeSession()?.outputs.architecture.data).toBe(generated.outputs.architecture.data);
    expect(store.activeSession()?.outputs.prd).toBe(generated.outputs.prd);

    setStageReviewed(store.deps, 'architecture', false);
    expect(store.activeSession()?.outputs.architecture.reviewed).toBe(false);
  });

  it('refuses to review a stage that has not been generated', () => {
    const store = createFakeStore(approved);
    setStageReviewed(store.deps, 'estimate', true);
    expect(store.notices().at(0)).toMatchObject({ tone: 'error', title: 'Nothing to review yet' });
    expect(store.activeSession()).toBe(approved);
  });
});
