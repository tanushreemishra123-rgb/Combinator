/**
 * Architecture Workspace root (spec "Architecture Workspace" + Functional Requirements 3: "Cloud
 * Solution Architecture"). The root component takes no props: it reads the active session through
 * the state hooks and renders the no-session state itself so the rest of the workspace can assume a
 * session exists.
 */
import type { ReactElement } from 'react';
import { useActiveSession } from '../../state';
import { EmptyState, SectionHeader } from '../common';
import { ArchitectureContent } from './ArchitectureContent';

export function ArchitectureWorkspace(): ReactElement {
  const session = useActiveSession();

  if (session === null) {
    return (
      <div className="stack stack-lg architecture-workspace">
        <SectionHeader title="Architecture Workspace" description="Design and review a cloud-specific solution architecture for the reviewed requirements." />
        <EmptyState title="No active session" message="Create or open a scoping session from the sidebar to design its cloud solution architecture." />
      </div>
    );
  }

  return <ArchitectureContent session={session} />;
}
