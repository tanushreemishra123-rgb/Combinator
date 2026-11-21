import { describe, expect, it } from 'vitest';
import { buildHealthySession, buildQualityContext } from '../testFixtures.data';
import { unsupportedAdditionsCheck } from './unsupportedAdditions';

describe('unsupportedAdditionsCheck', () => {
  it('passes when every generated element cites a reviewed, in-scope item', () => {
    expect(unsupportedAdditionsCheck.run(buildQualityContext(buildHealthySession()))).toEqual([]);
  });

  it('warns for a generated element that cites nothing', () => {
    const session = buildHealthySession();
    const architecture = session.outputs.architecture.data!;
    const untethered = { ...architecture.components.at(0)!, id: 'ARC_99', requirementIds: [], assumptionIds: [] };
    const withUntethered = { ...session, outputs: { ...session.outputs, architecture: { ...session.outputs.architecture, data: { ...architecture, components: [...architecture.components, untethered] } } } };
    const findings = unsupportedAdditionsCheck.run(buildQualityContext(withUntethered));
    expect(findings.some((finding) => finding.severity === 'warn' && finding.refs.includes('ARC_99'))).toBe(true);
  });

  it('warns for a generated element that cites an id outside the approved scope model', () => {
    const session = buildHealthySession();
    const architecture = session.outputs.architecture.data!;
    const wrongRef = { ...architecture.components.at(0)!, id: 'ARC_98', requirementIds: ['FR_999'] };
    const withWrongRef = { ...session, outputs: { ...session.outputs, architecture: { ...session.outputs.architecture, data: { ...architecture, components: [...architecture.components, wrongRef] } } } };
    const findings = unsupportedAdditionsCheck.run(buildQualityContext(withWrongRef));
    const finding = findings.find((candidate) => candidate.refs.includes('ARC_98'));
    expect(finding?.refs).toContain('FR_999');
  });

  it('warns for a recommended enhancement that is not backed by any reviewed requirement or assumption', () => {
    const session = buildHealthySession();
    const prd = session.outputs.prd.data!;
    const enhancement = { id: 'ENH_01', name: 'Loyalty rewards', scope: 'Points-based loyalty programme.', requirementIds: [], priority: 'Low' as const, dependencies: [], label: 'recommended-enhancement' as const, module: 'Core Platform', workstream: 'Core Platform', deliveryPackage: 'Package 1', acceptance: [] };
    const withEnhancement = { ...session, outputs: { ...session.outputs, prd: { ...session.outputs.prd, data: { ...prd, functionalScope: { ...prd.functionalScope, recommendedEnhancements: [enhancement] } } } } };
    const findings = unsupportedAdditionsCheck.run(buildQualityContext(withEnhancement));
    expect(findings.some((finding) => finding.message.includes('Loyalty rewards'))).toBe(true);
  });

  it('does not double-flag a recommended enhancement already caught by the trace-based check', () => {
    const session = buildHealthySession();
    const prd = session.outputs.prd.data!;
    const enhancement = { id: 'ENH_02', name: 'Bulk export', scope: 'Export all documents at once.', requirementIds: [], priority: 'Low' as const, dependencies: [], label: 'recommended-enhancement' as const, module: 'Core Platform', workstream: 'Core Platform', deliveryPackage: 'Package 1', acceptance: [] };
    const withEnhancement = { ...session, outputs: { ...session.outputs, prd: { ...session.outputs.prd, data: { ...prd, functionalScope: { ...prd.functionalScope, recommendedEnhancements: [enhancement] } } } } };
    const findings = unsupportedAdditionsCheck.run(buildQualityContext(withEnhancement));
    expect(findings.filter((finding) => finding.refs.includes('ENH_02'))).toHaveLength(1);
  });
});
