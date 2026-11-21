/**
 * Behaviour tests for step 4, "Approve the requirements": pending-item gating, approval status,
 * the re-approval notice, and the change-flow notice once downstream deliverables already exist.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ScopingSession } from '../../../domain';
import { fixtureSession } from '../../../test/fixtures';
import { NavigationContext } from '../../navigation';
import type { WorkspaceNavigation } from '../../navigation';
import { ApproveStep } from './ApproveStep';

const { mockUseActions, mockUseBusy, mockSelectHasOutputs } = vi.hoisted(() => ({
  mockUseActions: vi.fn(),
  mockUseBusy: vi.fn(),
  mockSelectHasOutputs: vi.fn(),
}));

vi.mock('../../../state', () => ({
  useActions: mockUseActions,
  useBusy: mockUseBusy,
  selectHasOutputs: mockSelectHasOutputs,
}));

const actions = {
  approveAllPending: vi.fn(),
  approveScope: vi.fn(),
};

function renderApproveStep(session: ScopingSession, navigationOverrides: Partial<WorkspaceNavigation> = {}) {
  const navigation: WorkspaceNavigation = { activeWorkspace: 'requirements', focusId: null, navigate: vi.fn(), clearFocus: vi.fn(), ...navigationOverrides };
  render(
    <NavigationContext.Provider value={navigation}>
      <ApproveStep session={session} />
    </NavigationContext.Provider>,
  );
  return navigation;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseActions.mockReturnValue(actions);
  mockUseBusy.mockReturnValue(null);
  mockSelectHasOutputs.mockReturnValue(false);
});

describe('ApproveStep - no scope yet', () => {
  it('shows a prerequisite message instead of a blank panel', () => {
    renderApproveStep({ ...fixtureSession(), scope: null });
    expect(screen.getByText('Run the analysis first')).toBeInTheDocument();
  });
});

describe('ApproveStep - pending items', () => {
  it('gates "Approve the scope model" until every item is reviewed', () => {
    const session = fixtureSession();
    const scope = session.scope;
    expect(scope).not.toBeNull();
    const pendingScope = { ...scope!, items: scope!.items.map((item, index) => (index === 0 ? { ...item, review: 'pending' as const } : item)) };
    renderApproveStep({ ...session, scope: pendingScope });

    expect(screen.getByRole('button', { name: 'Approve the scope model' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Approve all pending' })).toBeEnabled();
    expect(screen.getByText(/still need to be approved or rejected/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Approve all pending' }));
    expect(actions.approveAllPending).toHaveBeenCalled();
  });
});

describe('ApproveStep - approval status', () => {
  it('approves the scope model once every item is reviewed', () => {
    const session = fixtureSession();
    renderApproveStep({ ...session, scope: { ...session.scope!, approvedAt: null, approvedVersion: null } });

    expect(screen.getByText('Not yet approved')).toBeInTheDocument();
    const approveButton = screen.getByRole('button', { name: 'Approve the scope model' });
    expect(approveButton).toBeEnabled();
    fireEvent.click(approveButton);
    expect(actions.approveScope).toHaveBeenCalled();
  });

  it('shows the approved badge once the current version is approved', () => {
    renderApproveStep(fixtureSession());
    expect(screen.getByText(/Approved on/)).toBeInTheDocument();
    expect(screen.getByText(/version 1/)).toBeInTheDocument();
  });

  it('asks for re-approval once the scope changed after it was approved', () => {
    const session = fixtureSession();
    renderApproveStep({ ...session, scope: { ...session.scope!, version: 2 } });
    expect(screen.getByText('Needs re-approval')).toBeInTheDocument();
  });

  it('disables both approval actions while busy', () => {
    mockUseBusy.mockReturnValue({ label: 'Approving...', stageId: null });
    renderApproveStep({ ...fixtureSession(), scope: { ...fixtureSession().scope!, approvedAt: null, approvedVersion: null } });
    expect(screen.getByRole('button', { name: 'Approve the scope model' })).toBeDisabled();
  });
});

describe('ApproveStep - downstream deliverables', () => {
  it('explains why approval matters', () => {
    renderApproveStep(fixtureSession());
    expect(screen.getByText('Why approval matters')).toBeInTheDocument();
  });

  it('shows the change-flow notice and links to the Change Impact tab once outputs exist', () => {
    mockSelectHasOutputs.mockReturnValue(true);
    const navigation = renderApproveStep(fixtureSession());
    expect(screen.getByText('Downstream deliverables already exist')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Change Impact tab/ }));
    expect(navigation.navigate).toHaveBeenCalledWith('package', 'change-impact');
  });

  it('does not show the change-flow notice when nothing has been generated yet', () => {
    mockSelectHasOutputs.mockReturnValue(false);
    renderApproveStep(fixtureSession());
    expect(screen.queryByText('Downstream deliverables already exist')).not.toBeInTheDocument();
  });
});
