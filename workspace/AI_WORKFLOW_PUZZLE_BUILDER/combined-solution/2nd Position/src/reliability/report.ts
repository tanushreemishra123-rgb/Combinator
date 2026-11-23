import type { RunReport, WorkflowStep } from '../engine/types';
import { flattenSteps } from '../engine/util';
import { isResilient } from '../engine/types';
import type { Countermeasure, Puzzle } from '../puzzles/types';

export interface ReliabilityAssessment {
  score: number;
  verdict: string;
  emoji: string;
  breakdown: { label: string; earned: number; max: number; note: string }[];
  /** Recovery behaviour that actually happened during this run. */
  strengths: string[];
  /** Unresolved weaknesses in the current workflow design. */
  weaknesses: string[];
}

const COUNTERMEASURE_LABEL: Record<Countermeasure, string> = {
  retry: 'a Retry upgrade',
  fallback: 'a Fallback',
  validator: 'a Validator',
  human: 'a Human Review gate',
  condition: 'a Condition branch',
  safestop: 'a Safe Stop',
};

function workflowFeatures(workflow: WorkflowStep[]): Set<Countermeasure> {
  const flat = flattenSteps(workflow);
  const features = new Set<Countermeasure>();
  for (const step of flat) {
    if (isResilient(step)) {
      if (step.upgrades.retry) features.add('retry');
      if (step.upgrades.fallback) features.add('fallback');
      if (step.onExhausted === 'safe-stop') features.add('safestop');
    }
    if (step.kind === 'validator') {
      features.add('validator');
      if (step.escalate) features.add('human');
      if (step.finalAction === 'safe-stop') features.add('safestop');
      if (step.retryPrevious > 0) features.add('retry');
      if (step.useDefault) features.add('fallback');
    }
    if (step.kind === 'human') features.add('human');
    if (step.kind === 'condition') features.add('condition');
    if (step.kind === 'safestop') features.add('safestop');
  }
  return features;
}

export function findWeaknesses(puzzle: Puzzle, workflow: WorkflowStep[], enabledScenarios: string[]): string[] {
  const weaknesses: string[] = [];
  const features = workflowFeatures(workflow);
  const flat = flattenSteps(workflow);

  for (const id of enabledScenarios) {
    const scenario = puzzle.failureScenarios.find((s) => s.id === id);
    if (!scenario) continue;
    // An empty counteredBy list means the scenario cannot be prevented in-flow
    // (e.g. an interruption — only a checkpoint resume helps), so no lint.
    if (scenario.counteredBy.length === 0) continue;
    const covered = scenario.counteredBy.some((c) => features.has(c));
    if (!covered) {
      const options = scenario.counteredBy.map((c) => COUNTERMEASURE_LABEL[c]).join(' or ');
      weaknesses.push(
        `"${scenario.name}" attacks ${scenario.attacks}, but the workflow has no ${options} to absorb it.`,
      );
    }
  }

  // Unvalidated structured AI output.
  const validatorIndexes = flat.map((s, i) => (s.kind === 'validator' || s.kind === 'human' ? i : -1)).filter((i) => i >= 0);
  flat.forEach((step, i) => {
    if (step.kind !== 'ai') return;
    const task = puzzle.tasks.find((t) => t.id === step.taskId);
    if (!task?.expectsJson) return;
    const guarded = validatorIndexes.some((v) => v > i);
    if (!guarded) {
      weaknesses.push(
        `"${step.label}" produces structured output that flows onward unchecked — malformed or invalid data would reach the final output silently.`,
      );
    }
  });

  // Validators with no recovery strategy at all.
  for (const step of flat) {
    if (step.kind === 'validator' && step.retryPrevious === 0 && !step.repair && !step.useDefault && !step.escalate && step.finalAction === 'fail') {
      weaknesses.push(`"${step.label}" can detect bad data but has no recovery strategy — its only move is to crash the run.`);
    }
  }

  return weaknesses;
}

export function assessRun(puzzle: Puzzle, workflow: WorkflowStep[], report: RunReport): ReliabilityAssessment {
  const breakdown: ReliabilityAssessment['breakdown'] = [];
  const strengths: string[] = [];
  const weaknesses = findWeaknesses(puzzle, workflow, report.scenarios);

  // 1) Outcome (35)
  let outcomeEarned = 0;
  let outcomeNote = '';
  switch (report.status) {
    case 'completed':
      outcomeEarned = 35;
      outcomeNote = 'The workflow ran end-to-end and produced a final result.';
      break;
    case 'safe-stopped':
      outcomeEarned = 28;
      outcomeNote = `Stopped safely with a clear explanation — a controlled ending, not a crash. (${report.safeStopReason ?? ''})`;
      break;
    case 'interrupted':
      outcomeEarned = 8;
      outcomeNote = 'The run was interrupted mid-flight. A checkpoint was saved — resume from the last successful step.';
      break;
    case 'aborted':
      outcomeEarned = 0;
      outcomeNote = 'The run was aborted by the operator.';
      break;
    case 'failed':
      outcomeEarned = 0;
      outcomeNote = report.unhandledFailure
        ? `Crashed at "${report.unhandledFailure.stepLabel}": ${report.unhandledFailure.failure.message}`
        : 'The workflow crashed with an unhandled error.';
      break;
  }
  breakdown.push({ label: 'Run outcome', earned: outcomeEarned, max: 35, note: outcomeNote });

  // 2) Output integrity (20)
  let integrityEarned = 0;
  let integrityNote = '';
  if (report.status === 'completed') {
    if (report.finalOutputValid) {
      integrityEarned = 20;
      integrityNote = 'The final output passed the expected schema.';
    } else {
      integrityEarned = 0;
      integrityNote = `The run "succeeded" but shipped invalid data — the most dangerous failure mode. ${report.finalOutputIssues?.slice(0, 3).join('; ') ?? ''}`;
    }
  } else if (report.status === 'safe-stopped') {
    integrityEarned = 14;
    integrityNote = 'No output was shipped, so no invalid data escaped.';
  } else {
    integrityNote = 'The run never reached the output step.';
  }
  breakdown.push({ label: 'Output integrity', earned: integrityEarned, max: 20, note: integrityNote });

  // 3) Chaos handling (25)
  let chaosEarned = 0;
  let chaosNote = '';
  const chaosOn = report.scenarios.length > 0;
  const endedWell =
    (report.status === 'completed' && report.finalOutputValid === true) || report.status === 'safe-stopped';
  if (!chaosOn) {
    chaosEarned = 12;
    chaosNote = 'No failure scenario was injected. Flip one on to prove this workflow can take a punch.';
  } else if (endedWell && !report.unhandledFailure) {
    chaosEarned = 25;
    chaosNote = `Injected failure${report.scenarios.length > 1 ? 's were' : ' was'} absorbed: ${report.scenarios.join(', ')}.`;
  } else {
    chaosEarned = 0;
    chaosNote = 'An injected failure went unhandled and took the run down.';
  }
  breakdown.push({ label: 'Chaos handling', earned: chaosEarned, max: 25, note: chaosNote });

  // 4) Design hygiene (20)
  const hygieneEarned = Math.max(0, 20 - weaknesses.length * 7);
  breakdown.push({
    label: 'Design hygiene',
    earned: hygieneEarned,
    max: 20,
    note:
      weaknesses.length === 0
        ? 'No unguarded failure paths detected in the current design.'
        : `${weaknesses.length} unresolved weakness${weaknesses.length > 1 ? 'es' : ''} in the design (see below).`,
  });

  // Observed recovery behaviour → strengths.
  if (report.retriesUsed > 0 && report.status !== 'failed') {
    strengths.push(`Survived ${report.retriesUsed} retr${report.retriesUsed === 1 ? 'y' : 'ies'} without giving up.`);
  }
  for (const fb of report.fallbacksActivated) strengths.push(`Fallback activated: ${fb}.`);
  if (report.repairsApplied > 0) strengths.push(`Repaired invalid output automatically (${report.repairsApplied}×), fixing what a machine can fix.`);
  if (report.defaultsUsed > 0) strengths.push(`Used a safe default instead of shipping nothing (${report.defaultsUsed}×).`);
  for (const hd of report.humanDecisions) {
    strengths.push(
      `Human decision recorded at "${hd.stepLabel}": ${hd.decision.action}${hd.decision.note ? ` — "${hd.decision.note}"` : ''}.`,
    );
  }
  if (report.status === 'safe-stopped') strengths.push('Chose a safe stop over shipping a bad result.');
  if (report.stepsRestored > 0) {
    strengths.push(`Resumed from a checkpoint — ${report.stepsRestored} step${report.stepsRestored > 1 ? 's' : ''} restored instead of re-run.`);
  }
  if (report.validationsPassed > 0) strengths.push(`Validation passed ${report.validationsPassed}× before data moved on.`);

  const score = breakdown.reduce((sum, b) => sum + b.earned, 0);
  let verdict: string;
  let emoji: string;
  if (score >= 90) [verdict, emoji] = ['Rock solid', '🏆'];
  else if (score >= 75) [verdict, emoji] = ['Resilient', '🛡️'];
  else if (score >= 55) [verdict, emoji] = ['Getting there', '🔧'];
  else if (score >= 30) [verdict, emoji] = ['Fragile', '🫙'];
  else [verdict, emoji] = ['Brittle', '💥'];

  return { score, verdict, emoji, breakdown, strengths, weaknesses };
}
