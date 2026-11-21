import type { Complexity, ScopingSession } from '../../domain';
import { applicationModernizationScenario } from '../../seed';
import { fixtureSession } from '../../test/fixtures';
import { runFullPipeline } from '../../test/pipelineHarness';
import { parseSession } from '../sessionSchema';
import { applyCommercialPreset, setDriverComplexity, setRoleRate, updateEstimationConfig, updateSolutionConfig } from './config';
import { createFakeStore, TEST_NOW } from './testSupport';

let generated: ScopingSession;

beforeAll(async () => {
  generated = await runFullPipeline(applicationModernizationScenario);
});

describe('configuration before any deliverable exists', () => {
  it('saves solution and commercial settings directly', async () => {
    const store = createFakeStore(fixtureSession());
    await updateSolutionConfig(store.deps, { expectedUsers: 120_000, environments: 4 });
    await updateEstimationConfig(store.deps, { contingencyPct: 25 });
    await setRoleRate(store.deps, 'qa-engineer', null);

    const session = store.activeSession();
    expect(session?.config).toMatchObject({ expectedUsers: 120_000, environments: 4, cloudPlatform: 'azure' });
    expect(session?.estimationConfig.contingencyPct).toBe(25);
    expect(session?.estimationConfig.rates.find((rate) => rate.roleId === 'qa-engineer')?.dayRate).toBeNull();
    expect(session?.changeLog).toEqual([]);
    expect(store.notices()).toEqual([]);
    expect(store.actions.every((action) => action.type === 'UPSERT_SESSION')).toBe(true);
  });

  it('rejects an unknown commercial preset and a complexity override without an estimate', async () => {
    const store = createFakeStore(fixtureSession());
    await applyCommercialPreset(store.deps, 'no-such-preset');
    await setDriverComplexity(store.deps, 'DRV_01', 'High');

    expect(store.notices().map((notice) => notice.title)).toEqual(['Commercial preset not found', 'Driver complexity could not be updated']);
    expect(store.notices().at(1)?.message).toBe('Estimate the delivery before setting a driver complexity.');
  });

  it('raises a notice when there is no active session', async () => {
    const store = createFakeStore(null);
    await updateSolutionConfig(store.deps, { environments: 2 });
    await applyCommercialPreset(store.deps, 'no-such-preset');
    expect(store.notices().map((notice) => notice.title)).toEqual(['No active session', 'No active session']);
  });

  it('rejects a team size of 0, keeps the previous commercial configuration, and the session stays loadable', async () => {
    const store = createFakeStore(fixtureSession());
    await updateEstimationConfig(store.deps, { teamSize: 0 });

    expect(store.notices().at(0)?.title).toBe('Commercial configuration could not be updated');
    expect(store.notices().at(0)?.message).toContain('teamSize');
    const session = store.activeSession();
    expect(session?.estimationConfig.teamSize).toBeGreaterThan(0);

    const result = parseSession(JSON.parse(JSON.stringify(session)), TEST_NOW);
    expect(result.ok).toBe(true);
  });

  it('rejects a negative rate the rate card would otherwise accept', async () => {
    const store = createFakeStore(fixtureSession());
    await setRoleRate(store.deps, 'qa-engineer', -50);

    expect(store.notices().at(0)?.title).toBe('Commercial configuration could not be updated');
    expect(store.activeSession()?.estimationConfig.rates.find((rate) => rate.roleId === 'qa-engineer')?.dayRate).not.toBe(-50);
  });
});

describe('configuration after deliverables exist', () => {
  it('applies a commercial preset through the change flow and recalculates the estimate without AI', async () => {
    const store = createFakeStore(generated, { lagging: true });
    await applyCommercialPreset(store.deps, 'european-delivery-eur');

    const session = store.activeSession();
    expect(session?.estimationConfig.currency).toBe('EUR');
    expect(session?.changeLog.map((report) => report.change.kind)).toEqual(expect.arrayContaining(['rate-card', 'contingency', 'currency']));
    expect(session?.outputs.estimate.status).toBe('current');
    expect(session?.outputs.estimate.data?.result.totals.rom?.currency).toBe('EUR');
    expect(session?.outputs.architecture).toBe(generated.outputs.architecture);
  });

  it('applying the same preset twice never compounds its rate multiplier', async () => {
    const store = createFakeStore(generated);
    await applyCommercialPreset(store.deps, 'european-delivery-eur');
    const ratesAfterFirst = store.activeSession()?.estimationConfig.rates;
    await applyCommercialPreset(store.deps, 'european-delivery-eur');
    expect(store.activeSession()?.estimationConfig.rates).toEqual(ratesAfterFirst);
  });

  it('records one complexity override per driver and recalculates the effort', async () => {
    const driver = generated.outputs.estimate.data?.suggestion.workstreams.at(0)?.drivers.at(0);
    if (driver === undefined) {
      throw new Error('the generated estimate must have a driver');
    }
    const first: Complexity = driver.complexity === 'Very High' ? 'Low' : 'Very High';
    const second: Complexity = driver.complexity === 'High' ? 'Medium' : 'High';
    const store = createFakeStore(generated);

    await setDriverComplexity(store.deps, driver.id, first);
    const afterFirst = store.activeSession();
    expect(afterFirst?.outputs.estimate.data?.overrides).toEqual([{ driverId: driver.id, complexity: first }]);
    expect(afterFirst?.outputs.estimate.status).toBe('current');
    expect(afterFirst?.outputs.estimate.data?.result.totals.effortDays).not.toEqual(generated.outputs.estimate.data?.result.totals.effortDays);

    await setDriverComplexity(store.deps, driver.id, second);
    expect(store.activeSession()?.outputs.estimate.data?.overrides).toEqual([{ driverId: driver.id, complexity: second }]);
    expect(store.activeSession()?.changeLog).toHaveLength(2);
  });

  it('rejects a driver the estimate does not contain', async () => {
    const store = createFakeStore(generated);
    await setDriverComplexity(store.deps, 'DRV_999', 'High');
    expect(store.notices().at(0)?.message).toBe('The estimate has no driver DRV_999.');
    expect(store.activeSession()).toBe(generated);
  });
});
