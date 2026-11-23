import type { FallbackUpgrade, WorkflowStep } from '../engine/types';
import { isResilient } from '../engine/types';
import { clone, flattenSteps } from '../engine/util';

/** Where a step can be inserted: the main sequence, or a condition branch. */
export type SlotPath = { kind: 'main' } | { kind: 'branch'; conditionId: string; branch: 'then' | 'else' };

export interface InsertTarget {
  path: SlotPath;
  index: number;
}

function branchOf(workflow: WorkflowStep[], path: SlotPath): WorkflowStep[] | null {
  if (path.kind === 'main') return workflow;
  const condition = flattenSteps(workflow).find((s) => s.id === path.conditionId);
  if (!condition || condition.kind !== 'condition') return null;
  return condition.branches[path.branch];
}

/** Clamp a main-sequence index between the locked Input and Output steps. */
function clampMainIndex(seq: WorkflowStep[], index: number): number {
  const min = seq.length > 0 && seq[0].kind === 'input' ? 1 : 0;
  const max = seq.length > 0 && seq[seq.length - 1].kind === 'output' ? seq.length - 1 : seq.length;
  return Math.max(min, Math.min(max, index));
}

export function insertStep(workflow: WorkflowStep[], target: InsertTarget, step: WorkflowStep): { next: WorkflowStep[]; error?: string } {
  if (target.path.kind === 'branch' && step.kind === 'condition') {
    return { next: workflow, error: 'Conditions cannot be nested inside a branch in this lab.' };
  }
  const next = clone(workflow);
  const seq = branchOf(next, target.path);
  if (!seq) return { next: workflow, error: 'That drop target no longer exists.' };
  const index = target.path.kind === 'main' ? clampMainIndex(seq, target.index) : Math.max(0, Math.min(seq.length, target.index));
  seq.splice(index, 0, step);
  return { next };
}

export function removeStep(workflow: WorkflowStep[], stepId: string): { next: WorkflowStep[]; error?: string } {
  const step = flattenSteps(workflow).find((s) => s.id === stepId);
  if (!step) return { next: workflow };
  if (step.locked) return { next: workflow, error: 'Input and Output are part of the puzzle — they cannot be removed.' };
  const next = clone(workflow);
  const scrub = (seq: WorkflowStep[]): WorkflowStep[] =>
    seq
      .filter((s) => s.id !== stepId)
      .map((s) => (s.kind === 'condition' ? { ...s, branches: { then: scrub(s.branches.then), else: scrub(s.branches.else) } } : s));
  return { next: scrub(next) };
}

export function moveStep(workflow: WorkflowStep[], stepId: string, target: InsertTarget): { next: WorkflowStep[]; error?: string } {
  const step = flattenSteps(workflow).find((s) => s.id === stepId);
  if (!step) return { next: workflow };
  if (step.locked) return { next: workflow, error: 'Input and Output stay where they are.' };
  if (step.kind === 'condition' && target.path.kind === 'branch') {
    return { next: workflow, error: 'Conditions cannot be nested inside a branch in this lab.' };
  }
  // Moving a step into its own branch would orphan it.
  if (step.kind === 'condition' && flattenSteps([step]).some((s) => target.path.kind === 'branch' && s.id === target.path.conditionId)) {
    return { next: workflow, error: 'A condition cannot be moved inside itself.' };
  }
  const removed = removeStep(workflow, stepId);
  if (removed.error) return { next: workflow, error: removed.error };
  // Re-find indices on the pruned tree, then insert the SAME object (with branches intact).
  const inserted = insertStep(removed.next, target, clone(step));
  if (inserted.error) return { next: workflow, error: inserted.error };
  return inserted;
}

/** Move a step one position up or down within its own sequence. */
export function nudgeStep(workflow: WorkflowStep[], stepId: string, direction: -1 | 1): { next: WorkflowStep[]; error?: string } {
  const next = clone(workflow);
  const nudgeIn = (seq: WorkflowStep[]): boolean => {
    const i = seq.findIndex((s) => s.id === stepId);
    if (i >= 0) {
      const j = i + direction;
      if (j < 0 || j >= seq.length) return true;
      if (seq[i].locked || seq[j].locked) return true;
      [seq[i], seq[j]] = [seq[j], seq[i]];
      return true;
    }
    for (const s of seq) {
      if (s.kind === 'condition' && (nudgeIn(s.branches.then) || nudgeIn(s.branches.else))) return true;
    }
    return false;
  };
  nudgeIn(next);
  return { next };
}

export function updateStep(workflow: WorkflowStep[], stepId: string, patch: Partial<WorkflowStep>): WorkflowStep[] {
  const next = clone(workflow);
  const apply = (seq: WorkflowStep[]) => {
    for (let i = 0; i < seq.length; i++) {
      const s = seq[i];
      if (s.id === stepId) {
        seq[i] = { ...s, ...patch } as WorkflowStep;
      } else if (s.kind === 'condition') {
        apply(s.branches.then);
        apply(s.branches.else);
      }
    }
  };
  apply(next);
  return next;
}

export function applyRetryUpgrade(workflow: WorkflowStep[], stepId: string, attempts: number): { next: WorkflowStep[]; error?: string } {
  const step = flattenSteps(workflow).find((s) => s.id === stepId);
  if (!step || !isResilient(step)) {
    return { next: workflow, error: 'Retry upgrades attach to AI and Tool steps only.' };
  }
  return { next: updateStep(workflow, stepId, { upgrades: { ...step.upgrades, retry: { attempts } } }) };
}

export function applyFallbackUpgrade(workflow: WorkflowStep[], stepId: string, fallback: FallbackUpgrade): { next: WorkflowStep[]; error?: string } {
  const step = flattenSteps(workflow).find((s) => s.id === stepId);
  if (!step || !isResilient(step)) {
    return { next: workflow, error: 'Fallbacks attach to AI and Tool steps only.' };
  }
  if (step.kind === 'ai' && fallback.type === 'tool') return { next: workflow, error: 'That fallback is a tool — it attaches to Tool steps.' };
  if (step.kind === 'tool' && fallback.type === 'provider') return { next: workflow, error: 'That fallback is a model — it attaches to AI steps.' };
  return { next: updateStep(workflow, stepId, { upgrades: { ...step.upgrades, fallback } }) };
}

export function countByPalette(workflow: WorkflowStep[], predicate: (s: WorkflowStep) => boolean): number {
  return flattenSteps(workflow).filter(predicate).length;
}
