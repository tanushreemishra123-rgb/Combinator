import { fireEvent, render, screen, within } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import type { SidebarStep, SidebarWorkspace } from './Sidebar';

const WORKSPACES: SidebarWorkspace[] = [
  { id: 'requirements', label: 'Customer Requirements Workspace', status: 'reviewed' },
  { id: 'prd', label: 'PRD and Scope Workspace', status: 'current' },
  { id: 'estimate', label: 'Estimate Workspace', status: 'empty' },
];

const STEPS: SidebarStep[] = [
  { id: 'input', label: 'Enter requirements', status: 'reviewed', workspaceId: 'requirements' },
  { id: 'review-scope', label: 'Review the extracted scope', status: 'reviewed', workspaceId: 'requirements' },
  { id: 'generate-prd', label: 'Generate the PRD', status: 'current', workspaceId: 'prd' },
];

describe('Sidebar', () => {
  it('renders the product name and every workspace label', () => {
    render(
      <Sidebar productName="AI Deal Scoping Assistant" steps={STEPS} workspaces={WORKSPACES} activeWorkspaceId="prd" onNavigate={vi.fn()} />,
    );
    expect(screen.getByText('AI Deal Scoping Assistant')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Customer Requirements Workspace/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Estimate Workspace/ })).toBeInTheDocument();
  });

  it('groups steps under their own workspace only', () => {
    render(
      <Sidebar productName="Assistant" steps={STEPS} workspaces={WORKSPACES} activeWorkspaceId="prd" onNavigate={vi.fn()} />,
    );
    const requirementsItem = screen.getByRole('button', { name: /Customer Requirements Workspace/ }).closest('li') as HTMLElement;
    expect(within(requirementsItem).getByText('Enter requirements')).toBeInTheDocument();
    expect(within(requirementsItem).getByText('Review the extracted scope')).toBeInTheDocument();
    expect(within(requirementsItem).queryByText('Generate the PRD')).not.toBeInTheDocument();
  });

  it('renders no step list under a workspace that has none', () => {
    render(
      <Sidebar productName="Assistant" steps={STEPS} workspaces={WORKSPACES} activeWorkspaceId="prd" onNavigate={vi.fn()} />,
    );
    const estimateItem = screen.getByRole('button', { name: /Estimate Workspace/ }).closest('li') as HTMLElement;
    expect(within(estimateItem).queryAllByRole('listitem')).toHaveLength(0);
  });

  it('marks the active workspace with aria-current', () => {
    render(
      <Sidebar productName="Assistant" steps={STEPS} workspaces={WORKSPACES} activeWorkspaceId="prd" onNavigate={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /PRD and Scope Workspace/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: /Customer Requirements Workspace/ })).not.toHaveAttribute('aria-current');
  });

  it('shows a status label for both workspaces and steps (statuses are never silently dropped)', () => {
    render(
      <Sidebar productName="Assistant" steps={STEPS} workspaces={WORKSPACES} activeWorkspaceId="prd" onNavigate={vi.fn()} />,
    );
    expect(screen.getAllByText('Reviewed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('In progress').length).toBeGreaterThan(0);
    expect(screen.getByText('Not started')).toBeInTheDocument();
  });

  it('calls onNavigate with the workspace id when a workspace button is clicked', () => {
    const onNavigate = vi.fn();
    render(
      <Sidebar productName="Assistant" steps={STEPS} workspaces={WORKSPACES} activeWorkspaceId="prd" onNavigate={onNavigate} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Estimate Workspace/ }));
    expect(onNavigate).toHaveBeenCalledWith('estimate');
  });

  it('calls onNavigate with the owning workspace id when a step is clicked', () => {
    const onNavigate = vi.fn();
    render(
      <Sidebar productName="Assistant" steps={STEPS} workspaces={WORKSPACES} activeWorkspaceId="prd" onNavigate={onNavigate} />,
    );
    fireEvent.click(screen.getByText('Enter requirements'));
    expect(onNavigate).toHaveBeenCalledWith('requirements');
  });
});
