import { describe, expect, it } from 'vitest';
import { STAGES } from '../../domain';
import { buildEmptyOutputsSession, buildHealthySession, buildQualityContext } from '../testFixtures.data';
import { staleSectionsCheck } from './staleSections';

describe('staleSectionsCheck', () => {
  it('passes when every generation stage is current', () => {
    expect(staleSectionsCheck.run(buildQualityContext(buildHealthySession()))).toEqual([]);
  });

  it('fails and names the reasons when a stage is stale', () => {
    const session = buildHealthySession();
    const architecture = { ...session.outputs.architecture, status: 'stale' as const, staleReasons: ['Expected users increased from 5,000 to 500,000 - affects Database sizing'] };
    const findings = staleSectionsCheck.run(buildQualityContext({ ...session, outputs: { ...session.outputs, architecture } }));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.severity).toBe('fail');
    expect(findings.at(0)?.message).toContain('Database sizing');
  });

  it('falls back to a generic reason when a stale stage carries none', () => {
    const session = buildHealthySession();
    const architecture = { ...session.outputs.architecture, status: 'stale' as const, staleReasons: [] };
    const findings = staleSectionsCheck.run(buildQualityContext({ ...session, outputs: { ...session.outputs, architecture } }));
    expect(findings.at(0)?.message).toContain('a reviewed input changed after it was generated');
  });

  it('reports "Not generated yet" when a stage has never produced output', () => {
    const session = buildHealthySession();
    const architecture = { data: null, status: 'empty' as const, reviewed: false, meta: null, staleReasons: [] };
    const findings = staleSectionsCheck.run(buildQualityContext({ ...session, outputs: { ...session.outputs, architecture } }));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.notice).toBe(true);
  });

  it('never throws and reports every stage missing on a session with no outputs at all', () => {
    const findings = staleSectionsCheck.run(buildQualityContext(buildEmptyOutputsSession()));
    expect(findings).toHaveLength(STAGES.length);
    expect(findings.every((finding) => finding.notice)).toBe(true);
  });
});
