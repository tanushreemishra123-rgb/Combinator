/**
 * End-to-end behaviour tests for the app-wiring root: the welcome screen and its seed scenarios,
 * the shell that appears once a session exists, sidebar navigation driving the hash router, the
 * AI-mode badge, the guided-demo shortcut, notices, the sessions/AI-settings dialogs and the
 * crash-recovery screen. The state layer is mocked (fixed contract, see src/state/index.ts) and
 * the six workspace components are replaced with sentinels so this suite exercises only the
 * wiring this folder owns, never another workspace's implementation.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { defaultAiSettings } from '../ai';
import type * as StateModule from '../state';
import type { AppState } from '../state';
import { SEED_SCENARIOS } from '../seed';
import { fixtureSession } from '../test/fixtures';
import { App } from './App';

const {
  mockUseActions,
  mockUseActiveSession,
  mockUseAppState,
  mockUseBusy,
  passthroughProvider,
  mockRequirementsWorkspace,
  mockPrdWorkspace,
  mockArchitectureWorkspace,
  mockStrategyWorkspace,
  mockEstimateWorkspace,
  mockPackageWorkspace,
} = vi.hoisted(() => ({
  mockUseActions: vi.fn(),
  mockUseActiveSession: vi.fn(),
  mockUseAppState: vi.fn(),
  mockUseBusy: vi.fn(),
  // A React function component may return any ReactNode directly, so a bare children pass-through
  // needs no JSX (and therefore no ordering dependency on the JSX runtime being loaded yet).
  passthroughProvider: (props: { children: unknown }) => props.children,
  mockRequirementsWorkspace: vi.fn(() => 'Requirements Workspace Stub'),
  mockPrdWorkspace: vi.fn(() => 'PRD Workspace Stub'),
  mockArchitectureWorkspace: vi.fn(() => 'Architecture Workspace Stub'),
  mockStrategyWorkspace: vi.fn(() => 'Strategy Workspace Stub'),
  mockEstimateWorkspace: vi.fn(() => 'Estimate Workspace Stub'),
  mockPackageWorkspace: vi.fn(() => 'Package Workspace Stub'),
}));

// Only the four hooks + AppProvider are replaced; every selector (selectJourney, stagePrerequisite,
// ...) stays real so the sidebar and header render a genuine, deterministic view of the fixture
// session instead of a hand-rolled stand-in for logic another engineer owns.
vi.mock('../state', async (importOriginal) => {
  const actual = await importOriginal<typeof StateModule>();
  return {
    ...actual,
    AppProvider: passthroughProvider,
    useActions: mockUseActions,
    useActiveSession: mockUseActiveSession,
    useAppState: mockUseAppState,
    useBusy: mockUseBusy,
  };
});

vi.mock('../ui/requirements', () => ({ RequirementsWorkspace: mockRequirementsWorkspace }));
vi.mock('../ui/prd', () => ({ PrdWorkspace: mockPrdWorkspace }));
vi.mock('../ui/architecture', () => ({ ArchitectureWorkspace: mockArchitectureWorkspace }));
vi.mock('../ui/strategy', () => ({ StrategyWorkspace: mockStrategyWorkspace }));
vi.mock('../ui/estimate', () => ({ EstimateWorkspace: mockEstimateWorkspace }));
vi.mock('../ui/package', () => ({ PackageWorkspace: mockPackageWorkspace }));

function createActions() {
  return {
    createNewSession: vi.fn(),
    createSessionFromScenario: vi.fn(),
    renameSession: vi.fn(),
    selectSession: vi.fn(),
    deleteSession: vi.fn(),
    deleteAllData: vi.fn(),
    importSession: vi.fn(),
    exportWorkspace: vi.fn(),
    setRequirementsText: vi.fn(),
    setCustomerContext: vi.fn(),
    addUploadedFile: vi.fn(),
    runAnalysis: vi.fn(),
    editScopeItem: vi.fn(),
    addScopeItem: vi.fn(),
    removeScopeItem: vi.fn(),
    setItemReview: vi.fn(),
    approveAllPending: vi.fn(),
    resolveScopeItem: vi.fn(),
    reopenScopeItem: vi.fn(),
    approveScope: vi.fn(),
    updateSolutionConfig: vi.fn(),
    updateEstimationConfig: vi.fn(),
    setRoleRate: vi.fn(),
    applyCommercialPreset: vi.fn(),
    setDriverComplexity: vi.fn(),
    previewChange: vi.fn(),
    applyChange: vi.fn(),
    generateStage: vi.fn(),
    generateAll: vi.fn(),
    regenerateStale: vi.fn(),
    setStageReviewed: vi.fn(),
    runQuality: vi.fn(),
    refreshExecutiveSummary: vi.fn(),
    exportPackage: vi.fn(),
    updateAiSettings: vi.fn(),
    runConnectionTest: vi.fn().mockResolvedValue({ ok: true, message: 'Connected.' }),
    dismissNotice: vi.fn(),
    clearNotices: vi.fn(),
  };
}

function appState(overrides: Partial<AppState> = {}): AppState {
  return { sessions: [], activeSessionId: null, aiSettings: defaultAiSettings(), busy: null, notices: [], ...overrides };
}

function resetHash(): void {
  window.history.replaceState(null, '', window.location.pathname);
}

let actions: ReturnType<typeof createActions>;

beforeEach(() => {
  vi.clearAllMocks();
  actions = createActions();
  mockUseActions.mockReturnValue(actions);
  mockUseAppState.mockReturnValue(appState());
  mockUseBusy.mockReturnValue(null);
  mockUseActiveSession.mockReturnValue(null);
  resetHash();
});

afterEach(() => {
  resetHash();
});

describe('App - welcome screen (no active session)', () => {
  it('renders the welcome screen with all four seed scenarios and no shell chrome', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'AI Deal Scoping Assistant' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Use this scenario' })).toHaveLength(4);
    expect(screen.getByText('Mock AI mode is on by default')).toBeInTheDocument();
    expect(screen.getByText('Your data stays in this browser')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Workspaces' })).not.toBeInTheDocument();
  });

  it('starting a seed scenario lands on the Customer Requirements Workspace', () => {
    const { rerender } = render(<App />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Use this scenario' }).at(0) as HTMLElement);
    expect(actions.createSessionFromScenario).toHaveBeenCalledWith(SEED_SCENARIOS.at(0)?.id);

    // The real state layer would make the new session active; simulate that and re-render.
    mockUseActiveSession.mockReturnValue(fixtureSession());
    rerender(<App />);

    expect(screen.queryByText('Start with a sample scenario')).not.toBeInTheDocument();
    expect(screen.getByText('Requirements Workspace Stub')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Workspaces' })).toBeInTheDocument();
  });

  it('opens a new session on the first journey step even when the address still points at another workspace', () => {
    window.history.replaceState(null, '', `${window.location.pathname}#/estimate`);
    const { rerender } = render(<App />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Use this scenario' }).at(0) as HTMLElement);
    mockUseActiveSession.mockReturnValue(fixtureSession());
    rerender(<App />);

    expect(window.location.hash).toBe('#/requirements');
    expect(screen.getByText('Requirements Workspace Stub')).toBeInTheDocument();
  });

  it('starts a blank scoping session from the welcome screen', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Start a blank scoping session' }));
    expect(actions.createNewSession).toHaveBeenCalledWith('Untitled scoping session');
  });
});

describe('App - shell with an active session', () => {
  beforeEach(() => {
    mockUseActiveSession.mockReturnValue(fixtureSession());
  });

  it('shows the Mock AI mode badge by default', () => {
    render(<App />);
    expect(screen.getByText('Mock AI mode')).toBeInTheDocument();
  });

  it('renders the Customer Requirements Workspace by default and updates the document title', () => {
    render(<App />);
    expect(screen.getByText('Requirements Workspace Stub')).toBeInTheDocument();
    expect(document.title).toBe('Customer Requirements Workspace · AI Deal Scoping Assistant');
  });

  it('navigating via the sidebar updates the hash, swaps the workspace and the document title', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /Estimate Workspace/ }));

    expect(window.location.hash).toBe('#/estimate');
    expect(screen.getByText('Estimate Workspace Stub')).toBeInTheDocument();
    expect(screen.queryByText('Requirements Workspace Stub')).not.toBeInTheDocument();
    expect(document.title).toBe('Estimate Workspace · AI Deal Scoping Assistant');
  });

  it('runs the guided demo (generateAll) once the scope is approved', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Generate full package' }));
    expect(actions.generateAll).toHaveBeenCalledTimes(1);
  });

  it('disables the guided demo with the prerequisite reason before the scope is approved', () => {
    mockUseActiveSession.mockReturnValue({ ...fixtureSession(), scope: null });
    render(<App />);

    expect(screen.getByRole('button', { name: 'Generate full package' })).toBeDisabled();
    expect(screen.getByText('Approve the requirements before generating deliverables.')).toBeInTheDocument();
    expect(actions.generateAll).not.toHaveBeenCalled();
  });

  it('shows a notice from state and dismisses it through the use case', () => {
    mockUseAppState.mockReturnValue(appState({ notices: [{ id: 'n1', tone: 'error', title: 'Export failed', message: 'Could not save.' }] }));
    render(<App />);

    expect(screen.getByText('Export failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(actions.dismissNotice).toHaveBeenCalledWith('n1');
  });

  it('shows the busy indicator while an async use case is running', () => {
    mockUseBusy.mockReturnValue({ label: 'Generating the PRD...', stageId: 'prd' });
    render(<App />);
    expect(screen.getAllByText('Generating the PRD...').length).toBeGreaterThan(0);
  });

  it('opens the sessions dialog from the header', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    expect(screen.getByRole('dialog', { name: 'Sessions' })).toBeInTheDocument();
  });

  it('opens the AI settings dialog and saves a change through the use case', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'AI settings' }));
    expect(screen.getByRole('dialog', { name: 'AI settings' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(actions.updateAiSettings).toHaveBeenCalledWith(expect.objectContaining({ mode: 'live' }));
  });

  it('shows the crash-recovery screen when a workspace throws, and returns to the welcome screen', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // React silently retries a failed render once before giving up to the boundary, so the stub
    // must keep throwing until the assertions below are done, not just for a single call.
    mockRequirementsWorkspace.mockImplementation(() => {
      throw new Error('boom');
    });

    try {
      render(<App />);

      expect(screen.getByText('Something went wrong in this workspace')).toBeInTheDocument();
      expect(screen.getByText('Mock AI mode')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Export workspace JSON' }));
      expect(actions.exportWorkspace).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: 'Return to welcome screen' }));
      expect(actions.selectSession).toHaveBeenCalledWith(null);
    } finally {
      mockRequirementsWorkspace.mockImplementation(() => 'Requirements Workspace Stub');
      consoleError.mockRestore();
    }
  });
});
