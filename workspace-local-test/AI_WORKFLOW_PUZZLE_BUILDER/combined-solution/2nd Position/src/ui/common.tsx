import type { ReactNode } from 'react';
import { useState } from 'react';
import type { StepKind, StepStatus } from '../engine/types';

export const KIND_META: Record<StepKind, { icon: string; name: string; tone: string; blurb: string }> = {
  input: { icon: '📥', name: 'Input', tone: 'core', blurb: 'The committed sample input this puzzle starts from.' },
  ai: { icon: '🤖', name: 'AI Model', tone: 'ai', blurb: 'Calls a model (mock by default) with a task prompt.' },
  tool: { icon: '🔧', name: 'Tool / API', tone: 'core', blurb: 'A simulated external tool or API call.' },
  retrieval: { icon: '📚', name: 'Retrieval', tone: 'core', blurb: 'Searches a committed document collection.' },
  condition: { icon: '🔀', name: 'Condition', tone: 'core', blurb: 'Branches the flow based on the data so far.' },
  transform: { icon: '🧮', name: 'Transform', tone: 'core', blurb: 'A deterministic data reshaping step.' },
  validator: { icon: '🛡️', name: 'Validator', tone: 'guard', blurb: 'Checks the previous output against a schema, with an escalation ladder.' },
  human: { icon: '🙋', name: 'Human Review', tone: 'human', blurb: 'Pauses the run for a person to approve, edit, or reject.' },
  safestop: { icon: '🛑', name: 'Safe Stop', tone: 'guard', blurb: 'Ends the run deliberately with a clear message.' },
  output: { icon: '📤', name: 'Output', tone: 'core', blurb: 'The final result of the workflow.' },
};

export const STATUS_META: Record<StepStatus, { icon: string; label: string }> = {
  pending: { icon: '⚪', label: 'Pending' },
  running: { icon: '🔵', label: 'Running' },
  retrying: { icon: '🔄', label: 'Retrying' },
  completed: { icon: '✅', label: 'Completed' },
  recovered: { icon: '💪', label: 'Recovered' },
  failed: { icon: '❌', label: 'Failed' },
  paused: { icon: '⏸️', label: 'Paused for human' },
  'safe-stopped': { icon: '🛑', label: 'Safely stopped' },
  skipped: { icon: '⏭️', label: 'Skipped' },
  restored: { icon: '💾', label: 'Restored from checkpoint' },
};

export function StatusChip({ status }: { status: StepStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`status-chip status-${status}`} title={meta.label}>
      {meta.icon} {meta.label}
    </span>
  );
}

export function Json({ value, maxHeight }: { value: unknown; maxHeight?: number }) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return (
    <pre className="json-view" style={maxHeight ? { maxHeight } : undefined}>
      {text ?? 'null'}
    </pre>
  );
}

export function Collapsible({ summary, children, defaultOpen = false }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`collapsible ${open ? 'open' : ''}`}>
      <button type="button" className="collapsible-summary" onClick={() => setOpen(!open)}>
        <span className="chev">{open ? '▾' : '▸'}</span> {summary}
      </button>
      {open && <div className="collapsible-body">{children}</div>}
    </div>
  );
}

export function DifficultyPill({ level }: { level: 'beginner' | 'intermediate' | 'advanced' }) {
  const label = { beginner: '🌱 Beginner', intermediate: '🌿 Intermediate', advanced: '🌳 Advanced' }[level];
  return <span className={`pill pill-${level}`}>{label}</span>;
}
