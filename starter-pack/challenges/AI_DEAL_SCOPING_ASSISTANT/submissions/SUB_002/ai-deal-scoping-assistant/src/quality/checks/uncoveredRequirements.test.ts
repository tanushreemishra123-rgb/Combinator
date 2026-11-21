import { describe, expect, it } from 'vitest';
import { buildEmptyOutputsSession, buildHealthySession, buildQualityContext } from '../testFixtures.data';
import { uncoveredRequirementsCheck } from './uncoveredRequirements';

describe('uncoveredRequirementsCheck', () => {
  it('passes when every reviewed requirement is covered', () => {
    expect(uncoveredRequirementsCheck.run(buildQualityContext(buildHealthySession()))).toEqual([]);
  });

  it('warns for every requirement no generated element cites, regardless of priority', () => {
    const session = buildHealthySession();
    const architecture = session.outputs.architecture.data!;
    // NFR_02 (Medium priority, scalability) is only ever cited by ARC_02.
    const withoutScalability = { ...session, outputs: { ...session.outputs, architecture: { ...session.outputs.architecture, data: { ...architecture, components: architecture.components.filter((component) => component.id !== 'ARC_02') } } } };
    const findings = uncoveredRequirementsCheck.run(buildQualityContext(withoutScalability));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.refs).toEqual(['NFR_02']);
  });

  it('is a warning, not a failure, even for an uncovered High-priority requirement', () => {
    const session = buildHealthySession();
    const architecture = session.outputs.architecture.data!;
    const withoutAvailability = { ...session, outputs: { ...session.outputs, architecture: { ...session.outputs.architecture, data: { ...architecture, components: architecture.components.filter((component) => component.id !== 'ARC_05') } } } };
    const gate = uncoveredRequirementsCheck.run(buildQualityContext(withoutAvailability));
    expect(gate.every((finding) => finding.severity === 'warn' || finding.notice)).toBe(true);
  });

  it('reports "Not generated yet" when there is no reviewed scope model', () => {
    const findings = uncoveredRequirementsCheck.run(buildQualityContext(buildEmptyOutputsSession()));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.notice).toBe(true);
  });
});
