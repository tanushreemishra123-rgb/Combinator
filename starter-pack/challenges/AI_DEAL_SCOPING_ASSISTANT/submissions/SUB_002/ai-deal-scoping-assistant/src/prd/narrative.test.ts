import { describe, expect, it } from 'vitest';
import type { ScopeItem, ScopeModel } from '../domain';
import { fixtureCustomer, fixtureScope } from '../test/fixtures';
import { buildCapabilities } from './capabilities';
import { buildBusinessProblem, buildOutOfScope, buildOverview } from './narrative';

describe('buildOverview', () => {
  it('opens with the analysed summary, then names every business objective and the customer once', () => {
    const statements = buildOverview(fixtureScope(), fixtureCustomer());
    expect(statements).toHaveLength(2);
    expect(statements.at(0)).toEqual({ text: 'Member self-service portal with CRM sync and an AI policy assistant.', refs: ['BR_01'], label: 'ai-interpretation' });
    expect(statements.at(1)?.refs).toEqual(['BR_01']);
    expect(statements.at(1)?.text).toContain('Northwind Mutual');
    expect(statements.at(1)?.text).toContain('1 business objective set by Northwind Mutual (BR_01)');
    expect(statements.at(1)?.text).not.toContain('Reduce call-centre volume by 30%');
  });

  it('names the capability areas and the existing systems the solution connects to', () => {
    const capabilities = buildCapabilities(fixtureScope());
    const shape = buildOverview(fixtureScope(), fixtureCustomer(), capabilities).at(-1);
    expect(shape?.text).toContain('capability area');
    expect(shape?.text).toContain('Salesforce CRM (SYS_01)');
    expect(shape?.refs).toEqual(['SYS_01']);
  });

  it('returns a well-formed, grounded fallback statement when no business objective is recorded', () => {
    const scope: ScopeModel = { summary: '', items: [], version: 1, approvedAt: null, approvedVersion: null, issues: [] };
    const statements = buildOverview(scope, fixtureCustomer());
    expect(statements).toHaveLength(1);
    expect(statements.at(0)?.refs).toEqual([]);
    expect(statements.at(0)?.label).toBe('assumption-to-confirm');
    expect(statements.at(0)?.text).not.toMatch(/undefined|null|N\/A|TBD/i);
  });
});

describe('buildBusinessProblem', () => {
  it('cites every business objective with problem-framed text distinct from the overview', () => {
    const overview = buildOverview(fixtureScope(), fixtureCustomer());
    const problem = buildBusinessProblem(fixtureScope(), fixtureCustomer());
    expect(problem).toHaveLength(1);
    expect(problem.at(0)?.refs).toEqual(['BR_01']);
    expect(problem.at(0)?.text).toBe('Northwind Mutual cannot yet achieve "Reduce call-centre volume" (BR_01).');
    expect(overview.map((statement) => statement.text)).not.toContain(problem.at(0)?.text);
  });

  it('starts from the legacy system the customer runs today', () => {
    const scope = fixtureScope();
    const legacy: ScopeItem = { ...(scope.items.at(0) as ScopeItem), id: 'SYS_02', kind: 'existingSystem', title: 'Legacy claims desk', description: 'Built in 2011 and being replaced.' };
    const problem = buildBusinessProblem({ ...scope, items: [...scope.items, legacy] }, fixtureCustomer());
    expect(problem.at(0)).toMatchObject({ refs: ['SYS_02'], text: 'Today Northwind Mutual relies on Legacy claims desk: Built in 2011 and being replaced.' });
    expect(problem.at(-1)?.refs).toEqual(['BR_01']);
  });
});

describe('buildOutOfScope', () => {
  const EXCLUDED_QUOTE = 'BR5. A partner portal could follow, though that is out of scope for this initial phase.';

  function withItems(scope: ScopeModel, ...extra: ScopeItem[]): ScopeModel {
    return { ...scope, items: [...scope.items, ...extra] };
  }

  function quoted(base: ScopeItem, id: string, kind: ScopeItem['kind'], quote: string, inScope: boolean): ScopeItem {
    const source = { sectionId: 's1', sectionTitle: 'Scope', lineStart: 20, lineEnd: 20, quote, verified: true };
    return { ...base, id, kind, title: `${id} title`, source, inScope };
  }

  it('lists a requirement the reviewer excluded with the out-of-scope label', () => {
    const scope = fixtureScope();
    const excludedItem: ScopeItem = { ...(scope.items.at(2) as ScopeItem), id: 'FR_09', inScope: false };
    const statements = buildOutOfScope(withItems(scope, excludedItem));
    const excludedStatement = statements.find((statement) => statement.refs.includes('FR_09'));
    expect(excludedStatement?.label).toBe('out-of-scope');
    expect(excludedStatement?.text).toContain("is excluded from this engagement's scope");
  });

  it('quotes the customer when their own words exclude a requirement', () => {
    const base = fixtureScope().items.at(0) as ScopeItem;
    const statements = buildOutOfScope(withItems(fixtureScope(), quoted(base, 'BR_09', 'business', EXCLUDED_QUOTE, false)));
    const statement = statements.find((candidate) => candidate.refs.includes('BR_09'));
    expect(statement?.label).toBe('out-of-scope');
    expect(statement?.text).toContain('BR_09');
    expect(statement?.text).toContain(`the customer states "${EXCLUDED_QUOTE}"`);
  });

  it('lists a constraint whose customer quote excludes something, but not a gap repeating an excluded requirement quote', () => {
    const base = fixtureScope().items.at(0) as ScopeItem;
    const policyQuote = 'The Policy Admin System is being retired by a different program and is out of scope for this engagement.';
    const scope = withItems(
      fixtureScope(),
      quoted(base, 'BR_09', 'business', EXCLUDED_QUOTE, false),
      quoted(base, 'GAP_09', 'gap', EXCLUDED_QUOTE, true),
      quoted(base, 'CON_09', 'constraint', policyQuote, true),
    );
    const statements = buildOutOfScope(scope);
    expect(statements.find((statement) => statement.refs.includes('CON_09'))?.text).toContain(policyQuote);
    expect(statements.some((statement) => statement.refs.includes('GAP_09'))).toBe(false);
  });

  it('labels the standard exclusions as assumptions to confirm and cites the items they qualify', () => {
    const statements = buildOutOfScope(fixtureScope());
    expect(statements).toHaveLength(3);
    expect(statements.every((statement) => statement.label === 'assumption-to-confirm')).toBe(true);
    expect(statements.map((statement) => statement.refs)).toEqual([[], ['DATA_01'], ['SYS_01']]);
  });
});
