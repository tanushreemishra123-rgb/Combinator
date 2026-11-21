import { fireEvent, render, screen } from '@testing-library/react';
import type { QualityReport } from '../../../domain';
import { fixtureSession } from '../../../test/fixtures';
import { useActions } from '../../../state';
import { createActionsMock } from '../testSupport';
import { QualityTab } from './QualityTab';

vi.mock('../../../state', () => ({
  useActions: vi.fn(),
}));

const mockedUseActions = vi.mocked(useActions);

const QUALITY_REPORT: QualityReport = {
  ranAt: '2026-09-19T00:00:00.000Z',
  scopeVersion: 1,
  checks: [
    { id: 'uncovered-requirements', label: 'Uncovered requirements', description: 'Every reviewed requirement should be cited by at least one generated element.', status: 'warn', count: 1, findings: [{ message: 'FR_02 is not cited by any generated element.', refs: ['FR_02'] }] },
    { id: 'high-priority-coverage', label: 'High-priority coverage', description: 'High-priority requirements should be fully covered.', status: 'pass', count: 0, findings: [] },
  ],
  summary: {
    requirementCoveragePct: 92,
    uncoveredRequirements: 2,
    unresolvedQuestions: 4,
    unsupportedRecommendations: 1,
    estimationGaps: 0,
    inconsistencies: 0,
    humanValidationItems: 1,
    estimateConfidence: 'Medium',
    exportStatus: 'Review Required',
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QualityTab', () => {
  it('shows a prerequisite state when there is no reviewed scope yet', () => {
    mockedUseActions.mockReturnValue(createActionsMock());
    const session = { ...fixtureSession(), scope: null };
    render(<QualityTab session={session} />);
    expect(screen.getByText('Nothing to check yet')).toBeInTheDocument();
  });

  it('offers to run the quality gate when it has never run', () => {
    const actions = createActionsMock();
    mockedUseActions.mockReturnValue(actions);
    render(<QualityTab session={fixtureSession()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run the pre-export quality check' }));
    expect(actions.runQuality).toHaveBeenCalledTimes(1);
  });

  it('renders the spec-format summary tiles and every check once a report exists', () => {
    mockedUseActions.mockReturnValue(createActionsMock());
    const session = { ...fixtureSession(), quality: QUALITY_REPORT };
    render(<QualityTab session={session} />);

    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('Review Required')).toBeInTheDocument();
    expect(screen.getByText('Medium')).toBeInTheDocument();
    expect(screen.getByText(/Uncovered requirements - 1 finding/)).toBeInTheDocument();
    expect(screen.getByText(/High-priority coverage - 0 findings/)).toBeInTheDocument();
  });

  it('shows an outdated notice when the scope has changed since the last run', () => {
    const base = fixtureSession();
    const session = {
      ...base,
      quality: QUALITY_REPORT,
      scope: base.scope === null ? null : { ...base.scope, version: 2 },
    };
    mockedUseActions.mockReturnValue(createActionsMock());
    render(<QualityTab session={session} />);
    expect(screen.getByText('This report is outdated')).toBeInTheDocument();
  });

  it('does not show the outdated notice when the report still matches the session', () => {
    const session = { ...fixtureSession(), quality: QUALITY_REPORT };
    mockedUseActions.mockReturnValue(createActionsMock());
    render(<QualityTab session={session} />);
    expect(screen.queryByText('This report is outdated')).not.toBeInTheDocument();
  });
});
