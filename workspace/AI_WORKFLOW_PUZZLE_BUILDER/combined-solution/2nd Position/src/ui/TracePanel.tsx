import type { TraceEvent } from '../engine/types';
import { EMPTY_STEPS, useStore } from '../state/store';
import { Collapsible, Json } from './common';

function describe(e: TraceEvent): { icon: string; text: string; tone?: string; detail?: unknown } {
  switch (e.t) {
    case 'run-started':
      return {
        icon: '🚀',
        text: `Run started (${e.mode === 'mock' ? 'mock AI' : 'live AI'})${e.resumed ? ' — resuming from checkpoint' : ''}${e.scenarios.length ? ` · chaos: ${e.scenarios.join(', ')}` : ' · no failure scenarios'}`,
      };
    case 'step-started':
      return { icon: '▶️', text: `${e.label} started`, detail: { input: e.input } };
    case 'step-restored':
      return { icon: '💾', text: `${e.label} restored from checkpoint — not re-run`, tone: 'good', detail: { output: e.output } };
    case 'attempt-started':
      return { icon: '🎯', text: `Attempt ${e.attempt} via ${e.via}` };
    case 'attempt-failed':
      return { icon: '💥', text: `Attempt ${e.attempt} failed — ${e.failure.kind}: ${e.failure.message}`, tone: 'bad' };
    case 'retry-scheduled':
      return { icon: '🔁', text: `Retrying (attempt ${e.nextAttempt})…`, tone: 'warn' };
    case 'fallback-activated':
      return { icon: '🪂', text: `Fallback activated: ${e.description}`, tone: 'warn' };
    case 'step-completed':
      return {
        icon: e.recovered ? '💪' : '✅',
        text: `Completed${e.recovered ? ' (recovered)' : ''}${e.degraded ? ' — degraded result, clearly labeled' : ''} in ${e.durationMs} ms`,
        tone: 'good',
        detail: { output: e.output },
      };
    case 'validation-result':
      return e.ok
        ? { icon: '🛡️', text: 'Validation passed', tone: 'good' }
        : { icon: '🚨', text: `Validation failed: ${e.issues.join(' · ')}`, tone: 'bad', detail: { issues: e.issues } };
    case 'repair-applied':
      return e.resolved
        ? {
            icon: '🔧',
            text: `Repair fixed the output: ${e.notes.join(' ')}`,
            tone: 'good',
            detail: { before: e.before, after: e.after },
          }
        : {
            icon: '🔧',
            text: `Partial repair: ${e.notes.join(' ')} What it could not fix is passed to the next recovery step.`,
            tone: 'warn',
            detail: { before: e.before, after: e.after },
          };
    case 'default-used':
      return { icon: '📦', text: `Safe default used: ${e.label}`, tone: 'warn', detail: { value: e.value } };
    case 'branch-taken':
      return { icon: '🔀', text: `Took the ${e.branch === 'then' ? '✓ yes' : '✗ no'} branch — ${e.reason}` };
    case 'paused-for-human':
      return { icon: '⏸️', text: `Paused: ${e.prompt.title}`, tone: 'warn', detail: { payload: e.prompt.payload, issues: e.prompt.issues } };
    case 'human-decision':
      return {
        icon: '🙋',
        text: `Human decision: ${e.decision.action}${e.decision.note ? ` — “${e.decision.note}”` : ''}`,
        tone: e.decision.action === 'reject' ? 'bad' : 'good',
        detail: e.decision.payload !== undefined ? { editedPayload: e.decision.payload } : undefined,
      };
    case 'safe-stopped':
      return { icon: '🛑', text: `Stopped safely: ${e.reason}`, tone: 'warn' };
    case 'checkpoint-saved':
      return { icon: '💾', text: `Checkpoint saved (${e.completedSteps} completed steps preserved)`, tone: 'good' };
    case 'run-interrupted':
      return { icon: '⚡', text: `Run interrupted: ${e.message}`, tone: 'bad' };
    case 'run-failed':
      return { icon: '❌', text: `Unhandled failure — ${e.failure.kind}: ${e.failure.message}`, tone: 'bad' };
    case 'run-finished':
      return {
        icon: e.status === 'completed' ? '🏁' : e.status === 'safe-stopped' ? '🛑' : e.status === 'interrupted' ? '⚡' : '❌',
        text: `Run finished: ${e.status}${e.outputValid === false ? ' — but the final output is INVALID' : ''}`,
        tone: e.status === 'completed' && e.outputValid !== false ? 'good' : 'bad',
        detail: e.output !== undefined ? { finalOutput: e.output, issues: e.outputIssues } : undefined,
      };
  }
}

function stepLabelFor(e: TraceEvent, labels: Record<string, string>): string | null {
  if ('stepId' in e && e.stepId && labels[e.stepId]) return labels[e.stepId];
  return null;
}

export function TracePanel() {
  const events = useStore((s) => s.liveEvents);
  const workflow = useStore((s) => (s.screen.name === 'puzzle' ? s.progress[s.screen.puzzleId].workflow : EMPTY_STEPS));

  const labels: Record<string, string> = {};
  const collect = (steps: typeof workflow) => {
    for (const s of steps) {
      labels[s.id] = s.label;
      if (s.kind === 'condition') {
        collect(s.branches.then);
        collect(s.branches.else);
      }
    }
  };
  collect(workflow);

  if (events.length === 0) {
    return <p className="muted pad">No run yet. Press <strong>▶ Run workflow</strong> and the full execution trace appears here, step by step.</p>;
  }

  return (
    <div className="trace">
      {events.map((e, i) => {
        const d = describe(e);
        const label = stepLabelFor(e, labels);
        const time = new Date(e.at).toLocaleTimeString(undefined, { hour12: false });
        return (
          <div key={i} className={`trace-row tone-${d.tone ?? 'plain'}`}>
            <span className="trace-time">{time}</span>
            <span className="trace-icon">{d.icon}</span>
            <div className="trace-body">
              {label && e.t !== 'step-started' && e.t !== 'step-restored' && <span className="trace-step">{label} · </span>}
              <span>{d.text}</span>
              {d.detail !== undefined && (
                <Collapsible summary="data">
                  <Json value={d.detail} maxHeight={220} />
                </Collapsible>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
