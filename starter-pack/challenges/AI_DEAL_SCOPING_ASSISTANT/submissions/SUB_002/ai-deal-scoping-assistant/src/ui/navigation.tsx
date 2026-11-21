/**
 * Cross-workspace navigation contract. Workspaces never talk to the router directly: they call
 * navigate(workspaceId, focusId) - e.g. clicking the chip 'FR_01' anywhere opens that requirement
 * in the Customer Requirements Workspace. The app shell provides the implementation.
 */
import { createContext, useContext } from 'react';

export const WORKSPACE_IDS = ['requirements', 'prd', 'architecture', 'strategy', 'estimate', 'package'] as const;
export type WorkspaceId = (typeof WORKSPACE_IDS)[number];

const WORKSPACE_LABELS: ReadonlyMap<WorkspaceId, string> = new Map([
  ['requirements', 'Customer Requirements Workspace'],
  ['prd', 'PRD and Scope Workspace'],
  ['architecture', 'Architecture Workspace'],
  ['strategy', 'Data, Integration, and AI Workspace'],
  ['estimate', 'Estimate Workspace'],
  ['package', 'Final Scoping Package'],
]);

export function workspaceLabel(id: WorkspaceId): string {
  return WORKSPACE_LABELS.get(id) ?? id;
}

export function isWorkspaceId(value: string): value is WorkspaceId {
  return WORKSPACE_IDS.some((id) => id === value);
}

export interface WorkspaceNavigation {
  activeWorkspace: WorkspaceId;
  /** Element the target workspace should reveal (scope item id, or a tab id such as 'quality'). */
  focusId: string | null;
  navigate(workspace: WorkspaceId, focusId?: string): void;
  clearFocus(): void;
}

/** Inert default so components can be rendered in isolation (tests, previews). */
const INERT_NAVIGATION: WorkspaceNavigation = {
  activeWorkspace: 'requirements',
  focusId: null,
  navigate: () => undefined,
  clearFocus: () => undefined,
};

export const NavigationContext = createContext<WorkspaceNavigation>(INERT_NAVIGATION);

export function useWorkspaceNavigation(): WorkspaceNavigation {
  return useContext(NavigationContext);
}
