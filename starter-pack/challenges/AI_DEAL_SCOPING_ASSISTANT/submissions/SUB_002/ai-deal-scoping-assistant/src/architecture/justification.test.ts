import { describe, expect, it } from 'vitest';
import type { ScopeItem, ScopeModel } from '../domain';
import { REQUIREMENT_KINDS } from '../domain';
import { fixtureConfig, fixtureScope } from '../test/fixtures';
import type { ConditionalRule, FoundationRule } from './componentRules.data';
import {
  CITABLE_REQUIREMENT_KINDS,
  gapOnlyTrigger,
  isLowConfidenceJustification,
  justifyConditional,
  justifyFoundation,
  matchedItemsForConditional,
} from './justification';

function withItems(scope: ScopeModel, extra: ScopeItem[]): ScopeModel {
  return { ...scope, items: [...scope.items, ...extra] };
}

/** A fixture item to use as a spread base for a hand-built variant, never undefined. */
function fixtureItemAt(index: number): ScopeItem {
  const found = fixtureScope().items.at(index);
  if (found === undefined) {
    throw new Error(`fixtureScope has no item at index ${index}`);
  }
  return found;
}

function foundationRule(overrides: Partial<FoundationRule> = {}): FoundationRule {
  return {
    key: 'test-rule',
    logicalComponent: 'managed-relational-db',
    name: 'Test Component',
    purpose: 'Test purpose.',
    rationaleFragment: 'does the test thing',
    tradeOffs: [],
    dependencies: [],
    securityConsiderations: [],
    nfrSecSignals: ['nfr:does-not-exist'],
    ...overrides,
  };
}

function conditionalRule(overrides: Partial<ConditionalRule> = {}): ConditionalRule {
  return {
    key: 'test-conditional',
    logicalComponent: 'search-index',
    name: 'Test Conditional Component',
    purpose: 'Test purpose.',
    rationaleFragment: 'does the test thing',
    tradeOffs: [],
    dependencies: [],
    securityConsiderations: [],
    triggerSignals: ['capability:search'],
    ...overrides,
  };
}

describe('CITABLE_REQUIREMENT_KINDS', () => {
  it('is exactly the requirement kinds plus technology preferences', () => {
    expect(CITABLE_REQUIREMENT_KINDS).toEqual([...REQUIREMENT_KINDS, 'technology']);
  });

  it('never includes persona, risk, gap, question, dependency or existingSystem', () => {
    for (const excluded of ['persona', 'risk', 'gap', 'question', 'dependency', 'existingSystem']) {
      expect(CITABLE_REQUIREMENT_KINDS).not.toContain(excluded);
    }
  });
});

describe('justifyFoundation', () => {
  it('cites a direct NFR/security item carrying the rule’s own signal first', () => {
    const rule = foundationRule({ nfrSecSignals: ['nfr:availability'] });
    const justification = justifyFoundation(fixtureScope(), rule);
    expect(justification?.requirementIds).toEqual(['NFR_01']);
  });

  it('falls back to a related signal, but never cites a persona sharing that signal', () => {
    const scope = withItems(fixtureScope(), [
      { ...fixtureItemAt(0), id: 'PER_99', kind: 'persona', title: 'Ops persona', description: 'Shares the signal but is not citable.', signals: ['nfr:scalability'] },
    ]);
    const rule = foundationRule({ nfrSecSignals: ['nfr:not-present'], relatedSignals: ['nfr:scalability'] });
    const justification = justifyFoundation(scope, rule);
    expect(justification?.requirementIds).toEqual(['NFR_02']);
    expect(justification?.requirementIds).not.toContain('PER_99');
  });

  it('related-kind matches trust the rule author’s exact kind (e.g. a constraint for CI/CD)', () => {
    const rule = foundationRule({ nfrSecSignals: ['nfr:not-present'], relatedKinds: ['constraint'] });
    const justification = justifyFoundation(fixtureScope(), rule);
    expect(justification?.requirementIds).toEqual(['CON_01']);
  });

  it('falls back to the highest-priority functional requirements, never the full list, as a last resort', () => {
    const rule = foundationRule({ nfrSecSignals: ['nfr:not-present'] });
    const justification = justifyFoundation(fixtureScope(), rule);
    // fixtureScope has 3 functional requirements (FR_01 High, FR_02 Medium, FR_03 Low); all 3 fit
    // under the 3-item cap, so this only proves the cap exists, not that it bites - see the next test.
    expect(justification?.requirementIds).toEqual(['FR_01', 'FR_02', 'FR_03']);
  });

  it('caps the last-resort fallback at the top 3 functional requirements even when more exist', () => {
    const scope = withItems(fixtureScope(), [
      { ...fixtureItemAt(2), id: 'FR_90', title: 'Extra requirement A', priority: 'Medium' },
      { ...fixtureItemAt(2), id: 'FR_91', title: 'Extra requirement B', priority: 'Medium' },
    ]);
    const rule = foundationRule({ nfrSecSignals: ['nfr:not-present'] });
    const justification = justifyFoundation(scope, rule);
    expect(justification?.requirementIds.length).toBe(3);
    expect(justification?.requirementIds).toContain('FR_01'); // the one High-priority requirement always wins a slot
  });

  it('falls back to a reviewed assumption only once no functional requirement exists at all', () => {
    const scope: ScopeModel = { ...fixtureScope(), items: fixtureScope().items.filter((i) => i.kind !== 'functional') };
    const rule = foundationRule({ nfrSecSignals: ['nfr:not-present'] });
    const justification = justifyFoundation(scope, rule);
    expect(justification?.requirementIds).toEqual([]);
    expect(justification?.assumptionIds).toEqual(['ASM_01']);
  });

  it('returns null when nothing at all justifies the component', () => {
    const scope: ScopeModel = { ...fixtureScope(), items: [] };
    const rule = foundationRule({ nfrSecSignals: ['nfr:not-present'] });
    expect(justifyFoundation(scope, rule)).toBeNull();
  });
});

describe('matchedItemsForConditional / justifyConditional', () => {
  it('excludes a triggering item whose kind is not citable (a gap sharing the trigger signal)', () => {
    const scope = withItems(fixtureScope(), [
      { ...fixtureItemAt(0), id: 'GAP_90', kind: 'gap', title: 'Search scope unclear', description: 'x', signals: ['capability:search'] },
    ]);
    const rule = conditionalRule({ triggerSignals: ['capability:search'] });
    const matched = matchedItemsForConditional(scope, rule);
    expect(matched.map((i) => i.id)).toEqual(['FR_02']);
  });

  it('excludes a triggering item whose kind does not match requireKind (a functional item sharing an NFR signal)', () => {
    const scope = withItems(fixtureScope(), [
      { ...fixtureItemAt(2), id: 'FR_90', kind: 'functional', title: 'Assistant availability through the portal', description: 'x', signals: ['nfr:availability'] },
    ]);
    const rule = conditionalRule({ triggerSignals: ['nfr:availability'], requireKind: 'nonFunctional' });
    const matched = matchedItemsForConditional(scope, rule);
    expect(matched.map((i) => i.id)).toEqual(['NFR_01']);
    expect(matched.map((i) => i.id)).not.toContain('FR_90');
  });

  it('cites the functional/assumption fallback for a config-only trigger with no matching signal', () => {
    const rule = conditionalRule({ triggerSignals: ['signal:not-present'], additionalTrigger: () => true });
    const justification = justifyConditional(fixtureScope(), fixtureConfig(), rule);
    expect(justification?.requirementIds.length).toBeGreaterThan(0);
  });

  it('returns null when neither a signal nor the additional trigger matches', () => {
    const rule = conditionalRule({ triggerSignals: ['signal:not-present'] });
    expect(justifyConditional(fixtureScope(), fixtureConfig(), rule)).toBeNull();
  });
});

describe('gapOnlyTrigger', () => {
  it('surfaces the unresolved gap that would have triggered a component if it were citable', () => {
    const scope = withItems(fixtureScope(), [
      { ...fixtureItemAt(0), id: 'GAP_90', kind: 'gap', title: 'Mobile vs web undecided', description: 'x', signals: ['capability:mobile'] },
    ]);
    const rule = conditionalRule({ triggerSignals: ['capability:mobile'] });
    const gap = gapOnlyTrigger(scope, fixtureConfig(), rule);
    expect(gap?.id).toBe('GAP_90');
  });

  it('returns null once the component is already justified another way', () => {
    const rule = conditionalRule({ triggerSignals: ['capability:search'] });
    expect(gapOnlyTrigger(fixtureScope(), fixtureConfig(), rule)).toBeNull();
  });

  it('returns null when the rule never triggered at all', () => {
    const rule = conditionalRule({ triggerSignals: ['signal:not-present'] });
    expect(gapOnlyTrigger(fixtureScope(), fixtureConfig(), rule)).toBeNull();
  });
});

describe('isLowConfidenceJustification', () => {
  it('is true when every citing item is Low-priority', () => {
    const lowItem = fixtureScope().items.find((i) => i.id === 'FR_03');
    expect(lowItem).toBeDefined();
    expect(isLowConfidenceJustification(fixtureScope(), lowItem === undefined ? [] : [lowItem])).toBe(true);
  });

  it('is true when the citing item is tied to an unresolved gap even at Medium/High priority', () => {
    const item = fixtureScope().items.find((i) => i.id === 'INT_01');
    expect(item).toBeDefined();
    // INT_01 relatedIds include GAP_01, which fixtureScope leaves unresolved.
    expect(isLowConfidenceJustification(fixtureScope(), item === undefined ? [] : [item])).toBe(true);
  });

  it('is false once any citing item is not Low-priority and has no unresolved related gap/question', () => {
    const item = fixtureScope().items.find((i) => i.id === 'NFR_01');
    expect(item).toBeDefined();
    expect(isLowConfidenceJustification(fixtureScope(), item === undefined ? [] : [item])).toBe(false);
  });

  it('is false for an empty citation list', () => {
    expect(isLowConfidenceJustification(fixtureScope(), [])).toBe(false);
  });
});
