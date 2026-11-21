import { describe, expect, it } from 'vitest';
import type { PrdContext } from '../ai/types';
import type { ScopeModel } from '../domain';
import { PrdOutputSchema } from '../domain';
import { updateScopeItem } from '../scope';
import { fixtureConfig, fixtureCustomer, fixtureScope } from '../test/fixtures';
import { buildPrdDocument } from './assemble';
import { planPrd } from './plan';

function contextFor(scope: ScopeModel): PrdContext {
  return { task: 'generate-prd', scope, customer: fixtureCustomer(), config: fixtureConfig() };
}

const EMPTY_SCOPE: ScopeModel = { summary: '', items: [], version: 1, approvedAt: null, approvedVersion: null, issues: [] };

describe('planPrd', () => {
  it('produces output that satisfies PrdOutputSchema for the fixture scope', () => {
    const output = planPrd(contextFor(fixtureScope()));
    expect(() => PrdOutputSchema.parse(output)).not.toThrow();
  });

  it('places every reviewed requirement into some capability', () => {
    const output = planPrd(contextFor(fixtureScope()));
    const cited = new Set(output.capabilities.flatMap((capability) => capability.requirementIds));
    expect(cited).toEqual(new Set(['BR_01', 'FR_01', 'FR_02', 'FR_03', 'NFR_01', 'NFR_02', 'INT_01', 'DATA_01', 'SEC_01']));
  });

  it('produces one journey grounded in the persona and cites requirement ids', () => {
    const output = planPrd(contextFor(fixtureScope()));
    expect(output.journeys).toHaveLength(1);
    expect(output.journeys.at(0)?.requirementIds.length).toBeGreaterThan(0);
  });

  it('returns a well-formed bundle for an empty scope (no requirements)', () => {
    const output = planPrd(contextFor(EMPTY_SCOPE));
    expect(() => PrdOutputSchema.parse(output)).not.toThrow();
    expect(output.capabilities).toHaveLength(1);
    expect(output.capabilities.at(0)?.name).toBe('Core Platform Services');
    expect(output.journeys).toEqual([]);
    expect(output.overview.at(0)?.text).not.toMatch(/undefined|null|N\/A|TBD/i);
  });

  it('is deterministic for the same scope and customer', () => {
    const scope = fixtureScope();
    const first = planPrd(contextFor(scope));
    const second = planPrd(contextFor(scope));
    expect(first).toEqual(second);
  });

  it('lists a requirement the reviewer excluded only under out-of-scope, never as requested scope', () => {
    const excluded = ['BR_01', 'FR_02'];
    const scope = excluded.reduce((model, id) => updateScopeItem(model, id, { inScope: false }), fixtureScope());
    const output = planPrd(contextFor(scope));
    const document = buildPrdDocument(output, scope, fixtureCustomer());
    const citedOutside = document.sections
      .filter((section) => section.id !== 'outOfScope')
      .flatMap((section) => section.statements.flatMap((statement) => statement.refs));
    const plannedRefs = [
      ...output.capabilities.flatMap((capability) => capability.requirementIds),
      ...output.journeys.flatMap((journey) => journey.requirementIds),
    ];
    const outOfScopeRefs = output.outOfScope.flatMap((statement) => statement.refs);
    for (const id of excluded) {
      expect(citedOutside).not.toContain(id);
      expect(plannedRefs).not.toContain(id);
      expect(outOfScopeRefs).toContain(id);
    }
  });
});
