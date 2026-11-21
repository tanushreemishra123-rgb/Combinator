import { describe, expect, it } from 'vitest';
import { describeChanges } from './describeChanges';
import { buildRichSession } from './testFixtures.data';

describe('describeChanges', () => {
  it('reports nothing between two identical snapshots', () => {
    const session = buildRichSession();
    expect(describeChanges(session, buildRichSession())).toEqual([]);
  });

  it('combines a config change, a commercial change, a scope change and a complexity override in one diff', () => {
    const before = buildRichSession();
    const after = buildRichSession({
      config: { ...before.config, expectedUsers: 250000 },
      estimationConfig: { ...before.estimationConfig, contingencyPct: 20 },
      scope: { ...before.scope!, items: before.scope!.items.map((item) => (item.id === 'FR_02' ? { ...item, priority: 'High' } : item)) },
      outputs: { ...before.outputs, estimate: { ...before.outputs.estimate, data: { ...before.outputs.estimate.data!, overrides: [{ driverId: 'DRV_01', complexity: 'High' }] } } },
    });
    const changes = describeChanges(before, after);
    expect(changes.map((change) => change.kind).sort()).toEqual(['contingency', 'driver-complexity', 'expected-users', 'requirement-priority']);
  });

  it('only compares complexity overrides when both sessions already have an estimate', () => {
    const before = buildRichSession({ outputs: { ...buildRichSession().outputs, estimate: { data: null, status: 'empty', reviewed: false, meta: null, staleReasons: [] } } });
    const after = buildRichSession();
    expect(describeChanges(before, after).some((change) => change.kind === 'driver-complexity')).toBe(false);
  });
});
