import { STAGES } from '../../domain';
import { detectSignals } from '../../analysis';
import type { ScopingSession } from '../../domain';
import { stageState } from '../../impact';
import { isScopeApproved } from '../../scope';
import { applicationModernizationScenario } from '../../seed';
import { fixtureSession } from '../../test/fixtures';
import { runFullPipeline } from '../../test/pipelineHarness';
import {
  addScopeItem,
  approveAllPending,
  approveScope,
  editScopeItem,
  removeScopeItem,
  reopenScopeItem,
  resolveScopeItem,
  setItemReview,
} from './scopeEdits';
import { createFakeStore } from './testSupport';

let generated: ScopingSession;

beforeAll(async () => {
  generated = await runFullPipeline(applicationModernizationScenario);
});

function firstFunctionalId(session: ScopingSession): string {
  return session.scope?.items.find((item) => item.kind === 'functional' && item.priority !== 'Low')?.id ?? '';
}

describe('scope edits before any deliverable exists', () => {
  it('replaces the scope directly - no impact analysis, no busy state, no notice', async () => {
    const store = createFakeStore(fixtureSession());
    await editScopeItem(store.deps, 'FR_02', { priority: 'High' });

    const scope = store.activeSession()?.scope;
    expect(scope?.items.find((item) => item.id === 'FR_02')).toMatchObject({ priority: 'High', userEdited: true });
    expect(scope?.version).toBe(2);
    expect(store.activeSession()?.changeLog).toEqual([]);
    expect(store.actions.map((action) => action.type)).toEqual(['UPSERT_SESSION']);
  });

  it('supports add, remove, review, resolve and reopen', async () => {
    const store = createFakeStore(fixtureSession());
    await addScopeItem(store.deps, 'functional', { title: 'Export statements', description: 'Members export statements as PDF.', priority: 'Medium' });
    await removeScopeItem(store.deps, 'RSK_01');
    await setItemReview(store.deps, 'FR_03', 'rejected');
    await resolveScopeItem(store.deps, 'Q_01', 'Microsoft Entra ID.');
    await reopenScopeItem(store.deps, 'Q_01');
    await resolveScopeItem(store.deps, 'Q_02', '1 March.');

    const items = store.activeSession()?.scope?.items ?? [];
    expect(items.find((item) => item.title === 'Export statements')).toMatchObject({ provenance: 'assumed', review: 'pending' });
    expect(items.some((item) => item.id === 'RSK_01')).toBe(false);
    expect(items.find((item) => item.id === 'FR_03')?.review).toBe('rejected');
    expect(items.find((item) => item.id === 'Q_01')).toMatchObject({ resolved: false, resolution: '' });
    expect(items.find((item) => item.id === 'Q_02')).toMatchObject({ resolved: true, resolution: '1 March.' });

    await approveAllPending(store.deps);
    expect(store.activeSession()?.scope?.items.every((item) => item.review !== 'pending')).toBe(true);
    expect(store.notices()).toEqual([]);
  });

  it('tags added and reworded items with signals detected from their text', async () => {
    const store = createFakeStore(fixtureSession());
    const addedText = 'Sync claims to Salesforce Sync claims nightly to the Salesforce CRM through its REST API.';
    await addScopeItem(store.deps, 'integration', { title: 'Sync claims to Salesforce', description: 'Sync claims nightly to the Salesforce CRM through its REST API.', priority: 'Medium' });
    const added = store.activeSession()?.scope?.items.find((item) => item.title === 'Sync claims to Salesforce');
    expect(added?.signals).toEqual(detectSignals(addedText));
    expect(added?.signals.length).toBeGreaterThan(0);

    const before = store.activeSession()?.scope?.items.find((item) => item.id === 'FR_02')?.signals ?? [];
    await editScopeItem(store.deps, 'FR_02', { description: 'Members upload documents that are scanned and sent to the Salesforce CRM through its REST API.' });
    const after = store.activeSession()?.scope?.items.find((item) => item.id === 'FR_02')?.signals ?? [];
    expect(after).toEqual(expect.arrayContaining([...before]));
    expect(after.length).toBeGreaterThanOrEqual(before.length);
  });

  it('turns an unknown item id or a missing scope into an error notice', async () => {
    const store = createFakeStore(fixtureSession());
    await editScopeItem(store.deps, 'FR_99', { title: 'x' });
    expect(store.notices().at(0)).toMatchObject({ tone: 'error', title: 'Scope could not be updated' });
    expect(store.notices().at(0)?.message).toContain('FR_99');

    const empty = createFakeStore({ ...fixtureSession(), scope: null });
    await approveAllPending(empty.deps);
    expect(empty.notices().at(0)?.message).toBe('Analyze the customer requirements before reviewing the scope.');
  });

  it('raises a notice when there is no active session', async () => {
    const store = createFakeStore(null);
    await editScopeItem(store.deps, 'FR_01', { title: 'x' });
    approveScope(store.deps);
    expect(store.notices().map((notice) => notice.title)).toEqual(['No active session', 'No active session']);
  });
});

describe('scope edits after deliverables exist', () => {
  it('runs through the change flow: logs the impact and marks only the affected stages stale', async () => {
    const store = createFakeStore(generated, { lagging: true });
    const itemId = firstFunctionalId(generated);
    await editScopeItem(store.deps, itemId, { priority: 'Low' });

    const session = store.activeSession();
    const report = session?.changeLog.at(0);
    expect(session?.changeLog).toHaveLength(1);
    expect(report?.change).toMatchObject({ kind: 'requirement-priority', targetId: itemId, to: 'Low' });
    expect(report?.affected.length).toBeGreaterThan(0);

    const affectedSections = new Set(report?.affected.map((entry) => entry.section));
    for (const stage of STAGES) {
      const before = stageState(generated.outputs, stage.id);
      const after = session === null ? before : stageState(session.outputs, stage.id);
      if (stage.sections.some((section) => affectedSections.has(section))) {
        expect(after.status).toBe('stale');
        expect(after.data).toBe(before.data);
      } else {
        expect(after).toBe(before);
      }
    }
    expect(session?.quality).toBeNull();
    expect(store.state().busy).toBeNull();
  });

  it('tells the reviewer that re-approval is needed', async () => {
    const store = createFakeStore(generated);
    await editScopeItem(store.deps, firstFunctionalId(generated), { priority: 'Low' });

    expect(isScopeApproved(store.activeSession()?.scope ?? null)).toBe(false);
    const notice = store.notices().at(-1);
    expect(notice).toMatchObject({ tone: 'warning', title: 'Change saved - re-approval needed' });
    expect(notice?.message).toContain('approve the requirements again');
    expect(notice?.message).toContain('Marked stale');
  });
});

describe('approveScope', () => {
  it('names the pending items when the scope cannot be approved', () => {
    const session = fixtureSession();
    const scope = session.scope;
    if (scope === null) {
      throw new Error('scope expected');
    }
    const pending = { ...scope, items: scope.items.map((item) => (item.id === 'FR_01' || item.id === 'Q_02' ? { ...item, review: 'pending' as const } : item)) };
    const store = createFakeStore({ ...session, scope: pending });
    approveScope(store.deps);

    expect(store.notices().at(0)).toMatchObject({ tone: 'error', title: 'Requirements cannot be approved yet' });
    expect(store.notices().at(0)?.message).toContain('2 item(s) are still pending review: FR_01, Q_02.');
    expect(store.activeSession()?.scope).toBe(pending);
  });

  it('approves the current version and says what can happen next', async () => {
    const store = createFakeStore(fixtureSession());
    await editScopeItem(store.deps, 'FR_02', { priority: 'High' });
    expect(isScopeApproved(store.activeSession()?.scope ?? null)).toBe(false);

    approveScope(store.deps);
    expect(isScopeApproved(store.activeSession()?.scope ?? null)).toBe(true);
    expect(store.notices().at(-1)).toMatchObject({ tone: 'success', title: 'Requirements approved' });
    expect(store.notices().at(-1)?.message).toContain('Scope version 2 is approved.');
  });
});
