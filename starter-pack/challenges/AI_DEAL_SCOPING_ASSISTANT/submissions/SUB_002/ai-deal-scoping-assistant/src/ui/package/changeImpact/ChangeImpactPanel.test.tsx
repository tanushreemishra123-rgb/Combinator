import { fireEvent, render, screen } from '@testing-library/react';
import { fixtureSession } from '../../../test/fixtures';
import { selectPendingActions, selectStageStatuses, useActions, useAppState, useBusy } from '../../../state';
import { createActionsMock, createAppStateMock } from '../testSupport';
import { ChangeImpactPanel } from './ChangeImpactPanel';

vi.mock('../../../state', () => ({
  useActions: vi.fn(),
  useAppState: vi.fn(),
  useBusy: vi.fn(),
  selectPendingActions: vi.fn(),
  selectStageStatuses: vi.fn(),
}));

const mockedUseActions = vi.mocked(useActions);
const mockedUseAppState = vi.mocked(useAppState);
const mockedUseBusy = vi.mocked(useBusy);
const mockedSelectPendingActions = vi.mocked(selectPendingActions);
const mockedSelectStageStatuses = vi.mocked(selectStageStatuses);

function setUpDefaults(): ReturnType<typeof createActionsMock> {
  const actions = createActionsMock();
  mockedUseActions.mockReturnValue(actions);
  mockedUseAppState.mockReturnValue(createAppStateMock());
  mockedUseBusy.mockReturnValue(null);
  mockedSelectPendingActions.mockReturnValue([]);
  mockedSelectStageStatuses.mockReturnValue([]);
  return actions;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ChangeImpactPanel', () => {
  it('shows a prerequisite state when there is no reviewed scope yet', () => {
    setUpDefaults();
    const session = { ...fixtureSession(), scope: null };
    render(<ChangeImpactPanel session={session} />);
    expect(screen.getByText('No reviewed scope yet')).toBeInTheDocument();
  });

  it('shows an approval callout in place of the form when the scope has not been approved, without hiding pending updates or the change log', () => {
    const actions = setUpDefaults();
    mockedSelectPendingActions.mockReturnValue([
      { stageId: 'estimate', label: 'Effort, timeline and ROM', action: 'recalculate', sections: ['estimate'], reasons: ['Priority changed for FR_01.'] },
    ]);
    const base = fixtureSession();
    const session = { ...base, scope: base.scope === null ? null : { ...base.scope, version: 2 } };
    render(<ChangeImpactPanel session={session} />);

    expect(screen.getByText('Approve the reviewed scope to modify it further')).toBeInTheDocument();
    expect(screen.getByText(/Change saved - approve scope version 2/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Change type' })).not.toBeInTheDocument();

    expect(screen.getByText('Priority changed for FR_01.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate estimate' }));
    expect(actions.regenerateStale).toHaveBeenCalledTimes(1);
  });

  it('shows the never-approved wording before the reviewed scope has ever been approved', () => {
    setUpDefaults();
    const base = fixtureSession();
    const session = { ...base, scope: base.scope === null ? null : { ...base.scope, version: 1, approvedVersion: null, approvedAt: null } };
    render(<ChangeImpactPanel session={session} />);
    expect(screen.getByText(/Approve it in the Customer Requirements Workspace, then come back to modify it here\./)).toBeInTheDocument();
  });

  it('renders the change form and the empty change log for an approved scope', () => {
    setUpDefaults();
    render(<ChangeImpactPanel session={fixtureSession()} />);
    expect(screen.getByRole('combobox', { name: 'Change type' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview impact' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply change' })).toBeDisabled();
    expect(screen.getByText('No changes applied yet')).toBeInTheDocument();
    expect(screen.getByText('Nothing is out of date')).toBeInTheDocument();
  });

  it('previews an impact report and only then enables Apply change', async () => {
    const actions = setUpDefaults();
    const report = {
      id: 'IMP_01',
      change: { kind: 'expected-users' as const, targetId: 'expectedUsers', label: 'Expected user volume', from: '50,000', to: '500,000' },
      affected: [{ section: 'estimate' as const, area: 'ROM estimate', elementIds: [], reason: 'Higher scale changes the cost model.', action: 'recalculate' as const }],
      unaffected: [],
      explanation: 'Mock AI mode: recalculates the ROM estimate for the new user volume.',
      createdAt: '2026-09-19T00:00:00.000Z',
      resolvedSections: [],
    };
    vi.mocked(actions.previewChange).mockResolvedValue({ changes: [], reports: [report] });

    render(<ChangeImpactPanel session={fixtureSession()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Preview impact' }));
    expect(await screen.findByText('Expected user volume')).toBeInTheDocument();
    expect(screen.getByText('ROM estimate')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply change' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Apply change' }));
    expect(actions.applyChange).toHaveBeenCalledTimes(1);
  });

  it('lists pending updates and triggers regenerateStale for that row alone from the panel', () => {
    const actions = setUpDefaults();
    mockedSelectPendingActions.mockReturnValue([
      { stageId: 'estimate', label: 'Effort, timeline and ROM', action: 'recalculate', sections: ['estimate'], reasons: ['Expected users changed from 50,000 to 500,000.'] },
    ]);

    render(<ChangeImpactPanel session={fixtureSession()} />);

    expect(screen.getByText('Expected users changed from 50,000 to 500,000.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate estimate' }));
    expect(actions.regenerateStale).toHaveBeenCalledTimes(1);
    expect(actions.regenerateStale).toHaveBeenCalledWith('estimate');
  });

  it('regenerates only the clicked row\'s stage when more than one stage is pending', () => {
    const actions = setUpDefaults();
    mockedSelectPendingActions.mockReturnValue([
      { stageId: 'estimate', label: 'Effort, timeline and ROM', action: 'recalculate', sections: ['estimate'], reasons: ['Expected users changed.'] },
      { stageId: 'architecture', label: 'Solution architecture', action: 'regenerate', sections: ['architecture'], reasons: ['Expected users changed.'] },
    ]);

    render(<ChangeImpactPanel session={fixtureSession()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate affected sections' }));
    expect(actions.regenerateStale).toHaveBeenCalledTimes(1);
    expect(actions.regenerateStale).toHaveBeenCalledWith('architecture');
  });
});
