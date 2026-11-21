import { describe, expect, it } from 'vitest';
import { buildEmptyOutputsSession, buildHealthySession, buildQualityContext } from '../testFixtures.data';
import { unjustifiedComponentsCheck } from './unjustifiedComponents';

describe('unjustifiedComponentsCheck', () => {
  it('passes when every architecture component cites a reviewed requirement or assumption', () => {
    expect(unjustifiedComponentsCheck.run(buildQualityContext(buildHealthySession()))).toEqual([]);
  });

  it('fails when a component cites no reviewed requirement or assumption', () => {
    const session = buildHealthySession();
    const architecture = session.outputs.architecture.data!;
    const unjustified = { ...architecture.components.at(0)!, id: 'ARC_97', requirementIds: [], assumptionIds: [] };
    const withUnjustified = { ...session, outputs: { ...session.outputs, architecture: { ...session.outputs.architecture, data: { ...architecture, components: [...architecture.components, unjustified] } } } };
    const findings = unjustifiedComponentsCheck.run(buildQualityContext(withUnjustified));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.severity).toBe('fail');
    expect(findings.at(0)?.refs).toEqual(['ARC_97']);
  });

  it('fails when a component only cites ids that fell out of the approved scope model', () => {
    const session = buildHealthySession();
    const architecture = session.outputs.architecture.data!;
    const stale = { ...architecture.components.at(0)!, id: 'ARC_96', requirementIds: ['FR_777'], assumptionIds: [] };
    const withStale = { ...session, outputs: { ...session.outputs, architecture: { ...session.outputs.architecture, data: { ...architecture, components: [...architecture.components, stale] } } } };
    const findings = unjustifiedComponentsCheck.run(buildQualityContext(withStale));
    expect(findings.at(0)?.message).toContain('FR_777');
  });

  it('reports "Not generated yet" when the architecture has not been designed yet', () => {
    const findings = unjustifiedComponentsCheck.run(buildQualityContext(buildEmptyOutputsSession()));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.notice).toBe(true);
  });
});
