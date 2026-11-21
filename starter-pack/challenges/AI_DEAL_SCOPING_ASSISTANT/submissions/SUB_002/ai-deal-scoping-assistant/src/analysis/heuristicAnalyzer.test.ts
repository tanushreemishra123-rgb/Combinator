import { AnalysisOutputSchema, isValidIdForKind } from '../domain';
import type { ScopeItemDraft } from '../domain';
import { createScopeModel } from '../scope';
import { fixtureCustomer, fixtureDocument } from '../test/fixtures';
import { planAnalysis } from './heuristicAnalyzer';
import { analyzeContextFor, blankCustomer } from './testKit';

const BANNED_FRAGMENTS: readonly string[] = ['undefined', 'null', 'NaN', '[object', 'N/A', 'lorem'];

function fixtureAnalysis() {
  return planAnalysis({ task: 'analyze-requirements', document: fixtureDocument(), customer: fixtureCustomer(), scenarioId: null });
}

function expectWellFormed(items: readonly ScopeItemDraft[]): void {
  const ids = new Set(items.map((item) => item.id));
  expect(ids.size).toBe(items.length);
  for (const item of items) {
    expect(isValidIdForKind(item.id, item.kind)).toBe(true);
    for (const relatedId of item.relatedIds) {
      expect(ids.has(relatedId)).toBe(true);
      expect(items.find((candidate) => candidate.id === relatedId)?.relatedIds).toContain(item.id);
    }
    for (const fragment of BANNED_FRAGMENTS) {
      expect(`${item.title} ${item.description}`).not.toContain(fragment);
    }
  }
}

describe('planAnalysis on the fixture document', () => {
  const output = fixtureAnalysis();
  const find = (id: string) => output.items.find((item) => item.id === id);

  it('passes the AI output schema unchanged', () => {
    expect(AnalysisOutputSchema.parse(output)).toEqual(output);
  });

  it('extracts customer-stated requirements of each kind with verified sources', () => {
    expect(find('BR_01')).toMatchObject({ kind: 'business', provenance: 'customer-stated', source: { lineStart: 3, sectionTitle: 'Business goals', verified: true } });
    expect(find('FR_01')).toMatchObject({ priority: 'High', source: { lineStart: 5, verified: true } });
    expect(find('FR_02')).toMatchObject({ priority: 'Medium', source: { lineStart: 6, verified: true } });
    expect(find('FR_03')).toMatchObject({ priority: 'Low', source: { lineStart: 8, verified: true } });
    expect(find('INT_01')).toMatchObject({ provenance: 'customer-stated', source: { lineStart: 7, sectionId: 'S2', verified: true } });
    expect(find('NFR_01')).toMatchObject({ source: { lineStart: 10, verified: true } });
    expect(find('SEC_01')).toMatchObject({ source: { lineStart: 11, quote: 'All personal data must be encrypted at rest and in transit and comply with GDPR.', verified: true } });
    expect(find('TECH_01')).toMatchObject({ title: 'Our team prefers Microsoft Azure', source: { lineStart: 13, verified: true } });
    expect(find('CON_01')).toMatchObject({ source: { lineStart: 13, quote: 'We need to go live before the annual renewal period', verified: true } });
  });

  it('raises a critical gap and question for the missing go-live date, linked to the constraint', () => {
    const gap = output.items.find((item) => item.kind === 'gap' && item.affectsInputs.includes('deliveryDeadline'));
    const question = output.items.find((item) => item.kind === 'question' && item.affectsInputs.includes('deliveryDeadline'));
    expect(gap).toMatchObject({ critical: true, priority: 'High', provenance: 'ai-inferred' });
    expect(question).toMatchObject({ critical: true, title: 'What is the target go-live date?' });
    expect(gap?.relatedIds).toEqual(expect.arrayContaining([question?.id, 'CON_01']));
  });

  it('does not ask for information the text already states', () => {
    const inputs = output.items.flatMap((item) => item.affectsInputs);
    expect(inputs).not.toContain('expectedUsers');
    expect(inputs).not.toContain('complianceScope');
    expect(inputs).not.toContain('targetRegions');
  });

  it('links integration, existing system, dependency, gap and question', () => {
    const integration = find('INT_01');
    const related = (integration?.relatedIds ?? []).map((id) => find(id)?.kind);
    expect(related).toEqual(expect.arrayContaining(['existingSystem', 'dependency', 'gap', 'question', 'assumption']));
    expect(find('DEP_01')?.title).toBe('Salesforce API access and sandbox');
  });

  it('labels every item with a provenance consistent with its origin', () => {
    for (const item of output.items) {
      if (item.provenance === 'customer-stated') {
        expect(item.source?.verified).toBe(true);
      }
      if (item.kind === 'persona' || item.kind === 'risk' || item.kind === 'dependency') {
        expect(item.provenance).toBe('ai-inferred');
      }
      if (item.kind === 'assumption') {
        expect(item.provenance).toBe('assumed');
      }
    }
  });

  it('produces unique, well-formed IDs and bidirectional related IDs', () => {
    expectWellFormed(output.items);
  });

  it('summarises the customer, the counts, the themes and the open points', () => {
    expect(output.summary).toContain('Northwind Mutual');
    expect(output.summary).toContain('3 functional requirements (FR)');
    expect(output.summary).toContain('Main themes:');
    expect(output.summary).toMatch(/\d+ information gaps \(\d+ critical to estimation\)/);
  });

  it('is deterministic', () => {
    expect(fixtureAnalysis()).toEqual(output);
  });
});

describe('planAnalysis on arbitrary input', () => {
  it('handles a one-line input with a requirement, gaps and questions', () => {
    const output = planAnalysis(analyzeContextFor(['We need a mobile app for our field technicians.']));
    expect(output.items.find((item) => item.kind === 'functional')).toMatchObject({ provenance: 'customer-stated', source: { lineStart: 1, verified: true } });
    expect(output.items.filter((item) => item.kind === 'gap').length).toBeGreaterThanOrEqual(3);
    expect(output.items.some((item) => item.kind === 'assumption' && item.title === 'Mobile access interpreted as responsive web')).toBe(true);
    expect(output.summary).toContain('The customer');
    expectWellFormed(output.items);
    expect(() => AnalysisOutputSchema.parse(output)).not.toThrow();
  });

  it('keeps non-Latin text as grounded requirements instead of crashing', () => {
    const output = planAnalysis(analyzeContextFor(['系统必须支持单点登录。用户应该能够下载报告。', 'Система должна работать круглосуточно.']));
    const requirements = output.items.filter((item) => item.kind === 'functional');
    expect(requirements).toHaveLength(3);
    expect(requirements.every((item) => item.source?.verified === true && item.provenance === 'customer-stated')).toBe(true);
    expectWellFormed(output.items);
    expect(() => AnalysisOutputSchema.parse(output)).not.toThrow();
  });

  it('still returns a valid analysis for an empty or heading-only document', () => {
    for (const lines of [[], ['# Requirements', '## Scope']]) {
      const output = planAnalysis(analyzeContextFor(lines));
      expect(output.items.length).toBeGreaterThan(0);
      expect(output.summary).toContain('no classifiable requirements');
      expect(() => AnalysisOutputSchema.parse(output)).not.toThrow();
    }
  });

  it('copes with a very long RFP and de-duplicates repeated statements', () => {
    const lines = Array.from({ length: 1200 }, (_, index) => `${index + 1}. The platform must provide capability number ${index % 300} for members.`);
    const output = planAnalysis(analyzeContextFor(lines));
    expect(output.items.filter((item) => item.kind === 'functional')).toHaveLength(300);
    expectWellFormed(output.items);
  });

  it('produces materially different output for different inputs', () => {
    const portal = planAnalysis(analyzeContextFor(['Members must be able to pay invoices online via Stripe.'], blankCustomer({ customerName: 'Acme' })));
    const data = planAnalysis(analyzeContextFor(['We must migrate the legacy data warehouse to Snowflake.'], blankCustomer({ customerName: 'Acme' })));
    expect(portal.items.map((item) => item.title)).not.toEqual(data.items.map((item) => item.title));
    expect(portal.summary).not.toBe(data.summary);
  });

  it('starts labelled requirements the customer excludes or defers past go-live as excluded and Low priority', () => {
    const output = planAnalysis(
      analyzeContextFor([
        'BR1. The portal must reduce call-centre volume by 30%.',
        'BR2. A partner self-service area could follow, though that is out of scope for this phase.',
        'BR3. The portal must later offer a loyalty scheme, but that is not required for go-live.',
      ]),
    );
    const scope = createScopeModel(output.summary, output.items);
    const byId = (id: string) => scope.items.find((item) => item.id === id);
    expect(byId('BR_01')).toMatchObject({ inScope: true, priority: 'High' });
    expect(byId('BR_02')).toMatchObject({ inScope: false, priority: 'Low' });
    expect(byId('BR_03')).toMatchObject({ inScope: false, priority: 'Low' });
    expect(scope.issues.map((issue) => issue.refs)).toEqual([['BR_02'], ['BR_03']]);
  });
});
