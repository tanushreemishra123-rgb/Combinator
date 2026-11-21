import { describe, expect, it } from 'vitest';
import type { WorkflowStep } from '../engine/types';
import { flattenSteps } from '../engine/util';
import { mkAi, mkCondition, mkInput, mkOutput, mkSafeStop, mkTool, mkValidator } from '../puzzles/blocks';
import {
  applyFallbackUpgrade,
  applyRetryUpgrade,
  insertStep,
  moveStep,
  nudgeStep,
  removeStep,
  updateStep,
} from './workflowOps';

const base = (): WorkflowStep[] => [
  mkInput(),
  mkAi('ai', 'Think', 'task', 'provider'),
  mkOutput(),
];

const labels = (steps: WorkflowStep[]) => steps.map((s) => s.id);

describe('insertStep', () => {
  it('inserts between the locked Input and Output steps', () => {
    const { next, error } = insertStep(base(), { path: { kind: 'main' }, index: 2 }, mkValidator('v', 'V', 's'));
    expect(error).toBeUndefined();
    expect(labels(next)).toEqual(['step-input', 'ai', 'v', 'step-output']);
  });

  it('clamps an index before Input to just after it', () => {
    const { next } = insertStep(base(), { path: { kind: 'main' }, index: 0 }, mkValidator('v', 'V', 's'));
    expect(labels(next)).toEqual(['step-input', 'v', 'ai', 'step-output']);
  });

  it('clamps an index past Output to just before it', () => {
    const { next } = insertStep(base(), { path: { kind: 'main' }, index: 99 }, mkValidator('v', 'V', 's'));
    expect(labels(next)).toEqual(['step-input', 'ai', 'v', 'step-output']);
  });

  it('inserts into a condition branch', () => {
    const wf = [mkInput(), mkCondition('c', 'C', 'cond'), mkOutput()];
    const { next } = insertStep(wf, { path: { kind: 'branch', conditionId: 'c', branch: 'else' }, index: 0 }, mkSafeStop('s', 'Stop', 'no'));
    const cond = next[1];
    expect(cond.kind === 'condition' && labels(cond.branches.else)).toEqual(['s']);
  });

  it('refuses to nest a condition inside a branch', () => {
    const wf = [mkInput(), mkCondition('c', 'C', 'cond'), mkOutput()];
    const { next, error } = insertStep(wf, { path: { kind: 'branch', conditionId: 'c', branch: 'then' }, index: 0 }, mkCondition('c2', 'C2', 'cond'));
    expect(error).toMatch(/cannot be nested/i);
    expect(next).toEqual(wf);
  });
});

describe('removeStep', () => {
  it('removes an unlocked step', () => {
    const wf = [mkInput(), mkAi('ai', 'Think', 't', 'p'), mkValidator('v', 'V', 's'), mkOutput()];
    expect(labels(removeStep(wf, 'v').next)).toEqual(['step-input', 'ai', 'step-output']);
  });

  it('refuses to remove locked Input/Output', () => {
    const wf = base();
    const out = removeStep(wf, 'step-input');
    expect(out.error).toMatch(/cannot be removed/i);
    expect(out.next).toEqual(wf);
  });

  it('removes a step nested inside a branch', () => {
    const wf = [mkInput(), mkCondition('c', 'C', 'cond', { else: [mkSafeStop('s', 'Stop', 'no')] }), mkOutput()];
    const cond = removeStep(wf, 's').next[1];
    expect(cond.kind === 'condition' && cond.branches.else).toEqual([]);
  });
});

describe('nudgeStep', () => {
  it('swaps two adjacent unlocked steps', () => {
    const wf = [mkInput(), mkAi('ai', 'A', 't', 'p'), mkValidator('v', 'V', 's'), mkOutput()];
    expect(labels(nudgeStep(wf, 'v', -1).next)).toEqual(['step-input', 'v', 'ai', 'step-output']);
  });

  it('will not push a step past a locked neighbour', () => {
    const wf = [mkInput(), mkAi('ai', 'A', 't', 'p'), mkOutput()];
    expect(labels(nudgeStep(wf, 'ai', -1).next)).toEqual(labels(wf));
    expect(labels(nudgeStep(wf, 'ai', 1).next)).toEqual(labels(wf));
  });

  it('is a no-op at a sequence boundary', () => {
    const wf = [mkInput(), mkCondition('c', 'C', 'cond', { then: [mkSafeStop('s', 'S', 'x')] }), mkOutput()];
    const cond = nudgeStep(wf, 's', -1).next[1];
    expect(cond.kind === 'condition' && labels(cond.branches.then)).toEqual(['s']);
  });
});

describe('moveStep', () => {
  it('moves a step from the main sequence into a branch', () => {
    const wf = [mkInput(), mkCondition('c', 'C', 'cond'), mkValidator('v', 'V', 's'), mkOutput()];
    const { next, error } = moveStep(wf, 'v', { path: { kind: 'branch', conditionId: 'c', branch: 'then' }, index: 0 });
    expect(error).toBeUndefined();
    expect(labels(next)).toEqual(['step-input', 'c', 'step-output']);
    const cond = next[1];
    expect(cond.kind === 'condition' && labels(cond.branches.then)).toEqual(['v']);
  });

  it('carries a condition’s branch contents when the condition itself moves', () => {
    const wf = [
      mkInput(),
      mkAi('ai', 'A', 't', 'p'),
      mkCondition('c', 'C', 'cond', { else: [mkSafeStop('s', 'S', 'x')] }),
      mkOutput(),
    ];
    const { next } = moveStep(wf, 'c', { path: { kind: 'main' }, index: 1 });
    expect(labels(next)).toEqual(['step-input', 'c', 'ai', 'step-output']);
    const cond = next[1];
    expect(cond.kind === 'condition' && labels(cond.branches.else)).toEqual(['s']);
  });

  it('refuses to move a condition into its own branch', () => {
    const wf = [mkInput(), mkCondition('c', 'C', 'cond'), mkOutput()];
    const { next, error } = moveStep(wf, 'c', { path: { kind: 'branch', conditionId: 'c', branch: 'then' }, index: 0 });
    expect(error).toBeTruthy();
    expect(next).toEqual(wf);
  });

  it('refuses to move locked steps', () => {
    const wf = base();
    expect(moveStep(wf, 'step-output', { path: { kind: 'main' }, index: 1 }).error).toBeTruthy();
  });
});

describe('upgrades', () => {
  it('attaches a retry budget to an AI step', () => {
    const { next } = applyRetryUpgrade(base(), 'ai', 2);
    const ai = next[1];
    expect(ai.kind === 'ai' && ai.upgrades.retry?.attempts).toBe(2);
  });

  it('refuses to attach upgrades to non-resilient steps', () => {
    const wf = [mkInput(), mkValidator('v', 'V', 's'), mkOutput()];
    expect(applyRetryUpgrade(wf, 'v', 2).error).toMatch(/AI and Tool steps/i);
  });

  it('rejects a tool fallback on an AI step and vice versa', () => {
    expect(applyFallbackUpgrade(base(), 'ai', { type: 'tool', toolId: 't' }).error).toMatch(/tool/i);
    const toolWf = [mkInput(), mkTool('t1', 'T', 'tool'), mkOutput()];
    expect(applyFallbackUpgrade(toolWf, 't1', { type: 'provider', providerId: 'p' }).error).toMatch(/model/i);
  });

  it('accepts a safe-default fallback on either kind', () => {
    expect(applyFallbackUpgrade(base(), 'ai', { type: 'default', defaultId: 'd' }).error).toBeUndefined();
    const toolWf = [mkInput(), mkTool('t1', 'T', 'tool'), mkOutput()];
    expect(applyFallbackUpgrade(toolWf, 't1', { type: 'default', defaultId: 'd' }).error).toBeUndefined();
  });
});

describe('updateStep', () => {
  it('patches a step nested in a branch without touching siblings', () => {
    const wf = [mkInput(), mkCondition('c', 'C', 'cond', { then: [mkSafeStop('s', 'S', 'old')] }), mkOutput()];
    const next = updateStep(wf, 's', { label: 'New label' } as Partial<WorkflowStep>);
    const found = flattenSteps(next).find((x) => x.id === 's');
    expect(found?.label).toBe('New label');
    expect(flattenSteps(next)).toHaveLength(4);
  });
});
