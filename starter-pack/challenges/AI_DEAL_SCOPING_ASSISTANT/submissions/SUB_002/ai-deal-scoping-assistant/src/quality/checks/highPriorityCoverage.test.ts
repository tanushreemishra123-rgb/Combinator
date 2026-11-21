import { describe, expect, it } from 'vitest';
import { buildEmptyOutputsSession, buildHealthySession, buildQualityContext } from '../testFixtures.data';
import { highPriorityCoverageCheck } from './highPriorityCoverage';

describe('highPriorityCoverageCheck', () => {
  it('passes when every High-priority requirement is covered', () => {
    const findings = highPriorityCoverageCheck.run(buildQualityContext(buildHealthySession()));
    expect(findings).toEqual([]);
  });

  it('fails when a High-priority requirement is cited by nothing', () => {
    // NFR_01 (availability, High priority) is only ever cited by ARC_05 in the healthy fixture.
    const session = buildHealthySession();
    const architecture = session.outputs.architecture.data!;
    const withoutAvailability = { ...session, outputs: { ...session.outputs, architecture: { ...session.outputs.architecture, data: { ...architecture, components: architecture.components.filter((component) => component.id !== 'ARC_05') } } } };
    const findings = highPriorityCoverageCheck.run(buildQualityContext(withoutAvailability));
    expect(findings.some((finding) => finding.severity === 'fail')).toBe(true);
    expect(findings.some((finding) => finding.refs.includes('NFR_01'))).toBe(true);
  });

  it('reports "Not generated yet" as a fail when there is no reviewed scope model', () => {
    const findings = highPriorityCoverageCheck.run(buildQualityContext(buildEmptyOutputsSession()));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.severity).toBe('fail');
    expect(findings.at(0)?.notice).toBe(true);
  });
});
