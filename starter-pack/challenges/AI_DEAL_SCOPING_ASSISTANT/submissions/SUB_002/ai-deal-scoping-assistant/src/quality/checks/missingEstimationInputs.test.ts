import { describe, expect, it } from 'vitest';
import type { MissingEstimationInput } from '../../domain';
import { buildEstimateBundle, buildHealthySession, buildQualityContext } from '../testFixtures.data';
import { missingEstimationInputsCheck } from './missingEstimationInputs';

function withMissingInputs(missingInputs: MissingEstimationInput[]) {
  const session = buildHealthySession();
  const bundle = buildEstimateBundle({ missingInputs });
  return { ...session, outputs: { ...session.outputs, estimate: { data: bundle, status: 'current' as const, reviewed: true, meta: null, staleReasons: [] } } };
}

describe('missingEstimationInputsCheck', () => {
  it('passes when the estimate has no missing inputs', () => {
    expect(missingEstimationInputsCheck.run(buildQualityContext(buildHealthySession()))).toEqual([]);
  });

  it('warns for a missing input that only reduces confidence', () => {
    const session = withMissingInputs([{ key: 'integrationReadiness', label: 'Integration readiness', effect: 'confidence-reduced', affected: ['WS_02'], relatedScopeIds: ['GAP_01'], howToResolve: 'Confirm the Salesforce API readiness with the customer.' }]);
    const findings = missingEstimationInputsCheck.run(buildQualityContext(session));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.severity).toBe('warn');
    expect(findings.at(0)?.message).toContain('Confirm the Salesforce API readiness');
  });

  it('fails for a missing input that blocks the calculation', () => {
    const session = withMissingInputs([{ key: 'roleRate', label: 'Backend Engineer day rate', effect: 'calculation-blocked', affected: ['WS_01'], relatedScopeIds: [], howToResolve: 'Add a day rate for the Backend Engineer role.' }]);
    const findings = missingEstimationInputsCheck.run(buildQualityContext(session));
    expect(findings.at(0)?.severity).toBe('fail');
  });

  it('reports "Not generated yet" and lists open gaps and questions when no estimate exists yet', () => {
    const session = buildHealthySession({ outputs: { ...buildHealthySession().outputs, estimate: { data: null, status: 'empty', reviewed: false, meta: null, staleReasons: [] } } });
    const scope = { ...session.scope!, items: session.scope!.items.map((item) => (item.id === 'GAP_01' ? { ...item, resolved: false } : item)) };
    const findings = missingEstimationInputsCheck.run(buildQualityContext({ ...session, scope }));
    expect(findings.at(0)?.notice).toBe(true);
    expect(findings.some((finding) => finding.refs.includes('GAP_01'))).toBe(true);
  });
});
