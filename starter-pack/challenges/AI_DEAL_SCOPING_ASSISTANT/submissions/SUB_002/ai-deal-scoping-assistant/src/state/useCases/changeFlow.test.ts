import type { ScopingSession } from '../../domain';
import { summarizePendingActions } from '../../impact';
import { applicationModernizationScenario } from '../../seed';
import { runFullPipeline } from '../../test/pipelineHarness';
import type { SessionMutation } from '../types';
import { applyChange, previewChange } from './changeFlow';
import { createFakeStore, TEST_NOW } from './testSupport';
import type { FakeStore } from './testSupport';

let generated: ScopingSession;

/** The committed active session, narrowed once so assertions read without optional chaining. */
function savedSession(store: FakeStore): ScopingSession {
  const session = store.activeSession();
  if (session === null) {
    throw new Error('an active session was expected');
  }
  return session;
}

beforeAll(async () => {
  const session = await runFullPipeline(applicationModernizationScenario);
  generated = { ...session, outputs: { ...session.outputs, estimate: { ...session.outputs.estimate, reviewed: true } } };
});

const raiseContingency: SessionMutation = (session) => ({
  ...session,
  estimationConfig: { ...session.estimationConfig, contingencyPct: session.estimationConfig.contingencyPct + 10 },
});

const growUsers: SessionMutation = (session) => ({ ...session, config: { ...session.config, expectedUsers: 900_000 } });

describe('previewChange', () => {
  it('analyses the hypothetical edit without saving anything', async () => {
    const store = createFakeStore(generated);
    const sessionsBefore = store.state().sessions;

    const preview = await previewChange(store.deps, growUsers);

    expect(preview.changes.map((change) => change.kind)).toEqual(['expected-users']);
    expect(preview.reports).toHaveLength(1);
    expect(preview.reports.at(0)?.affected.length).toBeGreaterThan(0);
    expect(preview.reports.at(0)?.explanation.length).toBeGreaterThan(20);
    expect(store.state().sessions).toBe(sessionsBefore);
    expect(store.activeSession()).toBe(generated);
    expect(store.notices()).toEqual([]);
    expect(store.state().busy).toBeNull();
  });

  it('returns an empty preview and a notice when there is no active session', async () => {
    const store = createFakeStore(null);
    expect(await previewChange(store.deps, growUsers)).toEqual({ changes: [], reports: [] });
    expect(store.notices().at(0)?.title).toBe('No active session');
  });
});

describe('applyChange', () => {
  it('recalculates the estimate immediately after a contingency change and leaves every other stage untouched', async () => {
    const store = createFakeStore(generated, { lagging: true });
    const preview = await applyChange(store.deps, raiseContingency);

    const { outputs } = savedSession(store);
    const before = generated.outputs;
    expect(preview.changes.map((change) => change.kind)).toEqual(['contingency']);
    expect(outputs.estimate).toMatchObject({ status: 'current', reviewed: false, staleReasons: [] });
    expect(outputs.estimate.meta).toBe(before.estimate.meta);
    expect(outputs.estimate.data?.suggestion).toBe(before.estimate.data?.suggestion);
    expect(outputs.estimate.data?.result).not.toEqual(before.estimate.data?.result);
    expect(outputs.estimate.data?.result.computedAt).toBe(TEST_NOW);

    expect(outputs.prd).toBe(before.prd);
    expect(outputs.architecture).toBe(before.architecture);
    expect(outputs.dataIntegration).toBe(before.dataIntegration);
    expect(outputs.aiStrategy).toBe(before.aiStrategy);
  });

  it('keeps the change in the change log with its sections marked resolved', async () => {
    const store = createFakeStore(generated);
    await applyChange(store.deps, raiseContingency);

    const session = store.activeSession();
    const report = session?.changeLog.at(0);
    expect(session?.changeLog).toHaveLength(1);
    expect(report?.change.kind).toBe('contingency');
    expect(report?.affected.every((entry) => entry.action === 'recalculate')).toBe(true);
    expect(report?.resolvedSections).toEqual(expect.arrayContaining([...new Set(report?.affected.map((entry) => entry.section))]));
    expect(session === null ? [] : summarizePendingActions(session)).toEqual([]);
    expect(store.notices().at(-1)?.message).toContain('recalculated immediately');
    expect(store.notices().at(-1)?.tone).toBe('info');
  });

  it('marks AI-derived stages stale instead of recalculating when the change needs regeneration', async () => {
    const store = createFakeStore(generated);
    await applyChange(store.deps, growUsers);

    const session = store.activeSession();
    expect(session?.outputs.architecture.status).toBe('stale');
    expect(session?.outputs.architecture.data).toBe(generated.outputs.architecture.data);
    expect(session?.outputs.architecture.staleReasons.length).toBeGreaterThan(0);
    expect(session?.outputs.prd).toBe(generated.outputs.prd);
    expect(session?.config.expectedUsers).toBe(900_000);
    const pending = session === null ? [] : summarizePendingActions(session);
    expect(pending.some((action) => action.stageId === 'estimate' && action.action === 'recalculate')).toBe(false);
    expect(store.notices().at(-1)).toMatchObject({ tone: 'warning', title: 'Change impact analyzed' });
  });

  it('simply saves an edit that changes nothing a deliverable depends on', async () => {
    const store = createFakeStore(generated);
    const preview = await applyChange(store.deps, (session) => ({ ...session, customer: { ...session.customer, notes: 'Met the CIO.' } }));

    expect(preview).toEqual({ changes: [], reports: [] });
    expect(store.activeSession()?.customer.notes).toBe('Met the CIO.');
    expect(store.activeSession()?.changeLog).toEqual([]);
    expect(store.activeSession()?.outputs).toBe(generated.outputs);
    expect(store.notices()).toEqual([]);
  });

  it('converts a failing mutation into an error notice and saves nothing', async () => {
    const store = createFakeStore(generated);
    const preview = await applyChange(store.deps, () => {
      throw new Error('broken mutation');
    });

    expect(preview).toEqual({ changes: [], reports: [] });
    expect(store.activeSession()).toBe(generated);
    expect(store.notices().at(0)).toMatchObject({ tone: 'error', title: 'Change could not be applied' });
    expect(store.state().busy).toBeNull();
  });
});
