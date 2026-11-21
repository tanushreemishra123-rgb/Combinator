import type { ScopeItemDraft } from '../domain';
import { planAnalysis } from './heuristicAnalyzer';
import { MAX_IMPLIED_CAPABILITIES } from './impliedCapabilities';
import { analyzeContextFor } from './testKit';

function inferredRequirements(lines: readonly string[]): ScopeItemDraft[] {
  return planAnalysis(analyzeContextFor(lines)).items.filter((item) => item.kind === 'functional' && item.provenance === 'ai-inferred');
}

describe('implied capability inference', () => {
  it('infers a functional requirement for a capability only an integration statement mentions', () => {
    const inferred = inferredRequirements(['Payments through Stripe and appointment reminders via Twilio must be integrated.']);
    expect(inferred.map((item) => item.title)).toEqual(['Payments and billing', 'Notifications and alerts', 'Scheduling and booking']);
    const payments = inferred.at(0);
    expect(payments?.source).toMatchObject({ lineStart: 1, verified: true });
    expect(payments?.relatedIds).toEqual(['INT_01']);
    expect(payments?.description).toContain('INT_01 implies a payments and billing capability');
  });

  it('does not repeat a capability the customer already states as a functional requirement', () => {
    const inferred = inferredRequirements(['Members must be able to pay invoices online.', 'Payments must sync with Stripe nightly.']);
    expect(inferred).toEqual([]);
  });

  it('ignores the generic portal wording and caps the number of inferred items', () => {
    expect(inferredRequirements(['The portal must integrate with SAP.'])).toEqual([]);
    const busy = 'Integrate search, document upload, payments, notifications, dashboards, approval workflow, admin settings and mobile with SAP.';
    expect(inferredRequirements([busy]).length).toBe(MAX_IMPLIED_CAPABILITIES);
  });
});
