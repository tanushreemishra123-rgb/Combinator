import { fireEvent, render, screen } from '@testing-library/react';
import type { PackageDocument, QualityReport } from '../../../domain';
import { EXPORT_DISCLAIMER } from '../../../domain';
import { fixtureSession } from '../../../test/fixtures';
import { buildPackageDiagrams } from '../../../export';
import { buildPackageForSession, selectHasOutputs, useActions, useAppState, useBusy } from '../../../state';
import { createActionsMock, createAppStateMock } from '../testSupport';
import { PackagePreviewTab } from './PackagePreviewTab';

vi.mock('../../../state', () => ({
  useActions: vi.fn(),
  useAppState: vi.fn(),
  useBusy: vi.fn(),
  selectHasOutputs: vi.fn(),
  buildPackageForSession: vi.fn(),
}));

vi.mock('../../../export', () => ({
  buildPackageDiagrams: vi.fn(),
}));

const mockedUseActions = vi.mocked(useActions);
const mockedUseAppState = vi.mocked(useAppState);
const mockedUseBusy = vi.mocked(useBusy);
const mockedSelectHasOutputs = vi.mocked(selectHasOutputs);
const mockedBuildPackageForSession = vi.mocked(buildPackageForSession);
const mockedBuildPackageDiagrams = vi.mocked(buildPackageDiagrams);

const DOCUMENT: PackageDocument = {
  title: 'Member Portal Modernisation - Integrated Scoping Package',
  subtitle: 'Northwind Mutual',
  generatedAt: '2026-09-19T00:00:00.000Z',
  aiModeLabel: 'Mock AI mode',
  exportStatus: 'Review Required',
  disclaimer: EXPORT_DISCLAIMER,
  sections: [
    { id: 'executive-summary', title: 'Executive Summary', blocks: [{ type: 'paragraph', text: 'A short summary of the opportunity.' }] },
    { id: 'architecture-diagram', title: 'Architecture Diagram', blocks: [{ type: 'diagram', title: 'Solution architecture', mermaid: 'graph TD; A-->B;', diagramId: 'architecture' }] },
  ],
};

const QUALITY: QualityReport = {
  ranAt: '2026-09-19T00:00:00.000Z',
  scopeVersion: 1,
  checks: [{ id: 'unresolved-questions', label: 'Unresolved questions', description: 'Every clarification question should be resolved.', status: 'fail', count: 2, findings: [] }],
  summary: {
    requirementCoveragePct: 80,
    uncoveredRequirements: 1,
    unresolvedQuestions: 2,
    unsupportedRecommendations: 0,
    estimationGaps: 0,
    inconsistencies: 0,
    humanValidationItems: 0,
    estimateConfidence: 'Low',
    exportStatus: 'Blocked',
  },
};

function setUpDefaults(): ReturnType<typeof createActionsMock> {
  const actions = createActionsMock();
  mockedUseActions.mockReturnValue(actions);
  mockedUseAppState.mockReturnValue(createAppStateMock());
  mockedUseBusy.mockReturnValue(null);
  mockedSelectHasOutputs.mockReturnValue(false);
  mockedBuildPackageForSession.mockReturnValue(DOCUMENT);
  mockedBuildPackageDiagrams.mockReturnValue(new Map());
  return actions;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PackagePreviewTab', () => {
  it('always shows the mandatory disclaimer', () => {
    setUpDefaults();
    render(<PackagePreviewTab session={fixtureSession()} onOpenQualityTab={vi.fn()} />);
    expect(screen.getByText(EXPORT_DISCLAIMER)).toBeInTheDocument();
  });

  it('notes that nothing has been generated yet when the session has no outputs', () => {
    setUpDefaults();
    render(<PackagePreviewTab session={fixtureSession()} onOpenQualityTab={vi.fn()} />);
    expect(screen.getByText('No deliverables generated yet')).toBeInTheDocument();
  });

  it('hides the no-deliverables notice once something has been generated', () => {
    setUpDefaults();
    mockedSelectHasOutputs.mockReturnValue(true);
    render(<PackagePreviewTab session={fixtureSession()} onOpenQualityTab={vi.fn()} />);
    expect(screen.queryByText('No deliverables generated yet')).not.toBeInTheDocument();
  });

  it('explains that exporting will run the quality gate automatically when it has never run', () => {
    setUpDefaults();
    render(<PackagePreviewTab session={fixtureSession()} onOpenQualityTab={vi.fn()} />);
    expect(screen.getByText('The pre-export quality check has not run yet')).toBeInTheDocument();
  });

  it('explains what to fix but still allows a draft export when the gate blocks it', () => {
    setUpDefaults();
    const session = { ...fixtureSession(), quality: QUALITY };
    render(<PackagePreviewTab session={session} onOpenQualityTab={vi.fn()} />);
    expect(screen.getByText('Blocked - 1 check(s) failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export Markdown' })).toBeEnabled();
  });

  it('opens the Quality Gate tab from the status banner', () => {
    setUpDefaults();
    const onOpenQualityTab = vi.fn();
    const session = { ...fixtureSession(), quality: QUALITY };
    render(<PackagePreviewTab session={session} onOpenQualityTab={onOpenQualityTab} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fix the failing checks' }));
    expect(onOpenQualityTab).toHaveBeenCalledTimes(1);
  });

  it('renders the section outline and the document preview from the same package document', () => {
    setUpDefaults();
    render(<PackagePreviewTab session={fixtureSession()} onOpenQualityTab={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Executive Summary' })).toBeInTheDocument();
    expect(screen.getByText('A short summary of the opportunity.')).toBeInTheDocument();
  });

  it('falls back to a plain message for a diagram block with no model yet', () => {
    setUpDefaults();
    render(<PackagePreviewTab session={fixtureSession()} onOpenQualityTab={vi.fn()} />);
    expect(screen.getByText('Solution architecture (not generated yet)')).toBeInTheDocument();
  });

  it('exports the requested format through the state action', async () => {
    const actions = setUpDefaults();
    render(<PackagePreviewTab session={fixtureSession()} onOpenQualityTab={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export Markdown' }));
    expect(actions.exportPackage).toHaveBeenCalledWith('markdown');
    await screen.findByRole('button', { name: 'Export Markdown' });
  });
});
