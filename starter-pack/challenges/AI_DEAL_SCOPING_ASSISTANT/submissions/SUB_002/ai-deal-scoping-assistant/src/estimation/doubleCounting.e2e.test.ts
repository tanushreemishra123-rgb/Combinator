/**
 * Every seeded scenario's estimate-input suggestion must reconcile: no two drivers in different
 * workstreams may price the identical set of reviewed requirements, and no capability may restate
 * requirements that AI, integration or data drivers already price (see planner/doubleCounting.ts).
 */
import { SEED_SCENARIOS } from '../seed';
import { runFullPipeline } from '../test/pipelineHarness';
import { findDoubleCountedDrivers } from './planner/doubleCounting';

describe('the mock planner never double-counts a driver across the four seed scenarios', () => {
  it.each(SEED_SCENARIOS.map((scenario) => [scenario.name, scenario] as const))('%s', async (_name, scenario) => {
    const session = await runFullPipeline(scenario);
    const suggestion = session.outputs.estimate.data?.suggestion;
    expect(suggestion, `estimate did not generate for ${scenario.id}`).toBeDefined();
    if (suggestion === undefined) {
      return;
    }
    expect(findDoubleCountedDrivers(suggestion)).toEqual([]);
  });
});
