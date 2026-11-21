/**
 * Renders whichever workspace is active (looked up through `workspaceRegistry`'s `Map`, never by
 * dynamic property access) followed by the shell's "Next: ..." footer nav, wired to the previous
 * and next workspace in journey order so the six recommended sections always read as one journey.
 */
import type { ReactElement } from 'react';
import { useAppState } from '../state';
import { EmptyState } from '../ui/common';
import { useWorkspaceNavigation } from '../ui/navigation';
import { WorkspaceFooterNav } from '../ui/shell';
import { getWorkspaceEntry, workspaceRegistryEntries } from './workspaceRegistry';
import type { WorkspaceRegistryEntry } from './workspaceRegistry';

/** `Array.at` accepts negative indexes, so an out-of-range target must be rejected explicitly. */
function neighbour(entries: readonly WorkspaceRegistryEntry[], index: number, offset: number): WorkspaceRegistryEntry | undefined {
  const target = index + offset;
  if (index < 0 || target < 0 || target >= entries.length) {
    return undefined;
  }
  return entries.at(target);
}

export function WorkspaceContainer(): ReactElement {
  const navigation = useWorkspaceNavigation();
  const { activeSessionId } = useAppState();
  const entries = workspaceRegistryEntries();
  const entry = getWorkspaceEntry(navigation.activeWorkspace);
  const activeIndex = entries.findIndex((candidate) => candidate.id === navigation.activeWorkspace);
  const previousEntry = neighbour(entries, activeIndex, -1);
  const nextEntry = neighbour(entries, activeIndex, 1);

  if (entry === undefined) {
    return <EmptyState title="Workspace not found" message="Choose a workspace from the navigation to continue." />;
  }

  const ActiveWorkspace = entry.Component;

  return (
    <div className="stack stack-lg">
      {/* Keyed by session: switching sessions starts every workspace from that session's own state (tabs, filters, drafts). */}
      <ActiveWorkspace key={activeSessionId ?? 'no-session'} />
      <WorkspaceFooterNav
        previous={previousEntry ? { label: previousEntry.label, onClick: () => navigation.navigate(previousEntry.id) } : undefined}
        next={nextEntry ? { label: nextEntry.label, onClick: () => navigation.navigate(nextEntry.id) } : undefined}
      />
    </div>
  );
}
