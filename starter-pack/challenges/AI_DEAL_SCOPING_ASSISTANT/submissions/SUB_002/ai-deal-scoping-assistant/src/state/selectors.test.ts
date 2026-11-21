import { defaultAiSettings } from '../ai';
import type { ScopingSession } from '../domain';
import { approveAllPending, approveScope, setItemReview } from '../scope';
import { applicationModernizationScenario } from '../seed';
import { fixtureSession, FIXTURE_NOW } from '../test/fixtures';
import { runFullPipeline } from '../test/pipelineHarness';
import {
  APPROVAL_PREREQUISITE,
  buildPackageForSession,
  selectCoverage,
  selectHasOutputs,
  selectInputIssues,
  selectIsQualityReportOutdated,
  selectJourney,
  selectNormalizedPreview,
  selectPendingActions,
  selectStageStatuses,
  stagePrerequisite,
} from './selectors';

function approvedFixture(): ScopingSession {
  const session = fixtureSession();
  if (session.scope === null) {
    throw new Error('fixture session must carry a scope');
  }
  return { ...session, scope: approveScope(approveAllPending(session.scope), FIXTURE_NOW) };
}

function statusOf(session: ScopingSession | null, stepId: string): string | undefined {
  return selectJourney(session).find((step) => step.id === stepId)?.status;
}

let generated: ScopingSession;

beforeAll(async () => {
  generated = await runFullPipeline(applicationModernizationScenario);
});

describe('stagePrerequisite', () => {
  it('requires an approved scope before any stage', () => {
    const unapproved = fixtureSession();
    const pending = { ...unapproved, scope: unapproved.scope === null ? null : { ...unapproved.scope, approvedVersion: null, approvedAt: null } };
    expect(stagePrerequisite(pending, 'prd')).toBe('Approve the requirements before generating deliverables.');
    expect(stagePrerequisite({ ...pending, scope: null }, 'estimate')).toBe(APPROVAL_PREREQUISITE);
  });

  it('lets the PRD run once the scope is approved and names the missing upstream deliverable otherwise', () => {
    const session = approvedFixture();
    expect(stagePrerequisite(session, 'prd')).toBeNull();
    expect(stagePrerequisite(session, 'architecture')).toBe('Generate the PRD before designing the solution.');
    expect(stagePrerequisite(session, 'dataIntegration')).toBe('Generate the solution architecture before planning the data flow.');
    expect(stagePrerequisite(session, 'aiStrategy')).toBe('Generate the solution architecture before selecting the AI approach.');
    expect(stagePrerequisite(session, 'estimate')).toBe(
      'Generate the PRD, the solution architecture, the data and integration strategy and the AI solution approach before estimating the delivery.',
    );
  });

  it('only lists what is still missing for the estimate', () => {
    const partial: ScopingSession = { ...generated, outputs: { ...generated.outputs, aiStrategy: { ...generated.outputs.aiStrategy, data: null, status: 'empty' } } };
    expect(stagePrerequisite(partial, 'estimate')).toBe('Generate the AI solution approach before estimating the delivery.');
    expect(stagePrerequisite(generated, 'estimate')).toBeNull();
  });
});

describe('stage and output selectors', () => {
  it('reports every stage in pipeline order with its prerequisite', () => {
    const views = selectStageStatuses(approvedFixture());
    expect(views.map((view) => view.stageId)).toEqual(['prd', 'architecture', 'dataIntegration', 'aiStrategy', 'estimate']);
    expect(views.at(0)).toMatchObject({ status: 'empty', reviewed: false, prerequisite: null, label: 'PRD and functional scope' });
    expect(views.at(1)?.prerequisite).toContain('Generate the PRD');
  });

  it('knows when any deliverable exists', () => {
    expect(selectHasOutputs(fixtureSession())).toBe(false);
    expect(selectHasOutputs(generated)).toBe(true);
  });

  it('derives coverage, pending actions, the input preview and input issues from the session', () => {
    expect(selectCoverage(generated).totalRequirements).toBeGreaterThan(0);
    expect(selectPendingActions(generated)).toEqual([]);
    expect(selectNormalizedPreview(generated).wordCount).toBeGreaterThan(50);
    expect(selectInputIssues(generated)).toEqual([]);
    expect(selectInputIssues({ ...generated, input: { ...generated.input, rawText: '' } }).at(0)?.code).toBe('empty');
  });

  it('stamps the AI mode label and timestamp into the package', () => {
    const doc = buildPackageForSession(generated, defaultAiSettings(), FIXTURE_NOW);
    expect(doc.aiModeLabel).toBe('Mock AI mode');
    expect(doc.generatedAt).toBe(FIXTURE_NOW);
    expect(doc.sections.length).toBeGreaterThan(10);
  });
});

describe('selectJourney', () => {
  it('lists the twelve journey steps in the spec wording', () => {
    expect(selectJourney(null).map((step) => step.label)).toEqual([
      'Understand the customer need',
      'Review the extracted scope',
      'Clarify missing information',
      'Approve the requirements',
      'Generate the PRD',
      'Design the solution',
      'Plan the data flow',
      'Select the AI approach',
      'Estimate the delivery',
      'Review change impact',
      'Validate requirement coverage',
      'Prepare the scoping package',
    ]);
  });

  it('treats a missing session as nothing done with the first step active', () => {
    const steps = selectJourney(null);
    expect(steps.at(0)?.status).toBe('active');
    expect(steps.slice(1).every((step) => step.status === 'todo')).toBe(true);
    expect(steps.map((step) => step.workspaceId)).toEqual([
      'requirements', 'requirements', 'requirements', 'requirements', 'prd', 'architecture', 'strategy', 'strategy', 'estimate', 'package', 'package', 'package',
    ]);
  });

  it('moves the active step forward as the scope is reviewed and approved', () => {
    const analysed = fixtureSession();
    const pendingScope = analysed.scope === null ? null : { ...analysed.scope, approvedVersion: null, approvedAt: null, items: analysed.scope.items.map((item) => ({ ...item, review: 'pending' as const })) };
    const pending = { ...analysed, scope: pendingScope };
    expect(statusOf(pending, 'understand')).toBe('done');
    expect(statusOf(pending, 'review-scope')).toBe('active');

    const approved = approvedFixture();
    expect(statusOf(approved, 'review-scope')).toBe('done');
    expect(statusOf(approved, 'approve')).toBe('done');
    expect(statusOf(approved, 'prd')).toBe('active');
    expect(statusOf(approved, 'architecture')).toBe('todo');
  });

  it('flags open critical gaps or questions and a scope edited after approval', () => {
    const approved = approvedFixture();
    const scope = approved.scope;
    if (scope === null) {
      throw new Error('scope expected');
    }
    expect(statusOf(approved, 'clarify')).toBe('attention');
    const resolved = { ...scope, items: scope.items.map((item) => (item.critical ? { ...item, resolved: true } : item)) };
    expect(statusOf({ ...approved, scope: resolved }, 'clarify')).toBe('done');

    const firstId = scope.items.at(0)?.id ?? '';
    const edited = { ...approved, scope: setItemReview(scope, firstId, 'approved') };
    expect(statusOf(edited, 'approve')).toBe('attention');
  });

  it('marks generated stages done and raises attention while any stage is stale', () => {
    expect(statusOf(generated, 'estimate')).toBe('done');
    expect(statusOf(generated, 'coverage')).toBe('done');
    expect(statusOf(generated, 'change-impact')).toBe('active');

    const stale: ScopingSession = { ...generated, outputs: { ...generated.outputs, architecture: { ...generated.outputs.architecture, status: 'stale', staleReasons: ['Expected users increased'] } } };
    expect(statusOf(stale, 'architecture')).toBe('attention');
    expect(statusOf(stale, 'change-impact')).toBe('attention');
    expect(selectJourney(stale).find((step) => step.id === 'architecture')?.hint).toBe('Expected users increased');
  });
});

describe('selectIsQualityReportOutdated', () => {
  const BASE_QUALITY = {
    checks: [],
    summary: {
      requirementCoveragePct: 100,
      uncoveredRequirements: 0,
      unresolvedQuestions: 0,
      unsupportedRecommendations: 0,
      estimationGaps: 0,
      inconsistencies: 0,
      humanValidationItems: 0,
      estimateConfidence: 'High' as const,
      exportStatus: 'Ready' as const,
    },
    ranAt: '2026-09-19T00:00:00.000Z',
    scopeVersion: 1,
  };

  it('is not outdated when no quality report has ever run', () => {
    const session = fixtureSession();
    expect(session.quality).toBeNull();
    expect(selectIsQualityReportOutdated(session)).toBe(false);
  });

  it('is not outdated when the scope version and every section still match the run', () => {
    const session = { ...fixtureSession(), quality: BASE_QUALITY };
    expect(selectIsQualityReportOutdated(session)).toBe(false);
  });

  it('is outdated when the reviewed scope version has moved on since the run', () => {
    const base = fixtureSession();
    const session = { ...base, scope: base.scope === null ? null : { ...base.scope, version: 2 }, quality: BASE_QUALITY };
    expect(selectIsQualityReportOutdated(session)).toBe(true);
  });

  it('is outdated when a section was (re)generated after the quality gate last ran', () => {
    const base = fixtureSession();
    const session = {
      ...base,
      quality: BASE_QUALITY,
      outputs: {
        ...base.outputs,
        prd: {
          ...base.outputs.prd,
          meta: {
            providerId: 'mock',
            providerLabel: 'Mock AI',
            mode: 'mock' as const,
            usedFallback: false,
            generatedAt: '2026-09-19T01:00:00.000Z',
            durationMs: 10,
            scopeVersion: base.scope?.version ?? 1,
            issues: [],
          },
        },
      },
    };
    expect(selectIsQualityReportOutdated(session)).toBe(true);
  });
});
