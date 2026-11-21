import { describe, expect, it } from 'vitest';
import { newUid } from '../domain';
import type { ImpactEntry, ImpactReport } from '../domain';
import { applyImpactReport, markSectionsResolved, summarizePendingActions } from './applyImpact';
import { buildRichSession } from './testFixtures.data';

function entry(section: ImpactEntry['section'], area: string, action: ImpactEntry['action'] = 'regenerate', elementIds: string[] = []): ImpactEntry {
  return { section, area, elementIds, reason: `${area} depends on the change.`, action };
}

function report(overrides: Partial<ImpactReport> = {}): ImpactReport {
  return {
    id: newUid(),
    change: { kind: 'rate-card', targetId: 'rate-card', label: 'Rate card changed for Backend Engineer', from: '760', to: '900' },
    affected: [entry('commercials', 'Role costs and ROM commercials', 'recalculate')],
    unaffected: [],
    explanation: 'Only the ROM commercials are recalculated.',
    createdAt: '2026-09-19T00:00:00.000Z',
    resolvedSections: [],
    ...overrides,
  };
}

describe('applyImpactReport', () => {
  it('marks only the stage that owns an affected section stale, with a readable reason', () => {
    const session = buildRichSession();
    const applied = applyImpactReport(session, report());
    expect(applied.outputs.estimate.status).toBe('stale');
    expect(applied.outputs.estimate.staleReasons.at(0)).toContain('Role costs and ROM commercials');
  });

  it('leaves every stage that owns no affected section untouched by reference, including its data and reviewed flag', () => {
    const session = buildRichSession();
    const applied = applyImpactReport(session, report());
    expect(applied.outputs.prd).toBe(session.outputs.prd);
    expect(applied.outputs.architecture).toBe(session.outputs.architecture);
    expect(applied.outputs.dataIntegration).toBe(session.outputs.dataIntegration);
    expect(applied.outputs.aiStrategy).toBe(session.outputs.aiStrategy);
  });

  it('a rate-card change leaves every non-commercial stage untouched by reference', () => {
    // Commercials are part of the 'estimate' stage's own output bundle (there is no separate
    // commercials stage), so a rate-card change only ever touches that one stage.
    const session = buildRichSession();
    const rateCardReport = report({ affected: [entry('commercials', 'Role costs and ROM commercials', 'recalculate', ['WS_01'])] });
    const applied = applyImpactReport(session, rateCardReport);
    expect(applied.outputs.prd).toBe(session.outputs.prd);
    expect(applied.outputs.architecture).toBe(session.outputs.architecture);
    expect(applied.outputs.dataIntegration).toBe(session.outputs.dataIntegration);
    expect(applied.outputs.aiStrategy).toBe(session.outputs.aiStrategy);
    expect(applied.outputs.estimate.status).toBe('stale');
    expect(applied.outputs.estimate.data).toBe(session.outputs.estimate.data);
  });

  it('keeps the reviewed flag and the data of a stale section untouched until it is regenerated', () => {
    const session = buildRichSession();
    const applied = applyImpactReport(session, report({ affected: [entry('estimate', 'Workstreams and effort drivers', 'regenerate')] }));
    expect(applied.outputs.estimate.status).toBe('stale');
    expect(applied.outputs.estimate.reviewed).toBe(session.outputs.estimate.reviewed);
    expect(applied.outputs.estimate.data).toBe(session.outputs.estimate.data);
  });

  it('never marks a section stale when its owning stage has not generated anything yet', () => {
    const session = buildRichSession({ outputs: { ...buildRichSession().outputs, aiStrategy: { data: null, status: 'empty', reviewed: false, meta: null, staleReasons: [] } } });
    const applied = applyImpactReport(session, report({ affected: [entry('aiStrategy', 'AI use cases', 'regenerate')] }));
    expect(applied.outputs.aiStrategy.status).toBe('empty');
  });

  it('accumulates unique stale reasons across multiple applied reports', () => {
    const session = buildRichSession();
    const first = applyImpactReport(session, report({ affected: [entry('estimate', 'Area A')] }));
    const second = applyImpactReport(first, report({ id: newUid(), affected: [entry('estimate', 'Area A'), entry('estimate', 'Area B')] }));
    expect(second.outputs.estimate.staleReasons).toHaveLength(2);
  });

  it('appends the report to the change log, without duplicating a report already logged', () => {
    const session = buildRichSession();
    const oneReport = report();
    const applied = applyImpactReport(session, oneReport);
    expect(applied.changeLog).toHaveLength(1);
    const reapplied = applyImpactReport(applied, oneReport);
    expect(reapplied.changeLog).toHaveLength(1);
  });

  it('clears the quality report, since it describes the package before the change', () => {
    const session = buildRichSession({ quality: { checks: [], summary: { requirementCoveragePct: 100, uncoveredRequirements: 0, unresolvedQuestions: 0, unsupportedRecommendations: 0, estimationGaps: 0, inconsistencies: 0, humanValidationItems: 0, estimateConfidence: 'High', exportStatus: 'Ready' }, ranAt: '2026-09-19T00:00:00.000Z', scopeVersion: 1 } });
    const applied = applyImpactReport(session, report());
    expect(applied.quality).toBeNull();
  });
});

describe('markSectionsResolved', () => {
  it('adds the resolved sections to the latest report that lists them as affected', () => {
    const session = buildRichSession();
    const applied = applyImpactReport(session, report({ affected: [entry('estimate', 'Area A'), entry('commercials', 'Area B')] }));
    const resolved = markSectionsResolved(applied, ['estimate']);
    expect(resolved.changeLog.at(0)?.resolvedSections).toEqual(['estimate']);
  });

  it('leaves reports that do not list the section untouched by reference', () => {
    const session = buildRichSession();
    const applied = applyImpactReport(session, report({ affected: [entry('commercials', 'Area B')] }));
    const resolved = markSectionsResolved(applied, ['prd']);
    expect(resolved.changeLog.at(0)).toBe(applied.changeLog.at(0));
    expect(resolved).toBe(applied);
  });

  it('does not resolve a section twice', () => {
    const session = buildRichSession();
    const applied = applyImpactReport(session, report({ affected: [entry('estimate', 'Area A')] }));
    const resolved = markSectionsResolved(applied, ['estimate']);
    const resolvedAgain = markSectionsResolved(resolved, ['estimate']);
    expect(resolvedAgain).toBe(resolved);
  });
});

describe('summarizePendingActions', () => {
  it('offers "recalculate" when every pending entry for a stage is deterministic', () => {
    const session = buildRichSession();
    const applied = applyImpactReport(session, report({ affected: [entry('commercials', 'ROM', 'recalculate'), entry('estimate', 'Workstreams', 'recalculate')] }));
    const actions = summarizePendingActions(applied);
    const estimateAction = actions.find((action) => action.stageId === 'estimate');
    expect(estimateAction?.action).toBe('recalculate');
    expect(estimateAction?.sections.sort()).toEqual(['commercials', 'estimate']);
  });

  it('offers "regenerate" when any pending entry for a stage needs the AI stage', () => {
    const session = buildRichSession();
    const applied = applyImpactReport(session, report({ affected: [entry('estimate', 'Workstreams', 'regenerate')] }));
    const actions = summarizePendingActions(applied);
    expect(actions.find((action) => action.stageId === 'estimate')?.action).toBe('regenerate');
  });

  it('lists no pending action for a stage that is not stale', () => {
    const session = buildRichSession();
    const applied = applyImpactReport(session, report({ affected: [entry('commercials', 'ROM')] }));
    const actions = summarizePendingActions(applied);
    expect(actions.some((action) => action.stageId === 'prd')).toBe(false);
  });
});
