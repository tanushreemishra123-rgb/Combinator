import { describe, expect, it } from 'vitest';
import { QUALITY_CHECK_IDS } from '../domain';
import { runQualityGate } from './runQualityGate';
import { buildEmptyOutputsSession, buildHealthySession } from './testFixtures.data';

describe('runQualityGate', () => {
  it('runs all twelve checks, in the order of QUALITY_CHECK_IDS, and rolls up to "Ready" on a fully healthy session', () => {
    const report = runQualityGate(buildHealthySession(), '2026-09-19T00:00:00.000Z');
    expect(report.checks.map((check) => check.id)).toEqual([...QUALITY_CHECK_IDS]);
    const failing = report.checks.filter((check) => check.status !== 'pass');
    expect(failing).toEqual([]);
    expect(report.summary.exportStatus).toBe('Ready');
    expect(report.ranAt).toBe('2026-09-19T00:00:00.000Z');
  });

  it('carries the reviewed scope model version', () => {
    const session = buildHealthySession();
    const report = runQualityGate(session, '2026-09-19T00:00:00.000Z');
    expect(report.scopeVersion).toBe(session.scope?.version);
  });

  it('reports the estimate confidence from the generated estimate', () => {
    const report = runQualityGate(buildHealthySession(), '2026-09-19T00:00:00.000Z');
    expect(report.summary.estimateConfidence).toBe('Medium');
  });

  it('reports coverage percentage from the traceability coverage report', () => {
    const report = runQualityGate(buildHealthySession(), '2026-09-19T00:00:00.000Z');
    expect(report.summary.requirementCoveragePct).toBe(100);
  });

  it('never throws on a session with no scope model and no generated outputs, and reports "Not estimated"', () => {
    const report = runQualityGate(buildEmptyOutputsSession(), '2026-09-19T00:00:00.000Z');
    expect(report.summary.estimateConfidence).toBe('Not estimated');
    expect(report.summary.requirementCoveragePct).toBe(0);
    expect(report.summary.exportStatus).toBe('Blocked');
    expect(report.scopeVersion).toBe(0);
  });

  it('never produces user-facing text containing undefined, null or [object Object]', () => {
    const report = runQualityGate(buildEmptyOutputsSession(), '2026-09-19T00:00:00.000Z');
    const text = report.checks.flatMap((check) => [check.label, check.description, ...check.findings.map((finding) => finding.message)]).join(' ');
    expect(text).not.toMatch(/undefined|null|NaN|\[object Object]/);
  });
});
