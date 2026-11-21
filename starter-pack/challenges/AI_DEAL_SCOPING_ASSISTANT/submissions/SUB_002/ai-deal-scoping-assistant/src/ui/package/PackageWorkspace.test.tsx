import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { CoverageReport, PackageDocument } from '../../domain';
import { fixtureSession } from '../../test/fixtures';
import {
  buildPackageForSession,
  selectCoverage,
  selectHasOutputs,
  selectPendingActions,
  selectStageStatuses,
  useActions,
  useActiveSession,
  useAppState,
  useBusy,
} from '../../state';
import { buildPackageDiagrams } from '../../export';
import { WorkspaceContainer } from '../../app/WorkspaceContainer';
import { NavigationContext } from '../navigation';
import type { WorkspaceNavigation } from '../navigation';
import { createActionsMock, createAppStateMock } from './testSupport';
import { PackageWorkspace } from './PackageWorkspace';

vi.mock('../../state', () => ({
  useActions: vi.fn(),
  useActiveSession: vi.fn(),
  useAppState: vi.fn(),
  useBusy: vi.fn(),
  selectPendingActions: vi.fn(),
  selectStageStatuses: vi.fn(),
  selectCoverage: vi.fn(),
  selectHasOutputs: vi.fn(),
  buildPackageForSession: vi.fn(),
}));

vi.mock('../../export', () => ({
  buildPackageDiagrams: vi.fn(),
}));

const mockedUseActions = vi.mocked(useActions);
const mockedUseActiveSession = vi.mocked(useActiveSession);
const mockedUseAppState = vi.mocked(useAppState);
const mockedUseBusy = vi.mocked(useBusy);
const mockedSelectPendingActions = vi.mocked(selectPendingActions);
const mockedSelectStageStatuses = vi.mocked(selectStageStatuses);
const mockedSelectCoverage = vi.mocked(selectCoverage);
const mockedSelectHasOutputs = vi.mocked(selectHasOutputs);
const mockedBuildPackageForSession = vi.mocked(buildPackageForSession);
const mockedBuildPackageDiagrams = vi.mocked(buildPackageDiagrams);

const EMPTY_COVERAGE: CoverageReport = {
  rows: [],
  links: [],
  totalRequirements: 0,
  coveredRequirements: 0,
  coveragePct: 0,
  highPriorityCoveragePct: 0,
  uncoveredIds: [],
  unsupportedAdditions: [],
};

const EMPTY_DOCUMENT: PackageDocument = {
  title: 'Fixture session - Integrated Scoping Package',
  subtitle: 'Fixture session',
  generatedAt: '2026-09-19T00:00:00.000Z',
  aiModeLabel: 'Mock AI mode',
  exportStatus: 'Blocked',
  disclaimer: 'This document is an AI-assisted internal planning output.',
  sections: [],
};

function renderWithNavigation(navigation: Partial<WorkspaceNavigation> = {}): ReactElement {
  const value: WorkspaceNavigation = {
    activeWorkspace: 'package',
    focusId: null,
    navigate: vi.fn(),
    clearFocus: vi.fn(),
    ...navigation,
  };
  return (
    <NavigationContext.Provider value={value}>
      <PackageWorkspace />
    </NavigationContext.Provider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseActions.mockReturnValue(createActionsMock());
  mockedUseAppState.mockReturnValue(createAppStateMock());
  mockedUseBusy.mockReturnValue(null);
  mockedSelectPendingActions.mockReturnValue([]);
  mockedSelectStageStatuses.mockReturnValue([]);
  mockedSelectCoverage.mockReturnValue(EMPTY_COVERAGE);
  mockedSelectHasOutputs.mockReturnValue(false);
  mockedBuildPackageForSession.mockReturnValue(EMPTY_DOCUMENT);
  mockedBuildPackageDiagrams.mockReturnValue(new Map());
});

describe('PackageWorkspace', () => {
  it('shows an empty state when there is no active session', () => {
    mockedUseActiveSession.mockReturnValue(null);
    render(renderWithNavigation());
    expect(screen.getAllByText('No active session').length).toBeGreaterThan(0);
  });

  it('opens on the Change Impact tab by default', () => {
    mockedUseActiveSession.mockReturnValue(fixtureSession());
    render(renderWithNavigation());
    expect(screen.getByRole('tab', { name: 'Change Impact' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Preview impact' })).toBeInTheDocument();
  });

  it('switches tabs on click, rendering that tab alone', () => {
    mockedUseActiveSession.mockReturnValue(fixtureSession());
    render(renderWithNavigation());

    fireEvent.click(screen.getByRole('tab', { name: 'Requirement Coverage' }));
    expect(screen.getByRole('tab', { name: 'Requirement Coverage' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: 'Preview impact' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Quality Gate' }));
    expect(screen.getByRole('button', { name: 'Run the pre-export quality check' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Package Preview and Export' }));
    expect(screen.getByRole('button', { name: 'Export Markdown' })).toBeInTheDocument();
  });

  it('opens the tab named by a cross-workspace focus request and clears it', () => {
    mockedUseActiveSession.mockReturnValue(fixtureSession());
    const clearFocus = vi.fn();
    render(renderWithNavigation({ focusId: 'quality', clearFocus }));
    expect(screen.getByRole('tab', { name: 'Quality Gate' })).toHaveAttribute('aria-selected', 'true');
    expect(clearFocus).toHaveBeenCalledTimes(1);
  });

  it('ignores a focus id that does not name one of this workspace\'s tabs', () => {
    mockedUseActiveSession.mockReturnValue(fixtureSession());
    render(renderWithNavigation({ focusId: 'FR_01' }));
    expect(screen.getByRole('tab', { name: 'Change Impact' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('PackageWorkspace - rendered inside the app shell', () => {
  it('ends with exactly one "Back to Estimate Workspace" control, not one from the workspace and one from the shell', () => {
    mockedUseActiveSession.mockReturnValue(fixtureSession());
    const navigation: WorkspaceNavigation = { activeWorkspace: 'package', focusId: null, navigate: vi.fn(), clearFocus: vi.fn() };
    render(
      <NavigationContext.Provider value={navigation}>
        <WorkspaceContainer />
      </NavigationContext.Provider>,
    );

    expect(screen.getAllByRole('button', { name: /Back to Estimate Workspace/ })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Next:/ })).not.toBeInTheDocument();
  });
});
