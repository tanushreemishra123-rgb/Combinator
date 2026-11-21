import type { ScopeItem, ScopeModel } from '../domain';
import { createDefaultSolutionConfig } from '../seed/estimationDefaults';
import { fixtureScope } from '../test/fixtures';
import { detectMissingInputs, limitationFor, OVERALL_ESTIMATE_COMPONENT, TIMELINE_COMPONENT } from './missingInputs';
import type { WorkstreamFacts } from './missingInputs';
import { completeConfig, emptyScope, resolveItems } from './testing/estimateFixtures';

/** A critical gap and a critical question that are related to each other and leave the same input open. */
function pairedOpenItemsScope(): ScopeModel {
  const gap: ScopeItem = {
    id: 'GAP_09',
    kind: 'gap',
    title: 'Active member count unknown',
    description: 'No confirmed active member count is available yet.',
    priority: 'Medium',
    provenance: 'ai-inferred',
    source: null,
    relatedIds: [],
    affectsInputs: ['expectedUsers'],
    critical: true,
    signals: [],
    review: 'approved',
    inScope: true,
    userEdited: false,
    resolved: false,
    resolution: '',
  };
  const question: ScopeItem = { ...gap, id: 'Q_09', kind: 'question', title: 'What is the current member count?', relatedIds: ['GAP_09'] };
  return { summary: 'Paired open items', items: [gap, question], version: 1, approvedAt: null, approvedVersion: null, issues: [] };
}

function facts(id: string, extra: Partial<WorkstreamFacts> = {}): WorkstreamFacts {
  return { id, driverTypes: [], refIds: [], blockedDrivers: [], unpricedRoles: [], unmixedTypes: [], ...extra };
}

function first<T>(entries: readonly T[]): T {
  const entry = entries.at(0);
  if (entry === undefined) {
    throw new Error('Expected at least one missing input');
  }
  return entry;
}

const WORKSTREAMS: readonly WorkstreamFacts[] = [
  facts('WS_01', { driverTypes: ['capability', 'infrastructure'] }),
  facts('WS_02', { driverTypes: ['integration'] }),
  facts('WS_03', { driverTypes: ['ai'] }),
];

describe('detectMissingInputs', () => {
  it('reports nothing when every input is provided and no gap is open', () => {
    expect(detectMissingInputs({ scope: emptyScope(), config: completeConfig(), workstreams: WORKSTREAMS })).toEqual([]);
  });

  it('maps null configuration values to the infrastructure workstreams and the timeline', () => {
    const missing = detectMissingInputs({ scope: emptyScope(), config: createDefaultSolutionConfig(), workstreams: WORKSTREAMS });
    expect(missing.map((entry) => [entry.key, entry.affected])).toEqual([
      ['expectedUsers', ['WS_01']],
      ['environments', ['WS_01']],
      ['targetRegions', ['WS_01']],
      ['deliveryDeadline', [TIMELINE_COMPONENT]],
    ]);
    expect(missing.every((entry) => entry.effect === 'confidence-reduced' && entry.howToResolve.length > 0)).toBe(true);
  });

  it('links open gaps and questions to the input they leave unknown', () => {
    const missing = detectMissingInputs({ scope: fixtureScope(), config: completeConfig({ deliveryDeadlineWeeks: null }), workstreams: WORKSTREAMS });
    const readiness = missing.find((entry) => entry.key === 'integrationReadiness');
    expect(readiness).toEqual(expect.objectContaining({ affected: ['WS_02'], relatedScopeIds: ['GAP_01'], label: 'Integration readiness' }));
    expect(readiness?.howToResolve).toContain('GAP_01 "CRM API readiness unknown"');
    expect(missing.find((entry) => entry.key === 'deliveryDeadline')?.relatedScopeIds).toEqual(['Q_02']);
  });

  it('stops reporting a scope-backed input once its gap is resolved', () => {
    const scope = resolveItems(fixtureScope(), ['GAP_01']);
    const missing = detectMissingInputs({ scope, config: completeConfig(), workstreams: WORKSTREAMS });
    expect(missing).toEqual([]);
  });

  it('ignores a configured input that no workstream depends on and no open item holds open', () => {
    const missing = detectMissingInputs({
      scope: emptyScope(),
      config: completeConfig({ expectedUsers: null }),
      workstreams: [facts('WS_01', { driverTypes: ['capability'] })],
    });
    expect(missing).toEqual([]);
  });

  it('attributes an input held open by a gap to the workstreams sharing its requirements when none has its driver type', () => {
    const missing = detectMissingInputs({
      scope: fixtureScope(),
      config: completeConfig(),
      workstreams: [facts('WS_01', { driverTypes: ['capability'], refIds: ['INT_01'] }), facts('WS_02', { driverTypes: ['capability'], refIds: ['FR_02'] })],
    });
    expect(missing.map((entry) => [entry.key, entry.affected, entry.relatedScopeIds])).toEqual([['integrationReadiness', ['WS_01'], ['GAP_01']]]);
  });

  it('falls back to the overall estimate when no workstream shares requirements with the open item', () => {
    const missing = detectMissingInputs({ scope: fixtureScope(), config: completeConfig(), workstreams: [facts('WS_01', { driverTypes: ['capability'] })] });
    expect(missing.map((entry) => [entry.key, entry.affected])).toEqual([['integrationReadiness', [OVERALL_ESTIMATE_COMPONENT]]]);
    expect(missing.at(0)?.effect).toBe('confidence-reduced');
  });

  it('blocks the calculation for unpriced roles, unmixed effort and unsized drivers', () => {
    const missing = detectMissingInputs({
      scope: emptyScope(),
      config: completeConfig(),
      workstreams: [
        facts('WS_01', { driverTypes: ['data'], unpricedRoles: [{ roleId: 'data-engineer', label: 'Data Engineer' }] }),
        facts('WS_02', { driverTypes: ['data', 'ai'], unpricedRoles: [{ roleId: 'data-engineer', label: 'Data Engineer' }], unmixedTypes: ['ai'] }),
        facts('WS_03', { driverTypes: ['security'], blockedDrivers: [{ id: 'DRV_09', type: 'security', complexity: 'Very High' }] }),
      ],
    });
    expect(missing.map((entry) => [entry.key, entry.label, entry.affected])).toEqual([
      ['scopeDrivers', 'Base effort for Very High security control drivers', ['WS_03']],
      ['roleRate', 'Day rate for Data Engineer', ['WS_01', 'WS_02']],
      ['roleRate', 'Role mix for AI use case effort', ['WS_02']],
    ]);
    expect(missing.every((entry) => entry.effect === 'calculation-blocked')).toBe(true);
  });

  it('reports missing scope drivers when there is nothing to estimate', () => {
    const missing = detectMissingInputs({ scope: emptyScope(), config: completeConfig(), workstreams: [facts('WS_PH_1')] });
    expect(missing.at(0)).toEqual(expect.objectContaining({ key: 'scopeDrivers', effect: 'calculation-blocked' }));
    expect(missing.at(0)?.affected).toContain('ROM commercials');
  });
});

describe('limitationFor', () => {
  const scope = fixtureScope();

  it('is Low for an input held open by a critical gap', () => {
    const readiness = first(detectMissingInputs({ scope, config: completeConfig(), workstreams: WORKSTREAMS }));
    expect(limitationFor(readiness, scope)).toEqual({
      level: 'Low',
      text: 'External API readiness has not been confirmed. Critical and unresolved: GAP_01 "CRM API readiness unknown".',
    });
  });

  it('cites a gap and a question that track the same unknown together, not as two limitations', () => {
    const paired = pairedOpenItemsScope();
    const users = first(detectMissingInputs({ scope: paired, config: createDefaultSolutionConfig(), workstreams: WORKSTREAMS }));
    const limitation = limitationFor(users, paired);
    expect(limitation.level).toBe('Low');
    expect(limitation.text).toContain('GAP_09 "Active member count unknown"');
    expect(limitation.text).toContain('tracked together with Q_09');
    expect(limitation.text.match(/GAP_09/g)).toHaveLength(1);
    expect(limitation.text.match(/Q_09/g)).toHaveLength(1);
  });

  it('is Medium for a missing configuration value without a critical blocker', () => {
    const users = first(detectMissingInputs({ scope: emptyScope(), config: completeConfig({ expectedUsers: null }), workstreams: WORKSTREAMS }));
    expect(limitationFor(users, emptyScope()).level).toBe('Medium');
  });

  it('is Low for a blocked calculation', () => {
    const rate = first(
      detectMissingInputs({
        scope: emptyScope(),
        config: completeConfig(),
        workstreams: [facts('WS_01', { driverTypes: ['data'], unpricedRoles: [{ roleId: 'qa-engineer', label: 'QA Engineer' }] })],
      }),
    );
    expect(limitationFor(rate, emptyScope())).toEqual({
      level: 'Low',
      text: 'Day rate for QA Engineer is not configured, so the cost of this workstream cannot be calculated.',
    });
  });
});
