import { describe, expect, it } from 'vitest';
import type { ComplexityOverride, EstimateBundle } from '../../domain';
import { buildEstimateBundle, firstOrThrow } from '../testFixtures.data';
import { describeComplexityChanges } from './complexityChanges';

/** DRV_01 (capability, Medium) and DRV_03 (integration, High) come from the shared estimate fixture. */
function bundle(overrides: readonly ComplexityOverride[] = []): EstimateBundle {
  return { ...buildEstimateBundle(), overrides: [...overrides] };
}

describe('describeComplexityChanges', () => {
  it('reports nothing when either snapshot has no estimate yet', () => {
    expect(describeComplexityChanges(null, bundle())).toEqual([]);
    expect(describeComplexityChanges(bundle(), null)).toEqual([]);
  });

  it('reports nothing when no driver has a reviewer override', () => {
    expect(describeComplexityChanges(bundle(), bundle())).toEqual([]);
  });

  it('reports a driver-complexity change for a capability driver override', () => {
    const before = bundle([]);
    const after = bundle([{ driverId: 'DRV_01', complexity: 'High' }]);
    const change = firstOrThrow(describeComplexityChanges(before, after));
    expect(change).toMatchObject({ kind: 'driver-complexity', targetId: 'DRV_01', from: 'Medium', to: 'High' });
    expect(change.label).toContain('Complexity of estimate driver DRV_01');
  });

  it('reports an integration-complexity change for an integration driver override', () => {
    const before = bundle([]);
    const after = bundle([{ driverId: 'DRV_03', complexity: 'Very High' }]);
    const change = firstOrThrow(describeComplexityChanges(before, after));
    expect(change).toMatchObject({ kind: 'integration-complexity', targetId: 'DRV_03', from: 'High', to: 'Very High' });
    expect(change.label).toContain('Integration complexity of estimate driver DRV_03');
  });

  it('reports nothing when the override is changed to the same complexity the AI already suggested', () => {
    const before = bundle([]);
    const after = bundle([{ driverId: 'DRV_01', complexity: 'Medium' }]);
    expect(describeComplexityChanges(before, after)).toEqual([]);
  });

  it('reports a change back to the AI-suggested complexity when an override is removed', () => {
    const before = bundle([{ driverId: 'DRV_01', complexity: 'Very High' }]);
    const after = bundle([]);
    const change = firstOrThrow(describeComplexityChanges(before, after));
    expect(change).toMatchObject({ targetId: 'DRV_01', from: 'Very High', to: 'Medium' });
  });
});
