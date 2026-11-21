import { describe, expect, it } from 'vitest';
import type { EstimateBundle, ScopingSession } from '../../domain';
import { buildEmptyOutputsSession, buildEstimateBundle, buildHealthySession, buildQualityContext } from '../testFixtures.data';
import { estimateConsistencyCheck } from './estimateConsistency';

function withEstimate(session: ScopingSession, bundle: EstimateBundle): ScopingSession {
  return { ...session, outputs: { ...session.outputs, estimate: { data: bundle, status: 'current', reviewed: true, meta: null, staleReasons: [] } } };
}

describe('estimateConsistencyCheck', () => {
  it('passes for a self-consistent estimate computed from the current configuration', () => {
    expect(estimateConsistencyCheck.run(buildQualityContext(buildHealthySession()))).toEqual([]);
  });

  it('fails when the total effort does not equal the sum of the workstreams', () => {
    const session = buildHealthySession();
    const bundle = buildEstimateBundle();
    const broken = { ...bundle, result: { ...bundle.result, totals: { ...bundle.result.totals, effortDays: { low: 1, likely: 1, high: 1 } } } };
    const findings = estimateConsistencyCheck.run(buildQualityContext(withEstimate(session, broken)));
    expect(findings.some((finding) => finding.severity === 'fail' && finding.message.includes('Total effort'))).toBe(true);
  });

  it('fails when the ROM does not equal subtotal plus contingency', () => {
    const session = buildHealthySession();
    const bundle = buildEstimateBundle();
    const rom = { ...bundle.result.totals.rom!, likely: bundle.result.totals.rom!.likely + 100_000 };
    const broken = { ...bundle, result: { ...bundle.result, totals: { ...bundle.result.totals, rom } } };
    const findings = estimateConsistencyCheck.run(buildQualityContext(withEstimate(session, broken)));
    expect(findings.some((finding) => finding.severity === 'fail' && finding.message.includes('ROM'))).toBe(true);
  });

  it('fails when a commercial figure is expressed in a currency other than the configured one', () => {
    const session = buildHealthySession();
    const bundle = buildEstimateBundle();
    const rom = { ...bundle.result.totals.rom!, currency: 'GBP' };
    const broken = { ...bundle, result: { ...bundle.result, totals: { ...bundle.result.totals, rom } } };
    const findings = estimateConsistencyCheck.run(buildQualityContext(withEstimate(session, broken)));
    expect(findings.some((finding) => finding.severity === 'fail' && finding.message.includes('GBP'))).toBe(true);
  });

  it('fails when the estimation configuration was edited after the numbers were calculated', () => {
    const session = buildHealthySession();
    const estimationConfig = { ...session.estimationConfig, contingencyPct: session.estimationConfig.contingencyPct + 5 };
    const findings = estimateConsistencyCheck.run(buildQualityContext({ ...session, estimationConfig }));
    expect(findings.some((finding) => finding.severity === 'fail' && finding.message.includes('out of date'))).toBe(true);
  });

  it('fails when a reviewer complexity override is not reflected in the calculated estimate', () => {
    const session = buildHealthySession();
    const bundle = buildEstimateBundle();
    const driverId = bundle.result.workstreams.at(0)!.drivers.at(0)!.id;
    const withOverride = { ...bundle, overrides: [{ driverId, complexity: 'High' as const }] };
    const findings = estimateConsistencyCheck.run(buildQualityContext(withEstimate(session, withOverride)));
    expect(findings.some((finding) => finding.severity === 'fail' && finding.message.includes('does not use that setting') && finding.refs.includes(driverId))).toBe(true);
  });

  it('warns when two drivers in different workstreams price the same reviewed requirements', () => {
    const session = buildHealthySession();
    const bundle = buildEstimateBundle();
    const workstreams = bundle.suggestion.workstreams.map((ws, index) =>
      index === 0 ? { ...ws, drivers: [...ws.drivers, { id: 'DRV_98', type: 'capability' as const, label: 'Copy', complexity: 'Low' as const, rationale: 'Copy.', refIds: ['CAP_98', 'FR_98'] }], requirementIds: [...ws.requirementIds, 'FR_98'] } : ws,
    );
    const extra = { id: 'WS_98', name: 'Data', phaseId: 'PH_3', requirementIds: ['FR_98'], drivers: [{ id: 'DRV_99', type: 'data' as const, label: 'Data', complexity: 'Low' as const, rationale: 'Data.', refIds: ['FR_98'] }], skills: [] };
    const overlapping = { ...bundle, suggestion: { ...bundle.suggestion, workstreams: [...workstreams, extra] } };
    const findings = estimateConsistencyCheck.run(buildQualityContext(withEstimate(session, overlapping)));
    expect(findings).toEqual([expect.objectContaining({ severity: 'warn', refs: ['DRV_98', 'DRV_99', 'FR_98'] })]);
    expect(findings.at(0)?.message).toContain('counted twice');
  });

  it('reports "Not generated yet" when no estimate has been generated', () => {
    const findings = estimateConsistencyCheck.run(buildQualityContext(buildEmptyOutputsSession()));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.notice).toBe(true);
  });
});
