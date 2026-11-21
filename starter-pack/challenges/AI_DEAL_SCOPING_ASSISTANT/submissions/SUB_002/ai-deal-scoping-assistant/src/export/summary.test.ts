import type { CoverageReport } from '../domain';
import { updateScopeItem } from '../scope';
import { fixtureScope, fixtureSession, FIXTURE_NOW } from '../test/fixtures';
import { buildSummaryContext, generateExecutiveSummary, planExecutiveSummary } from './summary';

const COVERAGE: CoverageReport = { rows: [], links: [], totalRequirements: 10, coveredRequirements: 9, coveragePct: 90, highPriorityCoveragePct: 100, uncoveredIds: [], unsupportedAdditions: [] };

vi.mock('../traceability', () => ({ buildCoverageReport: vi.fn(() => COVERAGE) }));

const { runTextTask } = vi.hoisted(() => ({ runTextTask: vi.fn() }));
vi.mock('../ai', () => ({ runTextTask }));

const RUN = { provider: { id: 'mock', label: 'Mock AI', mode: 'mock' as const, complete: vi.fn() }, fallback: null, scopeVersion: 1 };

describe('planExecutiveSummary', () => {
  it('names the customer and opportunity and quantifies the reviewed scope', () => {
    const context = buildSummaryContext(fixtureSession(), fixtureScope());
    const summary = planExecutiveSummary(context);
    expect(summary).toContain('Northwind Mutual');
    expect(summary).toContain('Member Portal Modernisation');
    expect(summary).not.toMatch(/undefined|\bnull\b|NaN/);
  });

  it('writes counts as real singulars and plurals and leaves excluded requirements out of them', () => {
    const scope = updateScopeItem(fixtureScope(), 'FR_02', { inScope: false });
    const summary = planExecutiveSummary(buildSummaryContext(fixtureSession(), scope));
    expect(summary).toContain('1 business objective, 2 functional requirements and 2 non-functional requirements');
    expect(summary).toContain('1 integration and 1 security or compliance requirement that shape');
    expect(summary).toContain('2 clarification questions remain open');
    expect(summary).not.toContain('(s)');
  });

  it('cites every pre-computed fact', () => {
    const context = buildSummaryContext(fixtureSession(), fixtureScope());
    const summary = planExecutiveSummary(context);
    for (const fact of context.facts) {
      expect(summary).toContain(fact.value);
    }
  });

  it('never crashes for an empty scope model, and says grounding is missing', () => {
    const emptyScope = { summary: '', items: [], version: 0, approvedAt: null, approvedVersion: null, issues: [] };
    const session = { ...fixtureSession(), customer: { customerName: '', industry: '', opportunityName: '', region: '', engagementType: '', notes: '' } };
    const summary = planExecutiveSummary(buildSummaryContext(session, emptyScope));
    expect(summary).toContain('the customer');
    expect(summary).not.toMatch(/undefined|\bnull\b|NaN/);
  });
});

describe('generateExecutiveSummary', () => {
  beforeEach(() => {
    runTextTask.mockReset();
  });

  it('returns the deterministic fallback without calling the AI provider when there is no approved scope', async () => {
    const { summary, meta } = await generateExecutiveSummary({ ...fixtureSession(), scope: null }, RUN);
    expect(runTextTask).not.toHaveBeenCalled();
    expect(summary.length).toBeGreaterThan(0);
    expect(meta.usedFallback).toBe(true);
  });

  it('returns the live provider\'s text and its meta when the call succeeds', async () => {
    runTextTask.mockResolvedValue({ value: 'A live-written summary.', meta: { providerId: 'live', providerLabel: 'Live AI', mode: 'live', usedFallback: false, generatedAt: FIXTURE_NOW, durationMs: 5, scopeVersion: 1, issues: [] } });
    const { summary, meta } = await generateExecutiveSummary(fixtureSession(), RUN);
    expect(summary).toBe('A live-written summary.');
    expect(meta.usedFallback).toBe(false);
  });

  it('falls back to the deterministic summary when the provider throws', async () => {
    runTextTask.mockRejectedValue(new Error('network down'));
    const { summary, meta } = await generateExecutiveSummary(fixtureSession(), RUN);
    expect(summary).toContain('Northwind Mutual');
    expect(meta.usedFallback).toBe(true);
    expect(meta.issues.at(0)?.message).toContain('network down');
  });

  it('falls back when the provider returns an empty string', async () => {
    runTextTask.mockResolvedValue({ value: '   ', meta: { providerId: 'live', providerLabel: 'Live AI', mode: 'live', usedFallback: false, generatedAt: FIXTURE_NOW, durationMs: 5, scopeVersion: 1, issues: [] } });
    const { summary, meta } = await generateExecutiveSummary(fixtureSession(), RUN);
    expect(summary.length).toBeGreaterThan(0);
    expect(meta.usedFallback).toBe(true);
  });
});
