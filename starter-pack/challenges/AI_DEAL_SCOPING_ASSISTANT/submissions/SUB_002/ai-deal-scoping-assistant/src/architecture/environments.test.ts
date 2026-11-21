import { describe, expect, it } from 'vitest';
import type { ScopeItem, ScopeModel } from '../domain';
import { fixtureConfig, fixtureScope } from '../test/fixtures';
import { buildEnvironments, DEFAULT_ENVIRONMENT_COUNT } from './environments';

/** Isolates the volume-sizing behaviour from the fixture's own NFR/data items, which would
 *  otherwise also qualify as stated volumes and mask the case under test. */
function withOnlyNonFunctional(title: string, id = 'NFR_50'): ScopeModel {
  const scope = fixtureScope();
  const base = scope.items.find((i) => i.kind === 'nonFunctional');
  if (base === undefined) throw new Error('fixture missing an nonFunctional item');
  const extra: ScopeItem = { ...base, id, title, description: title };
  const others = scope.items.filter((i) => i.kind !== 'nonFunctional' && i.kind !== 'data');
  return { ...scope, items: [...others, extra] };
}

describe('buildEnvironments', () => {
  it('sizes Production from expectedUsers alone when no other volume is stated', () => {
    const scope: ScopeModel = { ...fixtureScope(), items: [] };
    const config = fixtureConfig({ expectedUsers: 1200, environments: 3 });
    const production = buildEnvironments(config, scope).find((environment) => environment.name === 'Production');
    expect(production?.sizing).toContain('1,200 expected users');
    expect(production?.sizing).not.toContain('plus the stated');
  });

  it('adds a distinct stated NFR/data volume figure to the Production sizing note, citing its id', () => {
    const scope = withOnlyNonFunctional('85,000 patient encounters per month at scale', 'NFR_50');
    const config = fixtureConfig({ expectedUsers: 1200, environments: 3 });
    const production = buildEnvironments(config, scope).find((environment) => environment.name === 'Production');
    expect(production?.sizing).toContain('85,000 patient encounters per month at scale (NFR_50)');
  });

  it('never cites the same figure twice when the stated volume equals expectedUsers', () => {
    const scope = withOnlyNonFunctional('50,000 registered members', 'NFR_50');
    const config = fixtureConfig({ expectedUsers: 50_000, environments: 3 });
    const production = buildEnvironments(config, scope).find((environment) => environment.name === 'Production');
    expect(production?.sizing).not.toContain('plus the stated');
  });

  it('ignores a small figure that reads as a rate or percentage rather than a load volume', () => {
    const scope = withOnlyNonFunctional('99.9% availability', 'NFR_50');
    const config = fixtureConfig({ expectedUsers: 1200, environments: 3 });
    const production = buildEnvironments(config, scope).find((environment) => environment.name === 'Production');
    expect(production?.sizing).not.toContain('plus the stated');
  });

  it('flags an assumption-pending note on every environment only when the count is unconfigured', () => {
    const scope: ScopeModel = { ...fixtureScope(), items: [] };
    const configured = buildEnvironments(fixtureConfig({ environments: 3 }), scope);
    const unconfigured = buildEnvironments(fixtureConfig({ environments: null }), scope);
    expect(configured.every((environment) => !environment.sizing.includes('assumption'))).toBe(true);
    expect(unconfigured.every((environment) => environment.sizing.includes('assumption'))).toBe(true);
    expect(unconfigured).toHaveLength(DEFAULT_ENVIRONMENT_COUNT);
  });
});
