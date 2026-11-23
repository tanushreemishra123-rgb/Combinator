import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runWorkflow } from './engine';
import type { HumanDecision, HumanPrompt, WorkflowStep } from './types';
import type { Puzzle } from '../puzzles/types';
import { makeKit } from '../puzzles/types';
import { failWith, mkAi, mkCondition, mkInput, mkOutput, mkSafeStop, mkTool, mkValidator, ok, timeout } from '../puzzles/blocks';

/** A tiny synthetic puzzle exercising every engine behaviour. */
const lab: Puzzle = {
  id: 'lab',
  order: 0,
  title: 'Engine lab',
  emoji: '🧪',
  difficulty: 'beginner',
  tagline: '',
  objective: '',
  learning: [],
  expected: { description: '', schemaId: 'thing' },
  samples: [{ id: 's1', label: 'sample', value: { n: 1 }, preview: '' }],
  providers: [
    { id: 'big', name: 'Big', blurb: '', tier: 'primary' },
    { id: 'small', name: 'Small', blurb: '', tier: 'fallback' },
  ],
  tasks: [
    {
      id: 'flaky-twice',
      name: '',
      description: '',
      expectsJson: true,
      mock: ({ attempt }) => (attempt <= 2 ? timeout('Big', 5000) : ok({ label: 'from big', score: 0.9 })),
    },
    {
      id: 'always-down',
      name: '',
      description: '',
      expectsJson: true,
      mock: ({ providerId }) => (providerId === 'small' ? ok({ label: 'from small', score: 0.5 }) : timeout('Big', 5000)),
    },
    {
      id: 'sloppy-then-clean',
      name: '',
      description: '',
      expectsJson: true,
      mock: ({ attempt }) => (attempt === 1 ? ok('not json at all {') : ok({ label: 'clean', score: 1 })),
    },
    {
      id: 'always-invalid',
      name: '',
      description: '',
      expectsJson: true,
      mock: () => ok({ label: 'x', score: 42 }),
    },
  ],
  tools: [
    { id: 'boom', name: 'Boom', description: '', mock: () => failWith('tool-error', 'boom', false) },
  ],
  sources: [],
  schemas: [
    {
      id: 'thing',
      name: 'Thing',
      rules: [],
      schema: z.object({ label: z.string(), score: z.number().min(0).max(1) }),
      repair: (value) => {
        if (typeof value !== 'object' || value === null) return null;
        const draft = structuredClone(value) as any;
        if (typeof draft.score === 'number' && draft.score > 1) {
          draft.score = draft.score / 100;
          return { value: draft, notes: ['scaled score down'] };
        }
        return null;
      },
    },
  ],
  conditions: [
    {
      id: 'score-high',
      name: '',
      description: '',
      test: (ctx) => {
        const score = (ctx.last as { score?: number })?.score ?? 0;
        return score >= 0.7 ? { pass: true, reason: 'high' } : { pass: false, reason: 'low' };
      },
    },
  ],
  transforms: [],
  defaults: [{ id: 'safe-thing', name: 'Safe thing', description: '', value: { label: 'default', score: 0 } }],
  palette: [],
  initialWorkflow: [],
  failureScenarios: [],
  criteria: [],
  hints: [],
  solution: [],
  solutionScenarioSets: [],
};

const kit = makeKit(lab);

const approveAll = async (): Promise<HumanDecision> => ({ action: 'approve' });

function run(workflow: WorkflowStep[], human: (p: HumanPrompt) => Promise<HumanDecision> = approveAll) {
  return runWorkflow({
    kit,
    workflow,
    sampleId: 's1',
    scenarios: [],
    mode: 'mock',
    pace: 'instant',
    human,
  });
}

describe('retry and fallback', () => {
  it('recovers a flaky step with retries and records them', async () => {
    const report = await run([
      mkInput(),
      mkAi('a', 'Flaky', 'flaky-twice', 'big', { upgrades: { retry: { attempts: 2 } } }),
      mkOutput(),
    ]);
    expect(report.status).toBe('completed');
    expect(report.retriesUsed).toBe(2);
    expect(report.finalOutputValid).toBe(true);
    expect(report.stepStatuses['a']).toBe('recovered');
    expect(report.events.some((e) => e.t === 'retry-scheduled')).toBe(true);
  });

  it('fails the run when retries are exhausted and onExhausted is fail', async () => {
    const report = await run([mkInput(), mkAi('a', 'Down', 'always-down', 'big'), mkOutput()]);
    expect(report.status).toBe('failed');
    expect(report.unhandledFailure?.failure.kind).toBe('timeout');
    expect(report.stepStatuses['a']).toBe('failed');
  });

  it('safe-stops instead of crashing when onExhausted is safe-stop', async () => {
    const report = await run([
      mkInput(),
      mkAi('a', 'Down', 'always-down', 'big', { onExhausted: 'safe-stop' }),
      mkOutput(),
    ]);
    expect(report.status).toBe('safe-stopped');
    expect(report.unhandledFailure).toBeUndefined();
    expect(report.safeStopReason).toContain('stopped safely');
  });

  it('switches to the fallback provider after exhausting the primary', async () => {
    const report = await run([
      mkInput(),
      mkAi('a', 'Down', 'always-down', 'big', {
        upgrades: { retry: { attempts: 1 }, fallback: { type: 'provider', providerId: 'small' } },
      }),
      mkOutput(),
    ]);
    expect(report.status).toBe('completed');
    expect(report.fallbacksActivated).toHaveLength(1);
    expect((report.finalOutput as { label: string }).label).toBe('from small');
    expect(report.stepStatuses['a']).toBe('recovered');
  });

  it('uses a safe default as fallback and marks the output degraded', async () => {
    const report = await run([
      mkInput(),
      mkTool('t', 'Boom', 'boom', { upgrades: { fallback: { type: 'default', defaultId: 'safe-thing' } } }),
      mkOutput(),
    ]);
    expect(report.status).toBe('completed');
    expect(report.defaultsUsed).toBe(1);
    expect((report.finalOutput as { label: string }).label).toBe('default');
  });
});

describe('validator ladder', () => {
  it('flows malformed JSON through soft, then a validator retry fixes it', async () => {
    const naive = await run([mkInput(), mkAi('a', 'Sloppy', 'sloppy-then-clean', 'big'), mkOutput()]);
    expect(naive.status).toBe('completed');
    expect(naive.finalOutputValid).toBe(false); // silent garbage without a validator

    const guarded = await run([
      mkInput(),
      mkAi('a', 'Sloppy', 'sloppy-then-clean', 'big'),
      mkValidator('v', 'Check', 'thing', { retryPrevious: 1 }),
      mkOutput(),
    ]);
    expect(guarded.status).toBe('completed');
    expect(guarded.finalOutputValid).toBe(true);
    expect(guarded.validationsFailed).toBe(1);
    expect(guarded.validationsPassed).toBe(1);
  });

  it('repairs out-of-range values deterministically', async () => {
    const report = await run([
      mkInput(),
      mkAi('a', 'Invalid', 'always-invalid', 'big'),
      mkValidator('v', 'Check', 'thing', { repair: true }),
      mkOutput(),
    ]);
    expect(report.status).toBe('completed');
    expect(report.repairsApplied).toBe(1);
    expect((report.finalOutput as { score: number }).score).toBeCloseTo(0.42);
  });

  it('escalates to a human whose edit passes validation', async () => {
    const report = await run(
      [
        mkInput(),
        mkAi('a', 'Invalid', 'always-invalid', 'big'),
        mkValidator('v', 'Check', 'thing', { escalate: true }),
        mkOutput(),
      ],
      async (prompt) => {
        expect(prompt.mode).toBe('fix');
        expect(prompt.issues?.length).toBeGreaterThan(0);
        return { action: 'edit', payload: { label: 'fixed by human', score: 0.8 } };
      },
    );
    expect(report.status).toBe('completed');
    expect(report.finalOutputValid).toBe(true);
    expect(report.humanDecisions[0]?.mode).toBe('fix');
  });

  it('safe-stops with a clear reason when nothing on the ladder works', async () => {
    const report = await run([
      mkInput(),
      mkAi('a', 'Invalid', 'always-invalid', 'big'),
      mkValidator('v', 'Check', 'thing', { finalAction: 'safe-stop' }),
      mkOutput(),
    ]);
    expect(report.status).toBe('safe-stopped');
    expect(report.safeStopReason).toContain('Validation');
    expect(report.finalOutput).toBeUndefined();
  });
});

describe('conditions and safe stops', () => {
  it('takes the then-branch on pass and skips the other branch', async () => {
    const report = await run([
      mkInput(),
      mkAi('a', 'Flaky', 'flaky-twice', 'big', { upgrades: { retry: { attempts: 2 } } }),
      mkCondition('c', 'High?', 'score-high', { else: [mkSafeStop('s', 'Stop', 'not confident')] }),
      mkOutput(),
    ]);
    expect(report.status).toBe('completed');
    expect(report.stepStatuses['s']).toBe('skipped');
    const branch = report.events.find((e) => e.t === 'branch-taken');
    expect(branch && branch.t === 'branch-taken' && branch.branch).toBe('then');
  });

  it('safe-stops from inside an else-branch', async () => {
    const report = await run([
      mkInput(),
      mkAi('a', 'Small answer', 'always-down', 'big', {
        upgrades: { fallback: { type: 'provider', providerId: 'small' } },
      }),
      mkCondition('c', 'High?', 'score-high', { else: [mkSafeStop('s', 'Stop', 'not confident enough')] }),
      mkOutput(),
    ]);
    expect(report.status).toBe('safe-stopped');
    expect(report.safeStopReason).toBe('not confident enough');
    expect(report.stepStatuses['step-output']).toBe('pending');
  });
});

describe('human review', () => {
  it('records a rejection and stops safely before later steps run', async () => {
    const report = await run(
      [
        mkInput(),
        mkAi('a', 'Flaky', 'flaky-twice', 'big', { upgrades: { retry: { attempts: 2 } } }),
        {
          id: 'h',
          kind: 'human',
          label: 'Review',
          title: 'Review',
          instructions: '',
          allowEdit: true,
        },
        mkTool('t', 'Boom', 'boom'),
        mkOutput(),
      ],
      async () => ({ action: 'reject', note: 'not good enough' }),
    );
    expect(report.status).toBe('safe-stopped');
    expect(report.humanDecisions[0]?.decision.action).toBe('reject');
    expect(report.safeStopReason).toContain('not good enough');
    expect(report.stepStatuses['t']).toBe('pending'); // never ran
  });

  it('lets an edited payload replace the draft', async () => {
    const report = await run(
      [
        mkInput(),
        mkAi('a', 'Flaky', 'flaky-twice', 'big', { upgrades: { retry: { attempts: 2 } } }),
        { id: 'h', kind: 'human', label: 'Review', title: 'Review', instructions: '', allowEdit: true, schemaId: 'thing' },
        mkOutput(),
      ],
      async () => ({ action: 'edit', payload: { label: 'edited', score: 0.6 } }),
    );
    expect(report.status).toBe('completed');
    expect((report.finalOutput as { label: string }).label).toBe('edited');
  });
});
