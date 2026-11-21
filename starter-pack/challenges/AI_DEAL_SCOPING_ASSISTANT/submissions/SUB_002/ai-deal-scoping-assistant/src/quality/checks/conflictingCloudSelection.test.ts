import { describe, expect, it } from 'vitest';
import { buildEmptyOutputsSession, buildHealthySession, buildQualityContext } from '../testFixtures.data';
import { conflictingCloudSelectionCheck } from './conflictingCloudSelection';

describe('conflictingCloudSelectionCheck', () => {
  it('passes when the configuration, the architecture and every named technology agree on one platform', () => {
    expect(conflictingCloudSelectionCheck.run(buildQualityContext(buildHealthySession()))).toEqual([]);
  });

  it('fails when the user-selected platform differs from the platform the architecture was designed for', () => {
    const session = buildHealthySession();
    const config = { ...session.config, cloudPlatform: 'aws' as const };
    const findings = conflictingCloudSelectionCheck.run(buildQualityContext({ ...session, config }));
    expect(findings.some((finding) => finding.severity === 'fail' && finding.message.includes('Amazon Web Services') && finding.message.includes('Microsoft Azure'))).toBe(true);
  });

  it('fails when a component uses a service that belongs to another platform\'s catalog', () => {
    const session = buildHealthySession();
    const architecture = session.outputs.architecture.data!;
    const foreign = { ...architecture.components.at(0)!, id: 'ARC_90', service: 'Amazon RDS for PostgreSQL' };
    const withForeign = { ...session, outputs: { ...session.outputs, architecture: { ...session.outputs.architecture, data: { ...architecture, components: [...architecture.components, foreign] } } } };
    const findings = conflictingCloudSelectionCheck.run(buildQualityContext(withForeign));
    expect(findings.some((finding) => finding.severity === 'fail' && finding.refs.includes('ARC_90'))).toBe(true);
  });

  it('warns when a technology preference names a different cloud than the selected platform', () => {
    const session = buildHealthySession();
    const scope = { ...session.scope!, items: session.scope!.items.map((item) => (item.id === 'TECH_01' ? { ...item, signals: ['cloud:aws'] } : item)) };
    const findings = conflictingCloudSelectionCheck.run(buildQualityContext({ ...session, scope }));
    expect(findings.some((finding) => finding.severity === 'warn' && finding.refs.includes('TECH_01'))).toBe(true);
  });

  it('reports "Not generated yet" when the solution architecture has not been designed yet', () => {
    const findings = conflictingCloudSelectionCheck.run(buildQualityContext(buildEmptyOutputsSession()));
    expect(findings.some((finding) => finding.notice)).toBe(true);
  });
});
