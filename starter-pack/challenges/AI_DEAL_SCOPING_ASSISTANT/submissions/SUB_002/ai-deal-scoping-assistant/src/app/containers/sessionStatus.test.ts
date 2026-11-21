/** Unit tests for the Sessions dialog's per-row status label - every branch, in order. */
import type { ScopingSession, SessionOutputs } from '../../domain';
import { fixtureSession } from '../../test/fixtures';
import { describeSessionStatus } from './sessionStatus';

function withScope(session: ScopingSession, scope: ScopingSession['scope']): ScopingSession {
  return { ...session, scope };
}

function withGeneratedStages(session: ScopingSession, generatedKeys: readonly (keyof SessionOutputs)[]): ScopingSession {
  const generated = new Set<string>(generatedKeys);
  const entries = Object.entries(session.outputs).map(([key, section]) => [
    key,
    generated.has(key) ? { ...section, data: {}, status: 'current' } : section,
  ]);
  return { ...session, outputs: Object.fromEntries(entries) as unknown as SessionOutputs };
}

describe('describeSessionStatus', () => {
  it('reports requirements not analyzed when there is no scope yet', () => {
    const session = withScope(fixtureSession(), null);
    expect(describeSessionStatus(session)).toBe('Requirements not analyzed');
  });

  it('reports scope in review when the scope was never approved', () => {
    const base = fixtureSession();
    const session = withScope(base, { ...(base.scope as NonNullable<ScopingSession['scope']>), approvedAt: null, approvedVersion: null });
    expect(describeSessionStatus(session)).toBe('Scope in review');
  });

  it('reports scope in review when the scope changed after it was approved', () => {
    const base = fixtureSession();
    const scope = base.scope as NonNullable<ScopingSession['scope']>;
    const session = withScope(base, { ...scope, version: scope.version + 1 });
    expect(describeSessionStatus(session)).toBe('Scope in review');
  });

  it('reports scope approved when nothing has been generated yet', () => {
    expect(describeSessionStatus(fixtureSession())).toBe('Scope approved');
  });

  it('counts partially generated deliverables', () => {
    const session = withGeneratedStages(fixtureSession(), ['prd', 'architecture']);
    expect(describeSessionStatus(session)).toBe('2 of 5 deliverables generated');
  });

  it('reports every deliverable generated once all five sections have data', () => {
    const session = withGeneratedStages(fixtureSession(), ['prd', 'architecture', 'dataIntegration', 'aiStrategy', 'estimate']);
    expect(describeSessionStatus(session)).toBe('All deliverables generated');
  });
});
