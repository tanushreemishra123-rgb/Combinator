/**
 * Bottom-of-workspace navigation. Gives every workspace a prominent 'Next: ...' call to action so
 * the journey (spec "Core User Journey") always has an obvious next step, plus an optional way
 * back to the previous workspace.
 */
import type { ReactElement } from 'react';
import { Button } from '../common';
import { ArrowLeftIcon, ArrowRightIcon } from '../common/icons';

export interface WorkspaceFooterNavAction {
  label: string;
  onClick: () => void;
}

export interface WorkspaceFooterNavProps {
  previous?: WorkspaceFooterNavAction;
  next?: WorkspaceFooterNavAction;
}

export function WorkspaceFooterNav({ previous, next }: WorkspaceFooterNavProps): ReactElement {
  return (
    <nav className="workspace-footer-nav" aria-label="Workspace navigation">
      <div>
        {previous ? (
          <Button variant="secondary" icon={<ArrowLeftIcon />} onClick={previous.onClick}>
            Back to {previous.label}
          </Button>
        ) : null}
      </div>
      <div>
        {next ? (
          <Button variant="primary" icon={<ArrowRightIcon />} iconPosition="end" onClick={next.onClick}>
            Next: {next.label}
          </Button>
        ) : null}
      </div>
    </nav>
  );
}
