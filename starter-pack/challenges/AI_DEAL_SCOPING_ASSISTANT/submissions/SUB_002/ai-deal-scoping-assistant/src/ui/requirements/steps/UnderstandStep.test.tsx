/**
 * Behaviour tests for step 1, "Understand the customer need": the customer/opportunity context
 * form, the seed scenario picker, requirements text entry, file upload and the gated primary
 * "Run AI-assisted requirement analysis" action (spec "Functional Requirements 1").
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { ValidationIssue } from '../../../domain';
import { fixtureDocument, fixtureSession } from '../../../test/fixtures';
import { UnderstandStep } from './UnderstandStep';

const { mockUseActions, mockUseAppState, mockUseBusy, mockSelectInputIssues, mockSelectNormalizedPreview } = vi.hoisted(() => ({
  mockUseActions: vi.fn(),
  mockUseAppState: vi.fn(),
  mockUseBusy: vi.fn(),
  mockSelectInputIssues: vi.fn(),
  mockSelectNormalizedPreview: vi.fn(),
}));

vi.mock('../../../state', () => ({
  useActions: mockUseActions,
  useAppState: mockUseAppState,
  useBusy: mockUseBusy,
  selectInputIssues: mockSelectInputIssues,
  selectNormalizedPreview: mockSelectNormalizedPreview,
}));

const actions = {
  setCustomerContext: vi.fn(),
  setRequirementsText: vi.fn(),
  createSessionFromScenario: vi.fn(),
  addUploadedFile: vi.fn().mockResolvedValue(undefined),
  runAnalysis: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseActions.mockReturnValue(actions);
  mockUseAppState.mockReturnValue({ aiSettings: { mode: 'mock', providerId: 'groq', model: 'm', apiKey: '' } });
  mockUseBusy.mockReturnValue(null);
  mockSelectInputIssues.mockReturnValue([]);
  mockSelectNormalizedPreview.mockReturnValue(fixtureDocument());
});

describe('UnderstandStep - customer context and scenarios', () => {
  it('shows the customer and opportunity context already on the session', () => {
    render(<UnderstandStep session={fixtureSession()} />);
    expect(screen.getByDisplayValue('Northwind Mutual')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Insurance')).toBeInTheDocument();
  });

  it('reports a customer field edit through setCustomerContext', () => {
    render(<UnderstandStep session={fixtureSession()} />);
    fireEvent.change(screen.getByDisplayValue('Northwind Mutual'), { target: { value: 'Contoso Health' } });
    expect(actions.setCustomerContext).toHaveBeenCalledWith({ customerName: 'Contoso Health' });
  });

  it('loads a seed scenario when its card button is used', () => {
    render(<UnderstandStep session={fixtureSession()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Load scenario' }).at(0) as HTMLElement);
    expect(actions.createSessionFromScenario).toHaveBeenCalled();
  });
});

describe('UnderstandStep - requirements input and analysis gating', () => {
  it('keeps "Mock AI mode" visible and explains the analysis path before running it', () => {
    render(<UnderstandStep session={fixtureSession()} />);
    expect(screen.getByText('Mock AI mode')).toBeInTheDocument();
  });

  it('reports a text edit through setRequirementsText', () => {
    render(<UnderstandStep session={fixtureSession()} />);
    const textarea = screen.getByPlaceholderText(/Paste the customer's requirements/);
    fireEvent.change(textarea, { target: { value: 'New requirements text' } });
    expect(actions.setRequirementsText).toHaveBeenCalledWith('New requirements text');
  });

  it('disables the analysis action and explains why when the input has a blocking issue', () => {
    const issue: ValidationIssue = { severity: 'error', code: 'too-short', message: 'Add more detail before running the analysis.', refs: [] };
    mockSelectInputIssues.mockReturnValue([issue]);
    render(<UnderstandStep session={fixtureSession()} />);
    expect(screen.getAllByText('Add more detail before running the analysis.').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Run AI-assisted requirement analysis' })).toBeDisabled();
  });

  it('runs the analysis straight away when no scope has been extracted yet', () => {
    render(<UnderstandStep session={{ ...fixtureSession(), scope: null }} />);
    const button = screen.getByRole('button', { name: 'Run AI-assisted requirement analysis' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(actions.runAnalysis).toHaveBeenCalled();
  });

  it('asks before a new analysis replaces an existing reviewed scope', () => {
    render(<UnderstandStep session={fixtureSession()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run AI-assisted requirement analysis' }));
    expect(actions.runAnalysis).not.toHaveBeenCalled();
    expect(screen.getByText('Replace the reviewed scope?')).toBeInTheDocument();
    expect(screen.getByText('The reviewed scope is at version 1, approved, with 0 edited items.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep the current scope' }));
    expect(actions.runAnalysis).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Run AI-assisted requirement analysis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Run the analysis again' }));
    expect(actions.runAnalysis).toHaveBeenCalledTimes(1);
  });

  it('shows a busy state while the analysis runs', () => {
    mockUseBusy.mockReturnValue({ label: 'Analyzing requirements...', stageId: null });
    render(<UnderstandStep session={fixtureSession()} />);
    expect(screen.getByRole('button', { name: /Run AI-assisted requirement analysis/ })).toBeDisabled();
  });

  it('uploads a supported file dropped or chosen in the upload zone', async () => {
    render(<UnderstandStep session={fixtureSession()} />);
    const input = screen.getByLabelText('Upload a requirements document');
    const file = new File(['Some discovery notes.'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(actions.addUploadedFile).toHaveBeenCalledWith(file);
  });

  it('rejects an unsupported file extension before it reaches the upload action', () => {
    render(<UnderstandStep session={fixtureSession()} />);
    const input = screen.getByLabelText('Upload a requirements document');
    const file = new File(['binary'], 'diagram.exe', { type: 'application/octet-stream' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(actions.addUploadedFile).not.toHaveBeenCalled();
    expect(screen.getByText(/is not a supported format/)).toBeInTheDocument();
  });

  it('shows every already-uploaded document', () => {
    const session = fixtureSession();
    session.input.documents.push({ name: 'discovery-call.pdf', format: 'pdf', characters: 4200, addedAt: '2026-09-01T00:00:00.000Z' });
    render(<UnderstandStep session={session} />);
    expect(screen.getByText('discovery-call.pdf')).toBeInTheDocument();
  });
});
