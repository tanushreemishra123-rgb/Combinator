import { describe, expect, it, vi } from 'vitest';
import type { AiProvider, AiRequest, TaskRunOptions } from '../ai/types';
import type { ChangeDescriptor } from '../domain';
import { createImpactReport, RULE_BASED_EXPLANATION_NOTE } from './report';
import { buildRichSession } from './testFixtures.data';

const CHANGE: ChangeDescriptor = { kind: 'expected-users', targetId: 'expectedUsers', label: 'Expected users increased from 5,000 to 500,000', from: '5,000', to: '500,000' };

function fakeProvider(complete: (request: AiRequest) => Promise<string>, mode: AiProvider['mode'] = 'mock'): AiProvider {
  return { id: 'fake', label: 'Fake provider', mode, complete };
}

function runOptions(provider: AiProvider, fallback: AiProvider | null = null): TaskRunOptions {
  return { provider, fallback, scopeVersion: 1 };
}

describe('createImpactReport', () => {
  it('runs the rule-based analysis and uses the provider only to word the explanation', async () => {
    const session = buildRichSession();
    const provider = fakeProvider(async () => 'The expected user volume increased, so the scalability architecture must be re-validated.');
    const report = await createImpactReport(session, CHANGE, runOptions(provider), '2026-09-19T00:00:00.000Z');
    expect(report.change).toEqual(CHANGE);
    expect(report.affected.length).toBeGreaterThan(0);
    expect(report.explanation).toBe('The expected user volume increased, so the scalability architecture must be re-validated.');
    expect(report.createdAt).toBe('2026-09-19T00:00:00.000Z');
    expect(report.resolvedSections).toEqual([]);
    expect(report.id.length).toBeGreaterThan(0);
  });

  it('falls back to the deterministic explanation, clearly labelled, when the provider throws', async () => {
    const session = buildRichSession();
    const provider = fakeProvider(async () => {
      throw new Error('network unreachable');
    });
    const report = await createImpactReport(session, CHANGE, runOptions(provider));
    expect(report.explanation).toContain(RULE_BASED_EXPLANATION_NOTE);
    expect(report.explanation).toContain('Change: Expected users increased from 5,000 to 500,000');
  });

  it('falls back to the deterministic explanation when the provider returns only whitespace', async () => {
    const session = buildRichSession();
    const provider = fakeProvider(async () => '   ');
    const report = await createImpactReport(session, CHANGE, runOptions(provider));
    expect(report.explanation).toContain(RULE_BASED_EXPLANATION_NOTE);
  });

  it('assigns a new id to every report it creates', async () => {
    const session = buildRichSession();
    const provider = fakeProvider(async () => 'Explanation.');
    const first = await createImpactReport(session, CHANGE, runOptions(provider));
    const second = await createImpactReport(session, CHANGE, runOptions(provider));
    expect(first.id).not.toBe(second.id);
  });

  it('never lets an explanation failure change what the rule-based analysis found', async () => {
    const session = buildRichSession();
    const okProvider = fakeProvider(async () => 'Explanation.');
    const failingProvider = fakeProvider(async () => {
      throw new Error('boom');
    });
    const okReport = await createImpactReport(session, CHANGE, runOptions(okProvider));
    const failedReport = await createImpactReport(session, CHANGE, runOptions(failingProvider));
    expect(failedReport.affected).toEqual(okReport.affected);
    expect(failedReport.unaffected).toEqual(okReport.unaffected);
  });

  it('logs a warning instead of throwing when the explanation call fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const session = buildRichSession();
    const provider = fakeProvider(async () => {
      throw new Error('boom');
    });
    await createImpactReport(session, CHANGE, runOptions(provider));
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
