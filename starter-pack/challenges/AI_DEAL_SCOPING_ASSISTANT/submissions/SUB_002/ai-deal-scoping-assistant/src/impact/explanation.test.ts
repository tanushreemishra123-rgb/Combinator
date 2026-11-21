import { describe, expect, it } from 'vitest';
import type { ImpactContext } from '../ai/types';
import type { ImpactEntry, UnaffectedEntry } from '../domain';
import { buildImpactPrompt, IMPACT_EXPLANATION_TASK, planImpactExplanation } from './explanation';

function context(affected: ImpactEntry[], unaffected: UnaffectedEntry[]): ImpactContext {
  return {
    task: 'explain-change-impact',
    change: { kind: 'expected-users', targetId: 'expectedUsers', label: 'Expected users increased from 5,000 to 500,000', from: '5,000', to: '500,000' },
    affected,
    unaffected,
  };
}

const SCALABILITY_ENTRY: ImpactEntry = { section: 'architecture', area: 'Scalability architecture', elementIds: ['ARC_02'], reason: 'ARC_02 cites NFR_02, which states an availability, performance or scalability target.', action: 'regenerate' };
const ROM_ENTRY: ImpactEntry = { section: 'commercials', area: 'ROM estimate', elementIds: ['WS_04', 'WS_05'], reason: 'The volume-dependent workstreams are re-priced.', action: 'recalculate' };
const PERSONAS_UNAFFECTED: UnaffectedEntry = { section: 'prd', area: 'Customer personas and user journeys', reason: 'User volume does not change who the users are or what they need to do.' };

describe('planImpactExplanation', () => {
  it('opens with the change label', () => {
    const explanation = planImpactExplanation(context([], []));
    expect(explanation.startsWith('Change: Expected users increased from 5,000 to 500,000.')).toBe(true);
  });

  it('states that nothing needs regenerating when nothing is affected', () => {
    const explanation = planImpactExplanation(context([], []));
    expect(explanation).toContain('No generated deliverable depends on this change');
  });

  it('describes every affected section, its area and its action', () => {
    const explanation = planImpactExplanation(context([SCALABILITY_ENTRY, ROM_ENTRY], []));
    expect(explanation).toContain('Scalability architecture');
    expect(explanation).toContain('must be regenerated');
    expect(explanation).toContain('ROM estimate');
    expect(explanation).toContain('must be recalculated');
  });

  it('groups unaffected areas that share the same reason and explains what stays untouched', () => {
    const explanation = planImpactExplanation(context([SCALABILITY_ENTRY], [PERSONAS_UNAFFECTED]));
    expect(explanation).toContain('What stays untouched');
    expect(explanation).toContain('Customer personas and user journeys');
  });

  it('never invents an area or reason beyond the supplied lists', () => {
    const explanation = planImpactExplanation(context([SCALABILITY_ENTRY], [PERSONAS_UNAFFECTED]));
    expect(explanation).not.toMatch(/undefined|null|NaN|\[object Object]/);
  });

  it('always ends with the preservation note', () => {
    const explanation = planImpactExplanation(context([SCALABILITY_ENTRY], []));
    expect(explanation.endsWith('Only the sections listed as affected are marked stale; reviewed content everywhere else is preserved and is never replaced without the reviewer choosing to regenerate it.')).toBe(true);
  });
});

describe('buildImpactPrompt', () => {
  it('lists every affected and unaffected area in the prompt body', () => {
    const { prompt } = buildImpactPrompt(context([SCALABILITY_ENTRY], [PERSONAS_UNAFFECTED]));
    expect(prompt).toContain('Scalability architecture');
    expect(prompt).toContain('Customer personas and user journeys');
    expect(prompt).toContain('CHANGE: Expected users increased from 5,000 to 500,000');
  });

  it('lists "none" for an empty affected or unaffected list', () => {
    const { prompt } = buildImpactPrompt(context([], []));
    expect(prompt).toContain('AFFECTED AREAS');
    expect(prompt).toContain('- none');
  });

  it('instructs the model to describe only the given lists and never invent numbers', () => {
    const { system } = buildImpactPrompt(context([], []));
    expect(system).toContain('authoritative');
    expect(system).toContain('never invent effort, cost or timeline figures');
  });
});

describe('IMPACT_EXPLANATION_TASK', () => {
  it('is wired to the explain-change-impact task id and the prompt builder', () => {
    expect(IMPACT_EXPLANATION_TASK.id).toBe('explain-change-impact');
    expect(IMPACT_EXPLANATION_TASK.buildPrompt).toBe(buildImpactPrompt);
  });
});
