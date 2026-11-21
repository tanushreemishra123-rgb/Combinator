/**
 * Behaviour tests for the Customer Requirements Workspace root: the no-session empty state, the
 * four spec-named step tabs, cross-workspace focus switching to "Review the extracted scope", and
 * the auto-advance to "Review the extracted scope" once "Run AI-assisted requirement analysis"
 * finishes with a new scope model. The workspace-to-workspace footer nav is rendered once, by the
 * app shell (see src/app/WorkspaceContainer.tsx), not by this workspace. The state layer is mocked
 * (fixed contract, see src/state/index.ts) so these tests never depend on another engineer's
 * in-progress use-case or selector bodies.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { NormalizedDocument } from '../../domain';
import { fixtureScope, fixtureSession } from '../../test/fixtures';
import { NavigationContext } from '../navigation';
import type { WorkspaceNavigation } from '../navigation';
import { RequirementsWorkspace } from './RequirementsWorkspace';

const {
  mockUseActiveSession,
  mockUseActions,
  mockUseAppState,
  mockUseBusy,
  mockSelectInputIssues,
  mockSelectNormalizedPreview,
  mockSelectHasOutputs,
} = vi.hoisted(() => ({
  mockUseActiveSession: vi.fn(),
  mockUseActions: vi.fn(),
  mockUseAppState: vi.fn(),
  mockUseBusy: vi.fn(),
  mockSelectInputIssues: vi.fn(),
  mockSelectNormalizedPreview: vi.fn(),
  mockSelectHasOutputs: vi.fn(),
}));

vi.mock('../../state', () => ({
  useActiveSession: mockUseActiveSession,
  useActions: mockUseActions,
  useAppState: mockUseAppState,
  useBusy: mockUseBusy,
  selectInputIssues: mockSelectInputIssues,
  selectNormalizedPreview: mockSelectNormalizedPreview,
  selectHasOutputs: mockSelectHasOutputs,
}));

const EMPTY_PREVIEW: NormalizedDocument = { text: '', lines: [], sections: [], wordCount: 0 };

const actions = {
  createNewSession: vi.fn(),
  createSessionFromScenario: vi.fn(),
  setCustomerContext: vi.fn(),
  setRequirementsText: vi.fn(),
  addUploadedFile: vi.fn(),
  runAnalysis: vi.fn(),
};

function renderWorkspace(navigationOverrides: Partial<WorkspaceNavigation> = {}) {
  const navigation: WorkspaceNavigation = { activeWorkspace: 'requirements', focusId: null, navigate: vi.fn(), clearFocus: vi.fn(), ...navigationOverrides };
  render(
    <NavigationContext.Provider value={navigation}>
      <RequirementsWorkspace />
    </NavigationContext.Provider>,
  );
  return navigation;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseActions.mockReturnValue(actions);
  mockUseAppState.mockReturnValue({ sessions: [], activeSessionId: null, aiSettings: { mode: 'mock', providerId: 'groq', model: 'm', apiKey: '' }, busy: null, notices: [] });
  mockUseBusy.mockReturnValue(null);
  mockSelectInputIssues.mockReturnValue([]);
  mockSelectNormalizedPreview.mockReturnValue(EMPTY_PREVIEW);
  mockSelectHasOutputs.mockReturnValue(false);
});

describe('RequirementsWorkspace - no active session', () => {
  it('shows the no-session empty state instead of a blank panel', () => {
    mockUseActiveSession.mockReturnValue(null);
    renderWorkspace();
    expect(screen.getByText('No scoping session selected')).toBeInTheDocument();
  });

  it('starts a blank session from the empty state', () => {
    mockUseActiveSession.mockReturnValue(null);
    renderWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Start a blank session' }));
    expect(actions.createNewSession).toHaveBeenCalledWith('New scoping session');
  });

  it('loads a seed scenario from the empty state picker', () => {
    mockUseActiveSession.mockReturnValue(null);
    renderWorkspace();
    fireEvent.click(screen.getAllByRole('button', { name: 'Load scenario' }).at(0) as HTMLElement);
    expect(actions.createSessionFromScenario).toHaveBeenCalled();
  });
});

describe('RequirementsWorkspace - with an active session', () => {
  it('opens on "Understand the customer need" while the session has no scope model yet', () => {
    mockUseActiveSession.mockReturnValue({ ...fixtureSession(), scope: null });
    renderWorkspace();
    expect(screen.getByRole('tab', { name: 'Understand the customer need', selected: true })).toBeInTheDocument();
    expect(screen.getByText('Customer and opportunity context')).toBeInTheDocument();
  });

  it('opens on "Review the extracted scope" once a scope model exists, so returning or reloading never drops back to the raw input', () => {
    mockUseActiveSession.mockReturnValue(fixtureSession());
    renderWorkspace();
    expect(screen.getByRole('tab', { name: 'Review the extracted scope', selected: true })).toBeInTheDocument();
    expect(screen.getByText('Extracted scope summary')).toBeInTheDocument();
  });

  it('switches to "Review the extracted scope" when that tab is clicked', () => {
    mockUseActiveSession.mockReturnValue(fixtureSession());
    renderWorkspace();
    fireEvent.click(screen.getByRole('tab', { name: 'Review the extracted scope' }));
    expect(screen.getByText('Extracted scope summary')).toBeInTheDocument();
  });

  it('opens a newly selected step at the top instead of keeping the previous step\'s scroll offset', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    mockUseActiveSession.mockReturnValue(fixtureSession());
    renderWorkspace();
    expect(scrollTo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Clarify missing information' }));
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockRestore();
  });

  it('switches to "Clarify missing information" when that tab is clicked', () => {
    mockUseActiveSession.mockReturnValue(fixtureSession());
    renderWorkspace();
    fireEvent.click(screen.getByRole('tab', { name: 'Clarify missing information' }));
    expect(screen.getByText('Missing information')).toBeInTheDocument();
  });

  it('switches to "Approve the requirements" when that tab is clicked', () => {
    mockUseActiveSession.mockReturnValue(fixtureSession());
    renderWorkspace();
    fireEvent.click(screen.getByRole('tab', { name: 'Approve the requirements' }));
    expect(screen.getByText('Approval status')).toBeInTheDocument();
  });

  it('jumps straight to "Review the extracted scope" when a cross-workspace focus id is pending', () => {
    mockUseActiveSession.mockReturnValue(fixtureSession());
    renderWorkspace({ focusId: 'FR_01' });
    expect(screen.getByRole('tab', { name: 'Review the extracted scope', selected: true })).toBeInTheDocument();
  });

  it('does not render its own footer nav (the app shell renders it once, see WorkspaceContainer)', () => {
    mockUseActiveSession.mockReturnValue(fixtureSession());
    renderWorkspace();
    expect(screen.queryByRole('navigation', { name: 'Workspace navigation' })).not.toBeInTheDocument();
  });
});

describe('RequirementsWorkspace - auto-advance after analysis', () => {
  const navigation: WorkspaceNavigation = { activeWorkspace: 'requirements', focusId: null, navigate: vi.fn(), clearFocus: vi.fn() };

  function tree(): ReactElement {
    return (
      <NavigationContext.Provider value={navigation}>
        <RequirementsWorkspace />
      </NavigationContext.Provider>
    );
  }

  it('switches to "Review the extracted scope" once analysis finishes with a new scope model', () => {
    const before = { ...fixtureSession(), scope: null };
    mockUseActiveSession.mockReturnValue(before);
    mockUseBusy.mockReturnValue(null);
    const { rerender } = render(tree());
    expect(screen.getByRole('tab', { name: 'Understand the customer need', selected: true })).toBeInTheDocument();

    mockUseBusy.mockReturnValue({ label: 'Analyzing the customer requirements...', stageId: 'analysis' });
    rerender(tree());

    mockUseActiveSession.mockReturnValue({ ...before, scope: fixtureScope() });
    mockUseBusy.mockReturnValue(null);
    rerender(tree());

    expect(screen.getByRole('tab', { name: 'Review the extracted scope', selected: true })).toBeInTheDocument();
  });

  it('does not switch tabs when analysis finishes without producing a new scope model (a failed run)', () => {
    const session = { ...fixtureSession(), scope: null };
    mockUseActiveSession.mockReturnValue(session);
    mockUseBusy.mockReturnValue(null);
    const { rerender } = render(tree());

    mockUseBusy.mockReturnValue({ label: 'Analyzing the customer requirements...', stageId: 'analysis' });
    rerender(tree());

    // Same session/scope reference: the run failed validation and nothing was saved.
    mockUseBusy.mockReturnValue(null);
    rerender(tree());

    expect(screen.getByRole('tab', { name: 'Understand the customer need', selected: true })).toBeInTheDocument();
  });

  it('does not switch tabs for an ordinary re-render where the scope changes without an analysis run', () => {
    const before = { ...fixtureSession(), scope: null };
    mockUseActiveSession.mockReturnValue(before);
    mockUseBusy.mockReturnValue(null);
    const { rerender } = render(tree());

    // Scope goes from null to a real model, but busy never transitioned through the analysis stage.
    mockUseActiveSession.mockReturnValue({ ...before, scope: fixtureScope() });
    rerender(tree());

    expect(screen.getByRole('tab', { name: 'Understand the customer need', selected: true })).toBeInTheDocument();
  });

  it('does not yank the user back to "Review the extracted scope" on a later, unrelated re-render', () => {
    const before = { ...fixtureSession(), scope: null };
    mockUseActiveSession.mockReturnValue(before);
    mockUseBusy.mockReturnValue(null);
    const { rerender } = render(tree());

    mockUseBusy.mockReturnValue({ label: 'Analyzing the customer requirements...', stageId: 'analysis' });
    rerender(tree());
    const after = { ...before, scope: fixtureScope() };
    mockUseActiveSession.mockReturnValue(after);
    mockUseBusy.mockReturnValue(null);
    rerender(tree());
    expect(screen.getByRole('tab', { name: 'Review the extracted scope', selected: true })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Understand the customer need' }));
    expect(screen.getByRole('tab', { name: 'Understand the customer need', selected: true })).toBeInTheDocument();

    // An unrelated re-render (e.g. a prop that never changed) must not force the tab back to review.
    rerender(tree());
    expect(screen.getByRole('tab', { name: 'Understand the customer need', selected: true })).toBeInTheDocument();
  });

  it('does not force the tab to review when the user already navigated away before analysis finished', () => {
    const before = { ...fixtureSession(), scope: null };
    mockUseActiveSession.mockReturnValue(before);
    mockUseBusy.mockReturnValue(null);
    const { rerender } = render(tree());

    mockUseBusy.mockReturnValue({ label: 'Analyzing the customer requirements...', stageId: 'analysis' });
    rerender(tree());

    fireEvent.click(screen.getByRole('tab', { name: 'Clarify missing information' }));

    mockUseActiveSession.mockReturnValue({ ...before, scope: fixtureScope() });
    mockUseBusy.mockReturnValue(null);
    rerender(tree());

    expect(screen.getByRole('tab', { name: 'Clarify missing information', selected: true })).toBeInTheDocument();
  });
});
