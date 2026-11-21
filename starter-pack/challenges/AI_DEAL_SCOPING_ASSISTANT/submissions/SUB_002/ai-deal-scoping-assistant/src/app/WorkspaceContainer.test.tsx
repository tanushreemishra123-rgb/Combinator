/**
 * Behaviour tests for the active-workspace renderer and its "Next: ..." footer nav: the footer
 * must always point at the previous/next workspace in journey order, with no previous action on
 * the first workspace and no next action on the last, and its buttons must drive real navigation.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { NavigationContext } from '../ui/navigation';
import type { WorkspaceNavigation } from '../ui/navigation';
import { WorkspaceContainer } from './WorkspaceContainer';

vi.mock('../state', () => ({ useAppState: () => ({ activeSessionId: 'session-1' }) }));
vi.mock('../ui/requirements', () => ({ RequirementsWorkspace: () => 'Requirements Workspace Stub' }));
vi.mock('../ui/prd', () => ({ PrdWorkspace: () => 'PRD Workspace Stub' }));
vi.mock('../ui/architecture', () => ({ ArchitectureWorkspace: () => 'Architecture Workspace Stub' }));
vi.mock('../ui/strategy', () => ({ StrategyWorkspace: () => 'Strategy Workspace Stub' }));
vi.mock('../ui/estimate', () => ({ EstimateWorkspace: () => 'Estimate Workspace Stub' }));
vi.mock('../ui/package', () => ({ PackageWorkspace: () => 'Package Workspace Stub' }));

function renderAt(activeWorkspace: WorkspaceNavigation['activeWorkspace'], navigate = vi.fn()): ReactElement {
  const navigation: WorkspaceNavigation = { activeWorkspace, focusId: null, navigate, clearFocus: vi.fn() };
  return (
    <NavigationContext.Provider value={navigation}>
      <WorkspaceContainer />
    </NavigationContext.Provider>
  );
}

describe('WorkspaceContainer', () => {
  it('renders the active workspace looked up from the registry', () => {
    render(renderAt('prd'));
    expect(screen.getByText('PRD Workspace Stub')).toBeInTheDocument();
  });

  it('has no "back" action on the first workspace but does have a "next" action', () => {
    render(renderAt('requirements'));
    expect(screen.queryByRole('button', { name: /Back to/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next: PRD and Scope Workspace' })).toBeInTheDocument();
  });

  it('has no "next" action on the last workspace but does have a "back" action', () => {
    render(renderAt('package'));
    expect(screen.queryByRole('button', { name: /Next:/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Estimate Workspace' })).toBeInTheDocument();
  });

  it('has both a back and a next action for a workspace in the middle of the journey', () => {
    render(renderAt('architecture'));
    expect(screen.getByRole('button', { name: 'Back to PRD and Scope Workspace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next: Data, Integration, and AI Workspace/ })).toBeInTheDocument();
  });

  it('navigates to the next workspace in journey order when "Next" is clicked', () => {
    const navigate = vi.fn();
    render(renderAt('requirements', navigate));
    fireEvent.click(screen.getByRole('button', { name: 'Next: PRD and Scope Workspace' }));
    expect(navigate).toHaveBeenCalledWith('prd');
  });
});
