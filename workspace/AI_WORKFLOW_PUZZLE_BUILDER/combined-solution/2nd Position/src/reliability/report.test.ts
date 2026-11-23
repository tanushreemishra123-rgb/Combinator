import { describe, expect, it } from 'vitest';
import { runWorkflow } from '../engine/engine';
import type { HumanDecision, RunReport, WorkflowStep } from '../engine/types';
import { clone } from '../engine/util';
import { getKit, getPuzzle } from '../puzzles';
import { assessRun, findWeaknesses } from './report';

async function play(puzzleId: string, workflow: WorkflowStep[], scenarios: string[], human?: () => Promise<HumanDecision>) {
  const kit = getKit(puzzleId);
  return runWorkflow({
    kit,
    workflow: clone(workflow),
    sampleId: kit.puzzle.samples[0].id,
    scenarios,
    mode: 'mock',
    pace: 'instant',
    human: human ?? (async () => ({ action: 'approve' })),
  });
}

const score = (puzzleId: string, workflow: WorkflowStep[], report: RunReport) =>
  assessRun(getPuzzle(puzzleId), workflow, report);

describe('weakness lint', () => {
  it('flags an armed scenario that nothing in the workflow can absorb', () => {
    const puzzle = getPuzzle('research-timeout');
    const weaknesses = findWeaknesses(puzzle, puzzle.initialWorkflow, ['journal-outage']);
    expect(weaknesses.some((w) => w.includes('Journal outage'))).toBe(true);
  });

  it('clears once the countermeasure is present', () => {
    const puzzle = getPuzzle('research-timeout');
    expect(findWeaknesses(puzzle, puzzle.solution, ['journal-outage'])).toHaveLength(0);
  });

  it('flags structured AI output with no validator or human guard downstream', () => {
    const puzzle = getPuzzle('meeting-summarizer');
    const weaknesses = findWeaknesses(puzzle, puzzle.initialWorkflow, []);
    expect(weaknesses.some((w) => w.includes('flows onward unchecked'))).toBe(true);
  });

  it('flags a validator that can detect but never recover', () => {
    const puzzle = getPuzzle('meeting-summarizer');
    const workflow = clone(puzzle.solution);
    const validator = workflow.find((s) => s.kind === 'validator');
    if (validator?.kind === 'validator') {
      validator.retryPrevious = 0;
      validator.repair = false;
      validator.useDefault = false;
      validator.escalate = false;
      validator.finalAction = 'fail';
    }
    expect(findWeaknesses(puzzle, workflow, []).some((w) => w.includes('no recovery strategy'))).toBe(true);
  });

  it('does not lint a scenario that cannot be prevented in-flow', () => {
    const puzzle = getPuzzle('resume-mission');
    // "Solar flare" is only recoverable by resuming, so it must not be scored
    // as an unguarded design hole.
    expect(findWeaknesses(puzzle, puzzle.solution, ['solar-flare'])).toHaveLength(0);
  });
});

describe('scoring', () => {
  it('gives a clean chaos-free run a good score but withholds full chaos credit', async () => {
    const puzzle = getPuzzle('meeting-summarizer');
    const report = await play(puzzle.id, puzzle.solution, []);
    const a = score(puzzle.id, puzzle.solution, report);
    expect(report.status).toBe('completed');
    expect(a.breakdown.find((b) => b.label === 'Chaos handling')?.earned).toBe(12);
    expect(a.score).toBeLessThan(100);
  });

  it('awards full marks when an injected failure is absorbed', async () => {
    const puzzle = getPuzzle('meeting-summarizer');
    const report = await play(puzzle.id, puzzle.solution, ['sloppy-json']);
    const a = score(puzzle.id, puzzle.solution, report);
    expect(a.score).toBe(100);
    expect(a.verdict).toBe('Rock solid');
  });

  it('zeroes output integrity when a "successful" run ships invalid data', async () => {
    const puzzle = getPuzzle('meeting-summarizer');
    const report = await play(puzzle.id, puzzle.initialWorkflow, ['sloppy-json']);
    const a = score(puzzle.id, puzzle.initialWorkflow, report);
    expect(report.status).toBe('completed');
    expect(a.breakdown.find((b) => b.label === 'Output integrity')?.earned).toBe(0);
    expect(a.breakdown.find((b) => b.label === 'Chaos handling')?.earned).toBe(0);
    expect(a.verdict).toBe('Fragile');
  });

  it('treats a deliberate safe stop as controlled, not as a crash', async () => {
    const puzzle = getPuzzle('knowledge-assistant');
    const report = await play(puzzle.id, puzzle.solution, ['empty-library']);
    const a = score(puzzle.id, puzzle.solution, report);
    expect(report.status).toBe('safe-stopped');
    expect(a.breakdown.find((b) => b.label === 'Run outcome')?.earned).toBe(28);
    expect(a.strengths.some((s) => s.includes('safe stop'))).toBe(true);
    expect(a.score).toBeGreaterThan(70);
  });

  it('scores an unhandled crash at zero on outcome and chaos', async () => {
    const puzzle = getPuzzle('ticket-router');
    const report = await play(puzzle.id, puzzle.initialWorkflow, ['category-drift']);
    const a = score(puzzle.id, puzzle.initialWorkflow, report);
    expect(report.status).toBe('failed');
    expect(a.breakdown.find((b) => b.label === 'Run outcome')?.earned).toBe(0);
    expect(a.breakdown.find((b) => b.label === 'Chaos handling')?.earned).toBe(0);
  });

  it('reports observed recovery behaviour, not just the score', async () => {
    const puzzle = getPuzzle('fallback-drill');
    const report = await play(puzzle.id, puzzle.solution, ['atlas-outage']);
    const a = score(puzzle.id, puzzle.solution, report);
    expect(a.strengths.some((s) => s.toLowerCase().includes('fallback'))).toBe(true);
    expect(a.strengths.some((s) => s.toLowerCase().includes('retr'))).toBe(true);
  });

  it('records a human decision as a strength', async () => {
    const puzzle = getPuzzle('approval-gate');
    const report = await play(puzzle.id, puzzle.solution, [], async () => ({ action: 'reject', note: 'too risky' }));
    const a = score(puzzle.id, puzzle.solution, report);
    expect(a.strengths.some((s) => s.includes('reject'))).toBe(true);
    expect(a.strengths.some((s) => s.includes('too risky'))).toBe(true);
  });

  it('never returns a score outside 0–100', async () => {
    const puzzle = getPuzzle('data-extractor');
    for (const scenarios of [[], ['fence-glitch'], ['word-numbers'], ['amnesia']]) {
      const report = await play(puzzle.id, puzzle.initialWorkflow, scenarios);
      const a = score(puzzle.id, puzzle.initialWorkflow, report);
      expect(a.score).toBeGreaterThanOrEqual(0);
      expect(a.score).toBeLessThanOrEqual(100);
      expect(a.breakdown.every((b) => b.earned >= 0 && b.earned <= b.max)).toBe(true);
    }
  });
});
