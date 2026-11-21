/**
 * Data, Integration, and AI Workspace (spec 4 / "Recommended Application Sections" 4). The root
 * component takes no props: it reads the active session through the state hooks and renders the
 * no-session state itself so the rest of the workspace can assume a session exists.
 */
import type { ReactElement } from 'react';
import { useActiveSession } from '../../state';
import { EmptyState, SectionHeader } from '../common';
import { StrategyContent } from './StrategyContent';
import './strategy.css';

export function StrategyWorkspace(): ReactElement {
  const session = useActiveSession();

  if (session === null) {
    return (
      <div className="stack stack-lg strategy-workspace">
        <SectionHeader
          title="Data, Integration, and AI Workspace"
          description="Plan how data and systems connect, and where AI fits the reviewed requirements."
        />
        <EmptyState
          title="No active session"
          message="Create or open a scoping session from the sidebar to plan the data, integration and AI solution strategy."
        />
      </div>
    );
  }

  return <StrategyContent session={session} />;
}
