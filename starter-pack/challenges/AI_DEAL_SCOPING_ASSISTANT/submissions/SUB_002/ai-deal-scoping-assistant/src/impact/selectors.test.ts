/**
 * The requirements-with-signals and cites-signals selectors both resolve through the same
 * "reviewed requirement carries this signal" helper, so a scope item that only carries the
 * taxonomy signal by coincidence (a gap or question whose text happens to match a keyword)
 * must not be reported as a requirement that states the target phrase.
 */
import type { AnalysisContext, AreaRule } from './types';
import type { ScopeItem, ScopeItemKind } from '../domain';
import { resolveSelector } from './selectors';

const TARGET_PHRASE = 'an availability, performance or scalability target';

function scopeItem(id: string, kind: ScopeItemKind, signals: readonly string[]): ScopeItem {
  return {
    id,
    kind,
    title: `${id} title`,
    description: `${id} description`,
    priority: 'Medium',
    provenance: 'customer-stated',
    source: null,
    relatedIds: [],
    affectsInputs: [],
    critical: false,
    signals: [...signals],
    review: 'approved',
    inScope: true,
    userEdited: false,
    resolved: false,
    resolution: '',
  };
}

function contextWith(items: readonly ScopeItem[]): AnalysisContext {
  return {
    change: { kind: 'expected-users', targetId: 'expectedUsers', label: 'Expected users', from: '100000', to: '500000' },
    elements: [],
    generated: new Set(),
    items,
    target: undefined,
    rootIds: [],
    directIds: new Set(),
  };
}

const REQUIREMENTS_WITH_SIGNALS_RULE: AreaRule = {
  section: 'estimate',
  area: 'Volume-bound requirements',
  action: 'recalculate',
  selector: { type: 'requirements-with-signals', signals: ['nfr:performance'], targetPhrase: TARGET_PHRASE },
  because: 'Expected users drives the sizing of volume-bound requirements.',
};

describe('resolveSelector - requirements-with-signals', () => {
  it('matches a genuine reviewed requirement carrying the signal', () => {
    const requirement = scopeItem('NFR_01', 'nonFunctional', ['nfr:performance']);
    const resolution = resolveSelector(REQUIREMENTS_WITH_SIGNALS_RULE, contextWith([requirement]));
    expect(resolution.matched).toBe(true);
    if (resolution.matched) {
      expect(resolution.elementIds).toEqual(['NFR_01']);
      expect(resolution.evidence).toContain(TARGET_PHRASE);
    }
  });

  it('does not report a gap or question as stating a target it does not state (S6-5)', () => {
    const gap = scopeItem('GAP_02', 'gap', ['nfr:performance']);
    const question = scopeItem('Q_02', 'question', ['nfr:performance']);
    const resolution = resolveSelector(REQUIREMENTS_WITH_SIGNALS_RULE, contextWith([gap, question]));
    expect(resolution.matched).toBe(false);
    if (!resolution.matched) {
      expect(resolution.reason).toContain('No reviewed requirement states');
    }
  });

  it('reports only the genuine requirement when a gap in the same scope shares the signal', () => {
    const requirement = scopeItem('NFR_01', 'nonFunctional', ['nfr:performance']);
    const gap = scopeItem('GAP_02', 'gap', ['nfr:performance']);
    const resolution = resolveSelector(REQUIREMENTS_WITH_SIGNALS_RULE, contextWith([requirement, gap]));
    expect(resolution.matched).toBe(true);
    if (resolution.matched) {
      expect(resolution.elementIds).toEqual(['NFR_01']);
    }
  });

  it('still excludes a risk or dependency item, the other two open-item kinds', () => {
    const risk = scopeItem('RSK_01', 'risk', ['nfr:performance']);
    const dependency = scopeItem('DEP_01', 'dependency', ['nfr:performance']);
    const resolution = resolveSelector(REQUIREMENTS_WITH_SIGNALS_RULE, contextWith([risk, dependency]));
    expect(resolution.matched).toBe(false);
  });
});

describe('resolveSelector - cites-signals', () => {
  const citesRule: AreaRule = { ...REQUIREMENTS_WITH_SIGNALS_RULE, selector: { type: 'cites-signals', signals: ['nfr:performance'], targetPhrase: TARGET_PHRASE } };

  it('does not treat an element that only cites a gap as citing a stated target', () => {
    const gap = scopeItem('GAP_02', 'gap', ['nfr:performance']);
    const context: AnalysisContext = { ...contextWith([gap]), elements: [{ section: 'estimate', id: 'WS_01', display: 'WS_01', refs: ['GAP_02'], facets: [] }] };
    const resolution = resolveSelector(citesRule, context);
    expect(resolution.matched).toBe(false);
  });

  it('matches an element that cites a genuine requirement carrying the signal', () => {
    const requirement = scopeItem('NFR_01', 'nonFunctional', ['nfr:performance']);
    const context: AnalysisContext = { ...contextWith([requirement]), elements: [{ section: 'estimate', id: 'WS_01', display: 'WS_01', refs: ['NFR_01'], facets: [] }] };
    const resolution = resolveSelector(citesRule, context);
    expect(resolution.matched).toBe(true);
    if (resolution.matched) {
      expect(resolution.elementIds).toEqual(['WS_01']);
    }
  });
});
