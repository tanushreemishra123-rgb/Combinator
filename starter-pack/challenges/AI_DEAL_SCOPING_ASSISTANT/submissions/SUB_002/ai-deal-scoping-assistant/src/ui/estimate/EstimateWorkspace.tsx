/**
 * Estimate Workspace (spec "Estimate Workspace" / Functional Requirements "5. Effort, Timeline,
 * Assumptions, and ROM Commercials"). The root component takes no props: it reads the active
 * session through the state hooks and renders the no-session state itself so the rest of the
 * workspace can assume a session exists.
 */
import type { ReactElement } from 'react';
import { useActiveSession } from '../../state';
import { ClockIcon, EmptyState, SectionHeader } from '../common';
import { EstimateContent } from './EstimateContent';
import './estimate.css';

export function EstimateWorkspace(): ReactElement {
  const session = useActiveSession();

  if (session === null) {
    return (
      <div className="stack stack-lg estimate-workspace">
        <SectionHeader eyebrow="Estimate the delivery" title="Effort, timeline and ROM commercials" description="Reproduce the delivery estimate from visible scope drivers, rates and calculation rules." />
        <EmptyState icon={<ClockIcon />} title="No active session" message="Create or open a scoping session from the sidebar to estimate its delivery." />
      </div>
    );
  }

  return <EstimateContent session={session} />;
}
