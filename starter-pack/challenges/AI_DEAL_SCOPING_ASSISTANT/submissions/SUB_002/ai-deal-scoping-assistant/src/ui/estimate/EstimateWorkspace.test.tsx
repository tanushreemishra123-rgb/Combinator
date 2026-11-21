/**
 * Behaviour tests for the Estimate Workspace's main flows: the no-session, prerequisite-missing,
 * ready-to-generate, generated and stale (recalculate vs regenerate) states. The state module is
 * mocked at the boundary so these tests never depend on its own runtime behaviour.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScopingSession } from '../../domain';
import type { PendingAction } from '../../impact';
import type { BusyState } from '../../state';
import { selectPendingActions, stagePrerequisite, useActions, useActiveSession, useBusy } from '../../state';
import { EstimateWorkspace } from './EstimateWorkspace';
import { sessionWithEstimate, sessionWithoutApproval, withStaleEstimate } from './estimateTestFixtures';
import { createActionsMock } from './testHelpers';
import { fixtureSession } from '../../test/fixtures';

vi.mock('../../state', () => ({
  useActiveSession: vi.fn(),
  useActions: vi.fn(),
  useBusy: vi.fn(),
  selectPendingActions: vi.fn(),
  stagePrerequisite: vi.fn(),
}));

interface MockOptions {
  session: ScopingSession | null;
  prerequisite?: string | null;
  pending?: PendingAction[];
  busy?: BusyState | null;
  actions?: ReturnType<typeof createActionsMock>;
}

function mockHooks(options: MockOptions): ReturnType<typeof createActionsMock> {
  const actions = options.actions ?? createActionsMock();
  vi.mocked(useActiveSession).mockReturnValue(options.session);
  vi.mocked(useActions).mockReturnValue(actions);
  vi.mocked(useBusy).mockReturnValue(options.busy ?? null);
  vi.mocked(stagePrerequisite).mockReturnValue(options.prerequisite ?? null);
  vi.mocked(selectPendingActions).mockReturnValue(options.pending ?? []);
  return actions;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EstimateWorkspace - no active session', () => {
  it('shows the no-session empty state instead of a blank panel', () => {
    mockHooks({ session: null });
    render(<EstimateWorkspace />);
    expect(screen.getByText('No active session')).toBeInTheDocument();
  });
});

describe('EstimateWorkspace - prerequisite missing', () => {
  it('shows the prerequisite, disables the generate action, but keeps the inputs panel visible', () => {
    const session = sessionWithoutApproval();
    mockHooks({ session, prerequisite: 'Approve the requirements before generating deliverables.' });
    render(<EstimateWorkspace />);

    expect(screen.getByText('Approve the requirements before generating deliverables.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Estimate the delivery' })).toBeDisabled();
    expect(screen.getByText('Estimation inputs')).toBeInTheDocument();
    expect(screen.getByText('No estimate yet')).toBeInTheDocument();
  });
});

describe('EstimateWorkspace - ready to generate', () => {
  it('calls generateStage("estimate") when the generate action is clicked', () => {
    const session = fixtureSession();
    const actions = mockHooks({ session, prerequisite: null });
    render(<EstimateWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'Estimate the delivery' }));
    expect(actions.generateStage).toHaveBeenCalledWith('estimate');
  });

  it('edits a solution assumption directly, even before anything has been generated', () => {
    const session = fixtureSession();
    const actions = mockHooks({ session, prerequisite: null });
    render(<EstimateWorkspace />);

    const usersInput = screen.getByLabelText('Expected users');
    fireEvent.change(usersInput, { target: { value: '25000' } });
    expect(actions.updateSolutionConfig).toHaveBeenCalledWith({ expectedUsers: 25000 });
  });

  it('does not render summary tiles before an estimate exists', () => {
    const session = fixtureSession();
    mockHooks({ session, prerequisite: null });
    render(<EstimateWorkspace />);

    expect(screen.queryByText('ROM commercial range')).not.toBeInTheDocument();
    expect(screen.getByText('Estimation inputs')).toBeInTheDocument();
  });
});

describe('EstimateWorkspace - generated estimate', () => {
  it('renders summary tiles, workstreams, roles, confidence and the context-only historical panel', () => {
    const session = sessionWithEstimate();
    mockHooks({ session, prerequisite: null });
    render(<EstimateWorkspace />);

    expect(screen.getByRole('button', { name: 'Regenerate the estimate' })).toBeInTheDocument();
    expect(screen.getByText('ROM commercial range')).toBeInTheDocument();
    expect(screen.getAllByText(/Workstream WS_01/).length).toBeGreaterThan(0);
    expect(screen.getByText('Roles and skills')).toBeInTheDocument();
    expect(screen.getByText('Confidence and missing inputs')).toBeInTheDocument();
    expect(screen.getByText('Illustrative historical delivery references (context only)')).toBeInTheDocument();
    expect(screen.getByText(/never read by the calculation engine/)).toBeInTheDocument();
  });

  it('shows the summary tiles directly below the header, before the estimation inputs and the rest of the result', () => {
    const session = sessionWithEstimate();
    mockHooks({ session, prerequisite: null });
    render(<EstimateWorkspace />);

    const summary = screen.getByText('ROM commercial range');
    const inputs = screen.getByText('Estimation inputs');
    const phases = screen.getByText('Delivery phases and timeline');

    // DOCUMENT_POSITION_FOLLOWING means the second node comes after the first in the DOM.
    expect(summary.compareDocumentPosition(inputs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(inputs.compareDocumentPosition(phases) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('marks the estimate reviewed through the header toggle', () => {
    const session = sessionWithEstimate();
    const actions = mockHooks({ session, prerequisite: null });
    render(<EstimateWorkspace />);

    fireEvent.click(screen.getByLabelText('Mark as reviewed'));
    expect(actions.setStageReviewed).toHaveBeenCalledWith('estimate', true);
  });

  it('lists the missing estimation inputs with their effect and how to resolve them', () => {
    const session = sessionWithEstimate();
    mockHooks({ session, prerequisite: null });
    render(<EstimateWorkspace />);

    expect(screen.getByText('Target deployment regions')).toBeInTheDocument();
    expect(screen.getAllByText('Confidence reduced').length).toBeGreaterThan(0);
  });
});

describe('EstimateWorkspace - stale estimate', () => {
  it('offers to recalculate when every pending change is a pure engine recalculation', () => {
    const session = withStaleEstimate(sessionWithEstimate());
    const pending: PendingAction = { stageId: 'estimate', label: 'Effort, timeline and ROM', action: 'recalculate', sections: ['estimate'], reasons: ['Rate card changed.'] };
    const actions = mockHooks({ session, prerequisite: null, pending: [pending] });
    render(<EstimateWorkspace />);

    const banner = screen.getByText('This section is out of date').closest('[role="status"]') as HTMLElement;
    const recalcButton = within(banner).getByRole('button', { name: 'Recalculate the estimate' });
    fireEvent.click(recalcButton);
    expect(actions.regenerateStale).toHaveBeenCalled();
    expect(actions.generateStage).not.toHaveBeenCalled();
  });

  it('offers to regenerate when the AI stage must run again', () => {
    const session = withStaleEstimate(sessionWithEstimate());
    const pending: PendingAction = { stageId: 'estimate', label: 'Effort, timeline and ROM', action: 'regenerate', sections: ['estimate'], reasons: ['Reviewed scope changed.'] };
    const actions = mockHooks({ session, prerequisite: null, pending: [pending] });
    render(<EstimateWorkspace />);

    const banner = screen.getByText('This section is out of date').closest('[role="status"]') as HTMLElement;
    fireEvent.click(within(banner).getByRole('button', { name: 'Regenerate the estimate' }));
    expect(actions.generateStage).toHaveBeenCalledWith('estimate');
    expect(actions.regenerateStale).not.toHaveBeenCalled();
  });
});
