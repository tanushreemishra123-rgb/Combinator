import type { ScopeItem, ScopeModel } from '../domain';
import { SEED_SCENARIOS } from '../seed';
import { fixtureScope } from '../test/fixtures';
import { analyseAndApprove } from '../test/pipelineHarness';
import { findStatedDeadline } from './statedDeadline';

function scopeWith(overrides: Partial<ScopeItem>): ScopeModel {
  const scope = fixtureScope();
  const base = scope.items.at(0);
  if (base === undefined) {
    throw new Error('fixture scope is empty');
  }
  const item: ScopeItem = { ...base, id: 'CON_09', kind: 'constraint', provenance: 'customer-stated', review: 'approved', title: 'Delivery window', description: '', ...overrides };
  return { ...scope, items: [item] };
}

describe('findStatedDeadline', () => {
  it('returns null without a scope or without a stated duration', () => {
    expect(findStatedDeadline(null)).toBeNull();
    expect(findStatedDeadline(scopeWith({ description: 'The portal must go live before the renewal season.' }))).toBeNull();
  });

  it('reads a deadline stated in weeks', () => {
    const found = findStatedDeadline(scopeWith({ description: 'Go live is a target of 46 weeks from contract signature.' }));
    expect(found).toEqual({ weeks: 46, sourceId: 'CON_09', statedAs: '46 weeks' });
  });

  it('converts months, number words and hyphenated forms to weeks', () => {
    expect(findStatedDeadline(scopeWith({ description: 'Launch within nine months.' }))?.weeks).toBe(39);
    expect(findStatedDeadline(scopeWith({ title: '24-week phased rollout starting with intake' }))).toMatchObject({ weeks: 24, statedAs: '24 weeks' });
    expect(findStatedDeadline(scopeWith({ description: 'The deadline is twenty four weeks away.' }))).toMatchObject({ weeks: 24, statedAs: 'twenty four weeks' });
  });

  it('ignores durations that are not a delivery deadline', () => {
    expect(findStatedDeadline(scopeWith({ description: 'Records are retained for 84 months after launch.' }))).toBeNull();
    expect(findStatedDeadline(scopeWith({ description: 'Hypercare runs for 3 months after go-live.' }))).toBeNull();
    expect(findStatedDeadline(scopeWith({ title: 'Invoice archiving', description: 'Invoices are archived every 6 months.' }))).toBeNull();
  });

  it('ignores rejected items, inferred items and kinds that do not carry delivery commitments', () => {
    const description = 'Go live within 20 weeks.';
    expect(findStatedDeadline(scopeWith({ description, review: 'rejected' }))).toBeNull();
    expect(findStatedDeadline(scopeWith({ description, provenance: 'ai-inferred' }))).toBeNull();
    expect(findStatedDeadline(scopeWith({ description, kind: 'functional' }))).toBeNull();
  });

  it('agrees with the deadline configured for every seeded scenario that states one', async () => {
    for (const scenario of SEED_SCENARIOS) {
      const session = await analyseAndApprove(scenario);
      const found = findStatedDeadline(session.scope);
      const configured = session.config.deliveryDeadlineWeeks;
      expect(found?.weeks ?? null, scenario.id).toBe(configured);
    }
  });
});
