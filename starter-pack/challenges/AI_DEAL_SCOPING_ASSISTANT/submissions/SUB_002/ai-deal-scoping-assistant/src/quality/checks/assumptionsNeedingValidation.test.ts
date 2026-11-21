import { describe, expect, it } from 'vitest';
import { buildEmptyOutputsSession, buildHealthySession, buildQualityContext } from '../testFixtures.data';
import { assumptionsNeedingValidationCheck } from './assumptionsNeedingValidation';

describe('assumptionsNeedingValidationCheck', () => {
  it('passes when every assumption is validated and no scope item is pending review', () => {
    expect(assumptionsNeedingValidationCheck.run(buildQualityContext(buildHealthySession()))).toEqual([]);
  });

  it('warns for an unvalidated assumption', () => {
    const session = buildHealthySession();
    const scope = { ...session.scope!, items: session.scope!.items.map((item) => (item.id === 'ASM_01' ? { ...item, resolved: false } : item)) };
    const findings = assumptionsNeedingValidationCheck.run(buildQualityContext({ ...session, scope }));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.severity).toBe('warn');
    expect(findings.at(0)?.message).toContain('ASM_01');
    expect(findings.at(0)?.refs).toContain('ASM_01');
  });

  it('lists critical assumptions before non-critical ones', () => {
    const session = buildHealthySession();
    const nonCritical = session.scope!.items.find((item) => item.id === 'ASM_01')!;
    const critical = { ...nonCritical, id: 'ASM_02', title: 'Members already have an active email address', critical: true, resolved: false };
    const scope = { ...session.scope!, items: [...session.scope!.items.map((item) => (item.id === 'ASM_01' ? { ...item, resolved: false } : item)), critical] };
    const findings = assumptionsNeedingValidationCheck.run(buildQualityContext({ ...session, scope }));
    expect(findings).toHaveLength(2);
    expect(findings.at(0)?.message).toContain('Critical assumption');
    expect(findings.at(0)?.refs).toContain('ASM_02');
  });

  it('warns for a scope item still pending human review', () => {
    const session = buildHealthySession();
    const scope = { ...session.scope!, items: session.scope!.items.map((item) => (item.id === 'FR_02' ? { ...item, review: 'pending' as const } : item)) };
    const findings = assumptionsNeedingValidationCheck.run(buildQualityContext({ ...session, scope }));
    expect(findings.some((finding) => finding.message.includes('FR_02') && finding.message.includes('pending human review'))).toBe(true);
  });

  it('reports "Not generated yet" when there is no reviewed scope model', () => {
    const findings = assumptionsNeedingValidationCheck.run(buildQualityContext(buildEmptyOutputsSession()));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.notice).toBe(true);
  });
});
