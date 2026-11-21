/**
 * Deep-navy primary navigation: the product name, the six workspaces (spec "Recommended
 * Application Sections") and the journey steps grouped underneath each one, with a status dot per
 * step and per workspace. Purely presentational - the caller supplies the steps/workspaces and
 * status, and receives clicks through `onNavigate`.
 */
import type { ReactElement } from 'react';
import type { StatusPillStatus } from '../common';
import { StatusPill } from '../common';

export interface SidebarStep {
  id: string;
  label: string;
  hint?: string;
  status: StatusPillStatus;
  workspaceId: string;
}

export interface SidebarWorkspace {
  id: string;
  label: string;
  status: StatusPillStatus;
}

export interface SidebarProps {
  productName: string;
  steps: SidebarStep[];
  workspaces: SidebarWorkspace[];
  activeWorkspaceId: string;
  onNavigate: (workspaceId: string) => void;
}

function stepsForWorkspace(steps: SidebarStep[], workspaceId: string): SidebarStep[] {
  return steps.filter((step) => step.workspaceId === workspaceId);
}

export function Sidebar({ productName, steps, workspaces, activeWorkspaceId, onNavigate }: SidebarProps): ReactElement {
  return (
    <nav className="sidebar" aria-label="Workspaces">
      <p className="sidebar-product">{productName}</p>
      <ul className="sidebar-workspaces">
        {workspaces.map((workspace) => {
          const isActive = workspace.id === activeWorkspaceId;
          const workspaceSteps = stepsForWorkspace(steps, workspace.id);
          return (
            <li key={workspace.id} className="sidebar-workspace">
              <button
                type="button"
                className={`sidebar-workspace-button${isActive ? ' sidebar-workspace-button-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onNavigate(workspace.id)}
              >
                <StatusPill status={workspace.status} dotOnly />
                <span className="sidebar-workspace-label">{workspace.label}</span>
              </button>
              {workspaceSteps.length > 0 ? (
                <ul className="sidebar-steps">
                  {workspaceSteps.map((step) => (
                    <li key={step.id}>
                      <button type="button" className="sidebar-step" title={step.hint} onClick={() => onNavigate(step.workspaceId)}>
                        <StatusPill status={step.status} dotOnly />
                        <span className="sidebar-step-label">{step.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
