import { describe, expect, it } from 'vitest';
import { buildHealthySession, buildQualityContext } from '../testFixtures.data';
import { integrationsMissingFromPlanCheck } from './integrationsMissingFromPlan';

describe('integrationsMissingFromPlanCheck', () => {
  it('passes when every integration is referenced by a workstream or driver in the delivery plan', () => {
    expect(integrationsMissingFromPlanCheck.run(buildQualityContext(buildHealthySession()))).toEqual([]);
  });

  it('passes trivially when there are no integrations to plan for', () => {
    const session = buildHealthySession();
    const dataIntegration = session.outputs.dataIntegration.data!;
    const withoutIntegrations = { ...session, outputs: { ...session.outputs, dataIntegration: { ...session.outputs.dataIntegration, data: { ...dataIntegration, integrations: [] } } } };
    expect(integrationsMissingFromPlanCheck.run(buildQualityContext(withoutIntegrations))).toEqual([]);
  });

  it('fails when a designed integration is not covered by any workstream or estimate driver', () => {
    const session = buildHealthySession();
    const dataIntegration = session.outputs.dataIntegration.data!;
    const orphanIntegration = { ...dataIntegration.integrations.at(0)!, id: 'IF_02', name: 'Payment Gateway Sync', requirementIds: [] };
    const withOrphan = { ...session, outputs: { ...session.outputs, dataIntegration: { ...session.outputs.dataIntegration, data: { ...dataIntegration, integrations: [...dataIntegration.integrations, orphanIntegration] } } } };
    const findings = integrationsMissingFromPlanCheck.run(buildQualityContext(withOrphan));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.severity).toBe('fail');
    expect(findings.at(0)?.message).toContain('Payment Gateway Sync');
  });

  it('reports "Not generated yet" when the integration architecture does not exist', () => {
    const session = buildHealthySession({ outputs: { ...buildHealthySession().outputs, dataIntegration: { data: null, status: 'empty', reviewed: false, meta: null, staleReasons: [] } } });
    const findings = integrationsMissingFromPlanCheck.run(buildQualityContext(session));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.notice).toBe(true);
  });

  it('reports "Not generated yet" when integrations exist but the delivery plan does not', () => {
    const session = buildHealthySession({ outputs: { ...buildHealthySession().outputs, estimate: { data: null, status: 'empty', reviewed: false, meta: null, staleReasons: [] } } });
    const findings = integrationsMissingFromPlanCheck.run(buildQualityContext(session));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.notice).toBe(true);
  });
});
