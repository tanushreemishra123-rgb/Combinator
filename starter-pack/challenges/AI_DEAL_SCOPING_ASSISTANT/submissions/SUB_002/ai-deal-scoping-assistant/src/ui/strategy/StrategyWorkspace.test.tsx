/**
 * Root-level behaviour: the workspace shows its own empty state when there is no active session,
 * and otherwise delegates to StrategyContent. The state layer is mocked (fixed contract, see
 * src/state/index.ts) so this never depends on another engineer's in-progress use-case bodies.
 */
import { render, screen } from '@testing-library/react';
import { fixtureSession } from '../../test/fixtures';
import { StrategyWorkspace } from './StrategyWorkspace';

const { mockUseActiveSession, mockUseActions, mockUseBusy, mockStagePrerequisite } = vi.hoisted(() => ({
  mockUseActiveSession: vi.fn(),
  mockUseActions: vi.fn(),
  mockUseBusy: vi.fn(),
  mockStagePrerequisite: vi.fn(),
}));

vi.mock('../../state', () => ({
  useActiveSession: mockUseActiveSession,
  useActions: mockUseActions,
  useBusy: mockUseBusy,
  stagePrerequisite: mockStagePrerequisite,
}));

vi.mock('../diagram', () => ({ DiagramView: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
  mockUseActions.mockReturnValue({ generateStage: vi.fn(), setStageReviewed: vi.fn(), updateSolutionConfig: vi.fn() });
  mockUseBusy.mockReturnValue(null);
  mockStagePrerequisite.mockReturnValue(null);
});

it('shows the no-active-session empty state and never renders a blank panel', () => {
  mockUseActiveSession.mockReturnValue(null);
  render(<StrategyWorkspace />);

  expect(screen.getByText('Data, Integration, and AI Workspace')).toBeInTheDocument();
  expect(screen.getByText('No active session')).toBeInTheDocument();
  expect(
    screen.getByText('Create or open a scoping session from the sidebar to plan the data, integration and AI solution strategy.'),
  ).toBeInTheDocument();
});

it('renders the full workspace content once a session is active', () => {
  mockUseActiveSession.mockReturnValue(fixtureSession());
  render(<StrategyWorkspace />);

  expect(screen.getByRole('tab', { name: 'Data strategy' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Plan the data flow/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Select the AI approach/ })).toBeInTheDocument();
});
