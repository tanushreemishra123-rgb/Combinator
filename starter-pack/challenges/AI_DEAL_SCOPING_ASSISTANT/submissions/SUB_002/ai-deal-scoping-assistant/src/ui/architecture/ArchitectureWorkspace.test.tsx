/**
 * Behaviour tests for the Architecture Workspace root: prerequisite gating, generation, the
 * reviewed toggle, the stale banner, platform selection (routed through the change flow), the
 * transparent recommendation table, tab switching, diagram node selection and cross-workspace
 * navigation. The state layer is mocked (fixed contract, see src/state/index.ts) so these tests
 * never depend on another engineer's in-progress use-case or selector bodies; `recommendPlatform`
 * and `buildArchitectureDiagram` are used for real, since the architecture engine module is
 * finished and pure.
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ScopingSession } from '../../domain';
import { fixtureSession } from '../../test/fixtures';
import { NavigationContext } from '../navigation';
import type { WorkspaceNavigation } from '../navigation';
import { ArchitectureWorkspace } from './ArchitectureWorkspace';
import { fixtureArchitectureDesign, fixtureGenerationMeta, fixtureStageStatus, fixtureUnjustifiedComponent } from './architectureFixtures';

const { mockUseActiveSession, mockUseActions, mockUseBusy, mockSelectStageStatuses, mockSelectCoverage } = vi.hoisted(() => ({
  mockUseActiveSession: vi.fn(),
  mockUseActions: vi.fn(),
  mockUseBusy: vi.fn(),
  mockSelectStageStatuses: vi.fn(),
  mockSelectCoverage: vi.fn(),
}));

vi.mock('../../state', () => ({
  useActiveSession: mockUseActiveSession,
  useActions: mockUseActions,
  useBusy: mockUseBusy,
  selectStageStatuses: mockSelectStageStatuses,
  selectCoverage: mockSelectCoverage,
}));

const actions = {
  generateStage: vi.fn(),
  setStageReviewed: vi.fn(),
  updateSolutionConfig: vi.fn(),
};

function sessionWithArchitecture(overrides: Partial<ScopingSession['outputs']['architecture']> = {}): ScopingSession {
  const session = fixtureSession();
  return {
    ...session,
    outputs: {
      ...session.outputs,
      architecture: { data: null, status: 'empty', reviewed: false, meta: null, staleReasons: [], ...overrides },
    },
  };
}

function renderWorkspace(navigate: (workspace: string, focusId?: string) => void = vi.fn()) {
  const navigation: WorkspaceNavigation = { activeWorkspace: 'architecture', focusId: null, navigate, clearFocus: vi.fn() };
  return render(
    <NavigationContext.Provider value={navigation}>
      <ArchitectureWorkspace />
    </NavigationContext.Provider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseActions.mockReturnValue(actions);
  mockUseBusy.mockReturnValue(null);
  mockSelectCoverage.mockReturnValue({
    rows: [],
    links: [],
    totalRequirements: 0,
    coveredRequirements: 0,
    coveragePct: 0,
    highPriorityCoveragePct: 0,
    uncoveredIds: [],
    unsupportedAdditions: [],
  });
});

describe('ArchitectureWorkspace - no session / stage lookup failure', () => {
  it('shows an empty state when there is no active session', () => {
    mockUseActiveSession.mockReturnValue(null);
    renderWorkspace();
    expect(screen.getByText('No active session')).toBeInTheDocument();
  });

  it('shows an error callout when the architecture stage status cannot be found', () => {
    mockUseActiveSession.mockReturnValue(sessionWithArchitecture());
    mockSelectStageStatuses.mockReturnValue([]);
    renderWorkspace();
    expect(screen.getByText('Architecture stage unavailable')).toBeInTheDocument();
  });
});

describe('ArchitectureWorkspace - prerequisite gating', () => {
  it('disables the design action and surfaces the prerequisite message when the PRD is missing', () => {
    mockUseActiveSession.mockReturnValue(sessionWithArchitecture());
    mockSelectStageStatuses.mockReturnValue([fixtureStageStatus({ prerequisite: 'Generate the PRD before designing the solution.' })]);
    renderWorkspace();

    expect(screen.getByRole('button', { name: 'Design the solution' })).toBeDisabled();
    expect(screen.getAllByText('Generate the PRD before designing the solution.').length).toBeGreaterThan(0);
  });

  it('never shows a blank panel before the architecture has been generated', () => {
    mockUseActiveSession.mockReturnValue(sessionWithArchitecture());
    mockSelectStageStatuses.mockReturnValue([fixtureStageStatus()]);
    renderWorkspace();
    expect(screen.getByText(/Use "Design the solution" above to generate the architecture diagram/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Application components and cloud services' }));
    expect(screen.getByText('No architecture components yet')).toBeInTheDocument();
  });
});

describe('ArchitectureWorkspace - the transparent platform recommendation', () => {
  it('computes and shows the recommendation live from the reviewed scope, even before generation', () => {
    mockUseActiveSession.mockReturnValue(sessionWithArchitecture());
    mockSelectStageStatuses.mockReturnValue([fixtureStageStatus()]);
    renderWorkspace();

    expect(screen.getByText(/Microsoft Azure is recommended for the reviewed scope/)).toBeInTheDocument();
    expect(screen.getByText('AI-generated recommendation - validate before relying on it')).toBeInTheDocument();
    expect(screen.getAllByText(/TECH_01 states a direct preference for Microsoft Azure/).length).toBeGreaterThan(0);
  });

  it('selects a platform manually through the change-flow action', () => {
    mockUseActiveSession.mockReturnValue(sessionWithArchitecture());
    mockSelectStageStatuses.mockReturnValue([fixtureStageStatus()]);
    renderWorkspace();

    fireEvent.click(screen.getByRole('radio', { name: 'Amazon Web Services (AWS)' }));
    expect(actions.updateSolutionConfig).toHaveBeenCalledWith({ cloudPlatform: 'aws', cloudSelectionMode: 'user-selected' });
  });

  it('switches to "let the assistant recommend"', () => {
    mockUseActiveSession.mockReturnValue(sessionWithArchitecture());
    mockSelectStageStatuses.mockReturnValue([fixtureStageStatus()]);
    renderWorkspace();

    fireEvent.click(screen.getByRole('radio', { name: 'Let the assistant recommend' }));
    expect(actions.updateSolutionConfig).toHaveBeenCalledWith({ cloudSelectionMode: 'recommend' });
  });
});

describe('ArchitectureWorkspace - generation', () => {
  it('designs the solution when the prerequisite is met', () => {
    mockUseActiveSession.mockReturnValue(sessionWithArchitecture());
    mockSelectStageStatuses.mockReturnValue([fixtureStageStatus()]);
    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Design the solution' }));
    expect(actions.generateStage).toHaveBeenCalledWith('architecture');
  });

  it('shows the meta line, reviewed toggle and switches the label to Redesign once data exists', () => {
    const meta = fixtureGenerationMeta();
    mockUseActiveSession.mockReturnValue(sessionWithArchitecture({ data: fixtureArchitectureDesign(), status: 'current', meta }));
    mockSelectStageStatuses.mockReturnValue([fixtureStageStatus({ status: 'current' })]);
    renderWorkspace();

    expect(screen.getByRole('button', { name: 'Redesign the solution' })).toBeInTheDocument();
    expect(screen.getByText(/Generated by Mock Heuristic Engine \(Mock AI\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Mark as reviewed'));
    expect(actions.setStageReviewed).toHaveBeenCalledWith('architecture', true);
  });

  it('shows a stale banner with reasons and redesigns from its own action', () => {
    mockUseActiveSession.mockReturnValue(
      sessionWithArchitecture({ data: fixtureArchitectureDesign(), status: 'stale', meta: fixtureGenerationMeta(), staleReasons: ['Requirement FR_01 changed after this section was generated.'] }),
    );
    mockSelectStageStatuses.mockReturnValue([
      fixtureStageStatus({ status: 'stale', staleReasons: ['Requirement FR_01 changed after this section was generated.'] }),
    ]);
    renderWorkspace();

    const staleBanner = screen.getByText('This section is out of date').closest('div.stale-banner') as HTMLElement;
    expect(within(staleBanner).getByText('Requirement FR_01 changed after this section was generated.')).toBeInTheDocument();
    fireEvent.click(within(staleBanner).getByRole('button', { name: 'Redesign the solution' }));
    expect(actions.generateStage).toHaveBeenCalledWith('architecture');
  });
});

describe('ArchitectureWorkspace - tabs, diagram selection and navigation', () => {
  function renderWithData(navigate?: (workspace: string, focusId?: string) => void) {
    mockUseActiveSession.mockReturnValue(sessionWithArchitecture({ data: fixtureArchitectureDesign(), status: 'current', meta: fixtureGenerationMeta() }));
    mockSelectStageStatuses.mockReturnValue([fixtureStageStatus({ status: 'current' })]);
    return renderWorkspace(navigate);
  }

  it('shows the Architecture diagram tab by default', () => {
    renderWithData();
    expect(screen.getByRole('tab', { name: 'Architecture diagram', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Proposed solution architecture on Microsoft Azure/ })).toBeInTheDocument();
  });

  it('opens the component detail drawer when a diagram node is selected', () => {
    renderWithData();
    fireEvent.click(screen.getByRole('button', { name: /Primary Relational Database/ }));
    const drawer = screen.getByRole('dialog', { name: 'Primary Relational Database' });
    expect(within(drawer).getByText('Azure Database for PostgreSQL - Flexible Server')).toBeInTheDocument();
  });

  it('switches to the components tab, lists all 14 areas with counts and filters the grid', () => {
    renderWithData();
    fireEvent.click(screen.getByRole('tab', { name: 'Application components and cloud services' }));
    expect(screen.getByRole('button', { name: /Databases and storage/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /AI and machine-learning services/ })).toBeInTheDocument();
    expect(screen.getByText('API Layer')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^APIs/ }));
    expect(screen.getByText('API Layer')).toBeInTheDocument();
    expect(screen.queryByText('Primary Relational Database')).not.toBeInTheDocument();
  });

  it('switches to the security and deployment tab', () => {
    renderWithData();
    fireEvent.click(screen.getByRole('tab', { name: 'Security and deployment' }));
    expect(screen.getByText('Security controls')).toBeInTheDocument();
    expect(screen.getByText(/Microsoft Entra External ID enforces authentication/)).toBeInTheDocument();
  });

  it('switches to the requirement traceability tab and shows components without justification', () => {
    mockUseActiveSession.mockReturnValue(
      sessionWithArchitecture({
        data: fixtureArchitectureDesign({ components: [fixtureUnjustifiedComponent()] }),
        status: 'current',
        meta: fixtureGenerationMeta({
          issues: [{ severity: 'warning', code: 'unjustified-component', message: 'ARC_03 (Search Service) cites no requirement, security need or reviewed assumption.', refs: ['ARC_03'] }],
        }),
      }),
    );
    mockSelectStageStatuses.mockReturnValue([fixtureStageStatus({ status: 'current' })]);
    renderWorkspace();

    fireEvent.click(screen.getByRole('tab', { name: 'Requirement traceability' }));
    expect(screen.getByText('ARC_03 (Search Service) cites no requirement, security need or reviewed assumption.')).toBeInTheDocument();
  });

  it('navigates to the Customer Requirements Workspace when a requirement chip is clicked', () => {
    const navigate = vi.fn();
    renderWithData(navigate);
    fireEvent.click(screen.getByRole('tab', { name: 'Application components and cloud services' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'DATA_01' }).at(0) as HTMLElement);
    expect(navigate).toHaveBeenCalledWith('requirements', 'DATA_01');
  });

  it('does not render its own footer nav (the app shell renders it once, see WorkspaceContainer)', () => {
    renderWithData();
    expect(screen.queryByRole('navigation', { name: 'Workspace navigation' })).not.toBeInTheDocument();
  });
});
