import { describe, expect, it } from 'vitest';
import type { SolutionConfig } from '../../domain';
import { fixtureConfig } from '../../test/fixtures';
import { firstOrThrow } from '../testFixtures.data';
import { describeConfigChanges } from './configChanges';

function config(overrides: Partial<SolutionConfig> = {}): SolutionConfig {
  return fixtureConfig(overrides);
}

describe('describeConfigChanges', () => {
  it('reports a manual platform selection as a cloud-platform change, naming the platform', () => {
    const before = config({ cloudSelectionMode: 'recommend', cloudPlatform: null });
    const after = config({ cloudSelectionMode: 'user-selected', cloudPlatform: 'aws' });
    const change = firstOrThrow(describeConfigChanges(before, after));
    expect(change).toMatchObject({ kind: 'cloud-platform', targetId: 'cloudPlatform', from: 'the assistant-recommended platform', to: 'Amazon Web Services' });
    expect(change.label).toContain('Cloud platform');
  });

  it('reports an increase in expected users with an "increased" verb', () => {
    const before = config({ expectedUsers: 5000 });
    const after = config({ expectedUsers: 500000 });
    const change = firstOrThrow(describeConfigChanges(before, after));
    expect(change).toMatchObject({ kind: 'expected-users', targetId: 'expectedUsers', from: '5,000', to: '500,000' });
    expect(change.label).toBe('Expected users increased from 5,000 to 500,000');
  });

  it('reports a decrease in expected users with a "decreased" verb', () => {
    const before = config({ expectedUsers: 500000 });
    const after = config({ expectedUsers: 5000 });
    const change = firstOrThrow(describeConfigChanges(before, after));
    expect(change.label).toBe('Expected users decreased from 500,000 to 5,000');
  });

  it('reports a newly specified delivery deadline', () => {
    const before = config({ deliveryDeadlineWeeks: null });
    const after = config({ deliveryDeadlineWeeks: 12 });
    const change = firstOrThrow(describeConfigChanges(before, after));
    expect(change).toMatchObject({ kind: 'delivery-deadline', targetId: 'deliveryDeadlineWeeks', from: 'not specified', to: '12 weeks' });
  });

  it('reports a change in the number of environments', () => {
    const before = config({ environments: 2 });
    const after = config({ environments: 4 });
    const change = firstOrThrow(describeConfigChanges(before, after));
    expect(change).toMatchObject({ kind: 'environments', targetId: 'environments', from: '2 environments', to: '4 environments' });
  });

  it('reports a change to the target regions as a readable list', () => {
    const before = config({ targetRegions: [] });
    const after = config({ targetRegions: ['EU', 'US'] });
    const change = firstOrThrow(describeConfigChanges(before, after));
    expect(change).toMatchObject({ kind: 'target-regions', targetId: 'targetRegions', from: 'not specified', to: 'EU and US' });
  });

  it('reports a change in the AI-provider preference', () => {
    const before = config({ aiProviderPreference: 'no-preference' });
    const after = config({ aiProviderPreference: 'anthropic' });
    const change = firstOrThrow(describeConfigChanges(before, after));
    expect(change).toMatchObject({ kind: 'ai-provider-preference', targetId: 'aiProviderPreference', from: 'no provider preference', to: 'Anthropic models' });
  });

  it('reports nothing when the configuration is unchanged', () => {
    const same = config();
    expect(describeConfigChanges(same, { ...same })).toEqual([]);
  });

  it('reports every changed field in a single diff, in field order', () => {
    const before = config({ expectedUsers: 1000, environments: 1 });
    const after = config({ expectedUsers: 2000, environments: 2 });
    const changes = describeConfigChanges(before, after);
    expect(changes.map((change) => change.kind)).toEqual(['expected-users', 'environments']);
  });
});
