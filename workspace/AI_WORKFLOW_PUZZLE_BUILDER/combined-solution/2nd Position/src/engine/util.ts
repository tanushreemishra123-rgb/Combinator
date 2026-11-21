import type { WorkflowStep } from './types';

export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Stable structural hash of a workflow, used to invalidate checkpoints when
 * the player edits the workflow between an interruption and a resume.
 */
export function hashWorkflow(steps: WorkflowStep[]): string {
  const text = JSON.stringify(steps);
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

/** Flatten a workflow including condition branches (depth-first). */
export function flattenSteps(steps: WorkflowStep[]): WorkflowStep[] {
  const out: WorkflowStep[] = [];
  for (const step of steps) {
    out.push(step);
    if (step.kind === 'condition') {
      out.push(...flattenSteps(step.branches.then));
      out.push(...flattenSteps(step.branches.else));
    }
  }
  return out;
}

export function findStep(steps: WorkflowStep[], id: string): WorkflowStep | undefined {
  return flattenSteps(steps).find((s) => s.id === id);
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}
