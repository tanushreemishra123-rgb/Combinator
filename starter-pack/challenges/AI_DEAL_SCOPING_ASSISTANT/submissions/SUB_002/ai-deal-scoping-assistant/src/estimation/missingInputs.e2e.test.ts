/**
 * The missing-information seed tracks a critical compliance gap (payment-card handling) and no
 * security workstream exists. The estimate must still report the compliance-scope input it leaves
 * unknown - against the workstreams that price the requirements the gap holds open - instead of
 * dropping it.
 */
import { SEED_SCENARIOS } from '../seed';
import { runFullPipeline } from '../test/pipelineHarness';
import { OVERALL_ESTIMATE_COMPONENT } from './missingInputs';

describe('missing estimation inputs in the missing-information scenario', () => {
  it('reports the compliance scope held open by the payment-card gap', async () => {
    const scenario = SEED_SCENARIOS.find((entry) => entry.id === 'missing-information-member-app');
    expect(scenario).toBeDefined();
    if (scenario === undefined) {
      return;
    }
    const result = (await runFullPipeline(scenario)).outputs.estimate.data?.result;
    const compliance = result?.missingInputs.find((missing) => missing.key === 'complianceScope');
    expect(compliance).toEqual(expect.objectContaining({ label: 'Compliance scope', effect: 'confidence-reduced' }));
    // The gap is linked to the requirements it holds open, so the workstreams pricing them are named.
    expect(compliance?.affected.length).toBeGreaterThan(0);
    expect(compliance?.affected).not.toContain(OVERALL_ESTIMATE_COMPONENT);
    expect(compliance?.relatedScopeIds).toContain('GAP_05');
    expect(result?.confidence).toBe('Low');
  });
});
