/**
 * Wires the shell's `Sidebar` to `selectJourney` (the twelve journey steps in the spec's wording)
 * and derives each of the six workspaces' own status from the steps that belong to it.
 */
import { useMemo } from 'react';
import type { ReactElement } from 'react';
import { selectJourney, useActiveSession } from '../../state';
import { Sidebar, WORKSPACE_META } from '../../ui/shell';
import type { SidebarStep, SidebarWorkspace } from '../../ui/shell';
import { isWorkspaceId, useWorkspaceNavigation } from '../../ui/navigation';
import { journeyStatusToPill, workspaceStatusFromJourney } from './sidebarStatus';

const PRODUCT_NAME = 'AI Deal Scoping Assistant';

export function SidebarContainer(): ReactElement {
  const session = useActiveSession();
  const navigation = useWorkspaceNavigation();
  const journey = useMemo(() => selectJourney(session), [session]);

  const steps: SidebarStep[] = journey.map((step) => ({
    id: step.id,
    label: step.label,
    hint: step.hint,
    status: journeyStatusToPill(step.status),
    workspaceId: step.workspaceId,
  }));

  const workspaces: SidebarWorkspace[] = WORKSPACE_META.map((meta) => ({
    id: meta.id,
    label: meta.label,
    status: workspaceStatusFromJourney(journey, meta.id),
  }));

  function handleNavigate(id: string): void {
    if (isWorkspaceId(id)) {
      navigation.navigate(id);
    }
  }

  return (
    <Sidebar
      productName={PRODUCT_NAME}
      steps={steps}
      workspaces={workspaces}
      activeWorkspaceId={navigation.activeWorkspace}
      onNavigate={handleNavigate}
    />
  );
}
