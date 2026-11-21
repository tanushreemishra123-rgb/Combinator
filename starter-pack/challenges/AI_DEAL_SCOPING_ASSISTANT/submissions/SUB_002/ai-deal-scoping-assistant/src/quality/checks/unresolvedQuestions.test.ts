import { describe, expect, it } from 'vitest';
import { buildEmptyOutputsSession, buildHealthySession, buildQualityContext } from '../testFixtures.data';
import { unresolvedQuestionsCheck } from './unresolvedQuestions';

describe('unresolvedQuestionsCheck', () => {
  it('passes when every clarification question has been answered', () => {
    expect(unresolvedQuestionsCheck.run(buildQualityContext(buildHealthySession()))).toEqual([]);
  });

  it('warns for an open question, naming it and its priority in the message', () => {
    const session = buildHealthySession();
    const scope = { ...session.scope!, items: session.scope!.items.map((item) => (item.id === 'Q_01' ? { ...item, resolved: false } : item)) };
    const findings = unresolvedQuestionsCheck.run(buildQualityContext({ ...session, scope }));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.severity).toBe('warn');
    expect(findings.at(0)?.message).toContain('Which identity provider');
  });

  it('lists critical questions before non-critical ones', () => {
    const session = buildHealthySession();
    const scope = { ...session.scope!, items: session.scope!.items.map((item) => (['Q_01', 'Q_02'].includes(item.id) ? { ...item, resolved: false } : item)) };
    const findings = unresolvedQuestionsCheck.run(buildQualityContext({ ...session, scope }));
    expect(findings).toHaveLength(2);
    expect(findings.at(0)?.message).toContain('Critical clarification question');
    expect(findings.at(0)?.refs).toContain('Q_02');
  });

  it('reports "Not generated yet" when there is no reviewed scope model', () => {
    const findings = unresolvedQuestionsCheck.run(buildQualityContext(buildEmptyOutputsSession()));
    expect(findings).toHaveLength(1);
    expect(findings.at(0)?.notice).toBe(true);
  });
});
