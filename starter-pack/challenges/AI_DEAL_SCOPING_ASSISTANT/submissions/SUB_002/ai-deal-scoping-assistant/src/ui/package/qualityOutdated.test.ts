import { fixtureSession } from '../../test/fixtures';
import { isQualityReportOutdated } from './qualityOutdated';

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

describe('isQualityReportOutdated', () => {
  it('is not outdated when no quality report has ever run', () => {
    const session = fixtureSession();
    expect(session.quality).toBeNull();
    expect(isQualityReportOutdated(session)).toBe(false);
  });

  it('is not outdated when the scope version and every section still match the run', () => {
    const session = { ...fixtureSession(), quality: BASE_QUALITY };
    expect(isQualityReportOutdated(session)).toBe(false);
  });

  it('is outdated when the reviewed scope version has moved on since the run', () => {
    const base = fixtureSession();
    const session = {
      ...base,
      scope: base.scope === null ? null : { ...base.scope, version: 2 },
      quality: BASE_QUALITY,
    };
    expect(isQualityReportOutdated(session)).toBe(true);
  });

  it('is outdated when a section was generated after the quality gate last ran', () => {
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
    expect(isQualityReportOutdated(session)).toBe(true);
  });
});
