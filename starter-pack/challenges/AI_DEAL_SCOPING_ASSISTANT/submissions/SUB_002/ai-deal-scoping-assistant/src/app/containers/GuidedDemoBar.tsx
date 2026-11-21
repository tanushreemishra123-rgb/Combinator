/**
 * Guided-demo convenience: runs every generation stage in one step once the scope is approved. The
 * normal step-by-step review flow (one "Generate" per workspace) stays the default path - this is
 * only a shortcut, so it is disabled with the same prerequisite reason shown elsewhere until the
 * scope is ready.
 */
import type { ReactElement } from 'react';
import { Button, SparklesIcon } from '../../ui/common';

export interface GuidedDemoBarProps {
  /** Why the full package cannot be generated yet, or `null` once it can. */
  prerequisite: string | null;
  busy: boolean;
  onRun: () => void;
}

export function GuidedDemoBar({ prerequisite, busy, onRun }: GuidedDemoBarProps): ReactElement {
  const disabled = prerequisite !== null || busy;
  return (
    <div className="guided-demo-bar">
      <span className="cluster guided-demo-bar-label text-sm">
        <SparklesIcon size={14} />
        Guided demo: generate every deliverable in one step
      </span>
      <Button variant="secondary" size="sm" busy={busy} disabled={disabled} title={prerequisite ?? undefined} onClick={onRun}>
        Generate full package
      </Button>
      {prerequisite !== null ? <p className="guided-demo-bar-reason text-xs text-muted">{prerequisite}</p> : null}
    </div>
  );
}
