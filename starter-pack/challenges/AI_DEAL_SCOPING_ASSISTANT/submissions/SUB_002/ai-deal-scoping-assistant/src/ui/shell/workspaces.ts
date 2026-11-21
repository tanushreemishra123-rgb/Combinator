/**
 * Canonical ids for the six recommended application sections (spec "Recommended Application
 * Sections"). Shared by `useHashRoute`, `Sidebar` and the app shell so the hash route, the sidebar
 * navigation and the workspace footer nav all agree on the same set of ids without depending on
 * `src/state`.
 */
export const WORKSPACE_IDS = ['requirements', 'prd', 'architecture', 'strategy', 'estimate', 'package'] as const;

export type WorkspaceId = (typeof WORKSPACE_IDS)[number];

export interface WorkspaceMeta {
  id: WorkspaceId;
  label: string;
  hash: string;
}

/** Display label and hash-route for each workspace, in journey order. */
export const WORKSPACE_META: readonly WorkspaceMeta[] = [
  { id: 'requirements', label: 'Customer Requirements Workspace', hash: '#/requirements' },
  { id: 'prd', label: 'PRD and Scope Workspace', hash: '#/prd' },
  { id: 'architecture', label: 'Architecture Workspace', hash: '#/architecture' },
  { id: 'strategy', label: 'Data, Integration, and AI Workspace', hash: '#/strategy' },
  { id: 'estimate', label: 'Estimate Workspace', hash: '#/estimate' },
  { id: 'package', label: 'Final Scoping Package', hash: '#/package' },
];

export function isWorkspaceId(value: string): value is WorkspaceId {
  return (WORKSPACE_IDS as readonly string[]).includes(value);
}
