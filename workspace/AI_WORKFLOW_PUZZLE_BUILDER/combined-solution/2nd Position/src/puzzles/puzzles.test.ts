import { describe, expect, it } from 'vitest';
import { runWorkflow } from '../engine/engine';
import type { Checkpoint, HumanDecision, HumanPrompt, RunReport, WorkflowStep } from '../engine/types';
import { clone } from '../engine/util';
import { getKit, PUZZLES } from './index';

type HumanScript = (prompt: HumanPrompt) => Promise<HumanDecision>;

const approve: HumanScript = async () => ({ action: 'approve' });

async function play(
  puzzleId: string,
  workflow: WorkflowStep[],
  scenarios: string[],
  human: HumanScript = approve,
  checkpoint?: Checkpoint,
): Promise<RunReport> {
  return runWorkflow({
    kit: getKit(puzzleId),
    workflow: clone(workflow),
    sampleId: getKit(puzzleId).puzzle.samples[0].id,
    scenarios,
    mode: 'mock',
    pace: 'instant',
    human,
    checkpoint,
  });
}

describe('every puzzle definition is coherent', () => {
  it('has 8 puzzles spanning all difficulty levels', () => {
    expect(PUZZLES).toHaveLength(8);
    const levels = new Set(PUZZLES.map((p) => p.difficulty));
    expect(levels).toEqual(new Set(['beginner', 'intermediate', 'advanced']));
  });

  it('every puzzle commits samples, scenarios, criteria, hints, and a solution', () => {
    for (const p of PUZZLES) {
      expect(p.samples.length, p.id).toBeGreaterThan(0);
      expect(p.failureScenarios.length, p.id).toBeGreaterThan(0);
      expect(p.criteria.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.hints.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.solution.length, p.id).toBeGreaterThan(0);
      expect(p.initialWorkflow[0].kind, p.id).toBe('input');
      expect(p.initialWorkflow[p.initialWorkflow.length - 1].kind, p.id).toBe('output');
    }
  });
});

describe('solution workflows survive their scenario sets', () => {
  for (const puzzle of PUZZLES) {
    for (const scenarios of puzzle.solutionScenarioSets) {
      it(`${puzzle.id} with [${scenarios.join(', ') || 'no scenarios'}]`, async () => {
        const human: HumanScript =
          puzzle.id === 'data-extractor'
            ? async () => ({
                action: 'edit',
                payload: {
                  vendor: 'Brightleaf Nurseries',
                  contactEmail: 's.ito@brightleaf.example',
                  amountUSD: 1200,
                  dueDate: '2026-10-31',
                },
              })
            : puzzle.id === 'approval-gate'
              ? async (p) =>
                  p.mode === 'approval'
                    ? { action: 'edit', payload: { subject: 'About Monday’s delay', body: 'A calm, factual, human-approved apology that makes no reckless guarantees to the customer.' }, note: 'defused' }
                    : { action: 'approve' }
              : approve;
        const report = await play(puzzle.id, puzzle.solution, scenarios, human);
        expect(report.unhandledFailure, `unhandled failure: ${JSON.stringify(report.unhandledFailure)}`).toBeUndefined();
        expect(['completed', 'safe-stopped']).toContain(report.status);
        if (report.status === 'completed') {
          expect(report.finalOutputValid, `invalid output: ${report.finalOutputIssues?.join('; ')}`).toBe(true);
        }
      });
    }
  }
});

describe('naive workflows demonstrate the failure they teach', () => {
  it('meeting-summarizer: sloppy JSON ships silent garbage without a validator', async () => {
    const p = PUZZLES.find((x) => x.id === 'meeting-summarizer')!;
    const report = await play(p.id, p.initialWorkflow, ['sloppy-json']);
    expect(report.status).toBe('completed');
    expect(report.finalOutputValid).toBe(false);
  });

  it('knowledge-assistant: empty library produces an uncited hallucination', async () => {
    const p = PUZZLES.find((x) => x.id === 'knowledge-assistant')!;
    const report = await play(p.id, p.initialWorkflow, ['empty-library']);
    expect(report.status).toBe('completed');
    expect(report.finalOutputValid).toBe(false);
    expect(report.failureKindsSeen).toContain('empty-retrieval');
  });

  it('ticket-router: category drift crashes the router tool', async () => {
    const p = PUZZLES.find((x) => x.id === 'ticket-router')!;
    const report = await play(p.id, p.initialWorkflow, ['category-drift']);
    expect(report.status).toBe('failed');
    expect(report.unhandledFailure?.failure.message).toContain('billing-ish');
  });

  it('research-timeout: one timeout kills the naive pipeline', async () => {
    const p = PUZZLES.find((x) => x.id === 'research-timeout')!;
    const report = await play(p.id, p.initialWorkflow, ['flaky-network']);
    expect(report.status).toBe('failed');
    expect(report.unhandledFailure?.failure.kind).toBe('timeout');
  });

  it('fallback-drill: the outage defeats retries alone', async () => {
    const p = PUZZLES.find((x) => x.id === 'fallback-drill')!;
    const withRetryOnly = clone(p.initialWorkflow);
    const ai = withRetryOnly.find((s) => s.kind === 'ai');
    if (ai && ai.kind === 'ai') ai.upgrades = { retry: { attempts: 2 } };
    const report = await play(p.id, withRetryOnly, ['atlas-outage']);
    expect(report.status).toBe('failed');
    expect(report.retriesUsed).toBe(2);
  });
});

describe('partial repairs are handed on, not discarded', () => {
  it('data-extractor: the human is handed the repaired amount, not the raw string', async () => {
    const p = PUZZLES.find((x) => x.id === 'data-extractor')!;
    let seen: unknown = null;
    const report = await play(p.id, p.solution, ['word-numbers', 'amnesia'], async (prompt) => {
      seen = prompt.payload;
      return {
        action: 'edit',
        payload: { ...(prompt.payload as object), contactEmail: 's.ito@brightleaf.example' },
      };
    });

    // Repair cannot invent the missing email, but it can fix the amount — and the
    // human should receive that fix rather than redoing it by hand.
    const handed = seen as { amountUSD?: unknown; contactEmail?: unknown };
    expect(handed.amountUSD).toBe(1200);
    expect(handed.contactEmail).toBeUndefined();

    expect(report.repairsApplied).toBe(1);
    expect(report.status).toBe('completed');
    expect(report.finalOutputValid).toBe(true);

    // The trace must show the repair as partial, so the record stays honest.
    const repair = report.events.find((e) => e.t === 'repair-applied');
    expect(repair && repair.t === 'repair-applied' && repair.resolved).toBe(false);

    // The escalation prompt should list only what repair could not solve.
    const paused = report.events.find((e) => e.t === 'paused-for-human');
    const issues = paused && paused.t === 'paused-for-human' ? (paused.prompt.issues ?? []) : [];
    expect(issues.join(' ')).toContain('contactEmail');
    expect(issues.join(' ')).not.toContain('amountUSD');
  });

  it('marks a repair that fully fixes the output as resolved', async () => {
    const p = PUZZLES.find((x) => x.id === 'data-extractor')!;
    const report = await play(p.id, p.solution, ['word-numbers']);
    const repair = report.events.find((e) => e.t === 'repair-applied');
    expect(repair && repair.t === 'repair-applied' && repair.resolved).toBe(true);
    expect(report.finalOutputValid).toBe(true);
  });
});

describe('every completion criterion is achievable', () => {
  for (const puzzle of PUZZLES) {
    it(`${puzzle.id}: a playbook of runs satisfies all ${puzzle.criteria.length} criteria`, async () => {
      const met = new Set<string>();
      const record = (report: RunReport, workflow: WorkflowStep[]) => {
        for (const c of puzzle.criteria) {
          if (c.test(report, workflow)) met.add(c.id);
        }
      };

      if (puzzle.id === 'resume-mission') {
        // clean run, interruption, then resume from the checkpoint
        record(await play(puzzle.id, puzzle.solution, []), puzzle.solution);
        const interrupted = await play(puzzle.id, puzzle.solution, ['solar-flare']);
        expect(interrupted.status).toBe('interrupted');
        record(interrupted, puzzle.solution);
        expect(interrupted.checkpoint).toBeDefined();
        const resumed = await play(puzzle.id, puzzle.solution, ['solar-flare'], approve, interrupted.checkpoint);
        expect(resumed.status).toBe('completed');
        expect(resumed.stepsRestored).toBeGreaterThanOrEqual(3);
        record(resumed, puzzle.solution);
      } else if (puzzle.id === 'approval-gate') {
        const edit: HumanScript = async () => ({
          action: 'edit',
          payload: { subject: 'About Monday’s delay', body: 'A calm, factual, human-approved apology that makes no reckless guarantees to the customer.' },
          note: 'toned down the promises',
        });
        const reject: HumanScript = async () => ({ action: 'reject', note: 'we never promise refunds like this' });
        record(await play(puzzle.id, puzzle.solution, [], approve), puzzle.solution);
        record(await play(puzzle.id, puzzle.solution, ['overpromiser'], edit), puzzle.solution);
        record(await play(puzzle.id, puzzle.solution, ['overpromiser'], reject), puzzle.solution);
        record(await play(puzzle.id, puzzle.solution, ['send-hiccup'], approve), puzzle.solution);
      } else if (puzzle.id === 'data-extractor') {
        const fix: HumanScript = async () => ({
          action: 'edit',
          payload: { vendor: 'Brightleaf Nurseries', contactEmail: 's.ito@brightleaf.example', amountUSD: 1200, dueDate: '2026-10-31' },
          note: 'restored the contact email from the source text',
        });
        for (const scenarios of [[], ['fence-glitch'], ['word-numbers'], ['amnesia']]) {
          record(await play(puzzle.id, puzzle.solution, scenarios, fix), puzzle.solution);
        }
      } else {
        for (const scenarios of puzzle.solutionScenarioSets) {
          record(await play(puzzle.id, puzzle.solution, scenarios), puzzle.solution);
        }
      }

      const missing = puzzle.criteria.filter((c) => !met.has(c.id)).map((c) => c.id);
      expect(missing, `criteria not met: ${missing.join(', ')}`).toHaveLength(0);
    });
  }
});

describe('mock mode is deterministic', () => {
  // The README, the submission notes and the UI all promise that "every scenario
  // reproduces the same way on every run". Nothing asserted it, so the claim was
  // only as good as the reviewer's willingness to believe it. This proves it for
  // every puzzle and every scenario combination the puzzles ship.
  //
  // runId and every wall-clock field are *expected* to vary between runs — they
  // measure the machine, not the engine — so they are normalised away: startedAt,
  // finishedAt, checkpoint.savedAt, each event's and human decision's `at`, and
  // per-step `durationMs`
  // (which is a Date.now() delta and genuinely differs run to run).
  // Everything else — status, counters, recovery, final output and the full trace
  // in order — must match exactly.
  const canonical = (r: RunReport) =>
    JSON.stringify(
      { ...r, runId: null, startedAt: null, finishedAt: null,
        checkpoint: r.checkpoint ? { ...r.checkpoint, savedAt: null } : undefined,
        humanDecisions: r.humanDecisions.map((d) => ({ ...d, at: null })),
        events: r.events.map((e) => ({ ...e, at: null, ...('durationMs' in e ? { durationMs: null } : {}) })) },
      (_k, v) => (v === undefined ? null : v),
    );

  for (const puzzle of PUZZLES) {
    // Each scenario alone, plus the empty set and the full set.
    const combos: string[][] = [[], ...puzzle.failureScenarios.map((s) => [s.id]),
      puzzle.failureScenarios.map((s) => s.id)];

    for (const scenarios of combos) {
      const label = scenarios.length === 0 ? 'no scenarios' : scenarios.join(' + ');
      it(`${puzzle.id} replays identically with ${label}`, async () => {
        const first = await play(puzzle.id, puzzle.solution, scenarios);
        const second = await play(puzzle.id, puzzle.solution, scenarios);
        expect(canonical(second)).toBe(canonical(first));
      });
    }
  }

  it('a different scenario set actually produces a different run', async () => {
    // Guards the test above from passing vacuously if chaos were ever ignored.
    const p = PUZZLES.find((x) => x.failureScenarios.length > 0)!;
    const clean = await play(p.id, p.initialWorkflow, []);
    const chaotic = await play(p.id, p.initialWorkflow, [p.failureScenarios[0].id]);
    expect(canonical(chaotic)).not.toBe(canonical(clean));
  });
});
