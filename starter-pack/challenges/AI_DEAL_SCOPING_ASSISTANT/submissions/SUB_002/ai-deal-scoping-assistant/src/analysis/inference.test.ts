import type { ScopeItemDraft } from '../domain';
import { planAnalysis } from './heuristicAnalyzer';
import { resolveSystemName } from './systemNames';
import { analyzeContextFor } from './testKit';
import { normalizeForMatch } from './textMatch';

function analyse(lines: readonly string[]): ScopeItemDraft[] {
  return planAnalysis(analyzeContextFor(lines)).items;
}

function byKind(items: readonly ScopeItemDraft[], kind: ScopeItemDraft['kind']): ScopeItemDraft[] {
  return items.filter((item) => item.kind === kind);
}

describe('persona inference', () => {
  it('derives personas from user nouns, cites the first mention and lists related requirements', () => {
    const items = analyse(['Patients must be able to book appointments.', 'Clinicians should be able to review bookings.', 'Patients must receive reminders.']);
    const personas = byKind(items, 'persona');
    expect(personas.map((persona) => persona.title)).toEqual(['Patient', 'Clinician']);
    const patient = personas.at(0);
    expect(patient?.provenance).toBe('ai-inferred');
    expect(patient?.source).toMatchObject({ lineStart: 1, verified: true });
    expect(patient?.relatedIds).toEqual(['FR_01', 'FR_03']);
    expect(patient?.description).toContain('FR_01, FR_03');
  });

  it('falls back to a generic end user only when no specific persona is named', () => {
    expect(byKind(analyse(['Users must be able to reset their password.']), 'persona').map((persona) => persona.title)).toEqual(['End user']);
    expect(byKind(analyse(['The platform must archive invoices nightly.']), 'persona')).toEqual([]);
  });
});

describe('system and dependency inference', () => {
  it('adds an access dependency and an existing system per integration, linked in both directions', () => {
    const items = analyse(['The portal must integrate with SAP for invoicing.', 'Orders must sync with SAP every hour.']);
    const [first, second] = byKind(items, 'integration');
    const systems = byKind(items, 'existingSystem');
    const dependencies = byKind(items, 'dependency');
    expect(systems.map((system) => system.title)).toEqual(['SAP']);
    expect(dependencies.map((dependency) => dependency.title)).toEqual(['SAP API access and sandbox', 'SAP API access and sandbox']);
    expect(dependencies.every((dependency) => dependency.provenance === 'ai-inferred' && dependency.source?.verified === true)).toBe(true);
    expect(first?.relatedIds).toEqual(expect.arrayContaining([dependencies.at(0)?.id, systems.at(0)?.id]));
    expect(second?.relatedIds).toEqual(expect.arrayContaining([dependencies.at(1)?.id, systems.at(0)?.id]));
    expect(systems.at(0)?.relatedIds).toEqual(expect.arrayContaining([first?.id, second?.id]));
    expect(dependencies.at(0)?.description).toContain(first?.id ?? 'missing');
  });

  it('covers every known system named in one integration statement', () => {
    const items = analyse(['Payments through Stripe and SMS reminders via Twilio must be integrated with the booking app.']);
    expect(byKind(items, 'existingSystem').map((system) => system.title)).toEqual(['Stripe', 'Twilio']);
    expect(byKind(items, 'dependency').map((dependency) => dependency.title)).toEqual(['Stripe API access and sandbox', 'Twilio API access and sandbox']);
  });

  it('names an unnamed counterpart after the integration requirement so items stay distinguishable', () => {
    const items = analyse(['The portal must integrate with other tools.']);
    expect(byKind(items, 'dependency').map((dependency) => dependency.title)).toEqual(['The INT_01 target system API access and sandbox']);
    expect(byKind(items, 'existingSystem')).toEqual([]);
  });

  it('re-uses an existing system the customer already described', () => {
    const items = analyse(['We currently use Workday for all HR records.', 'The app must integrate with Workday.']);
    const systems = byKind(items, 'existingSystem');
    expect(systems).toHaveLength(1);
    expect(systems.at(0)?.provenance).toBe('customer-stated');
    expect(systems.at(0)?.relatedIds).toContain(byKind(items, 'integration').at(0)?.id);
  });

  it('names systems from product names, proper nouns, then the signal label', () => {
    const statement = (text: string) => ({ text, normalized: normalizeForMatch(text), lineNumber: 1, sectionId: 'S0', sectionTitle: '', label: '' });
    expect(resolveSystemName(statement('Sync with our Salesforce CRM'), [])).toBe('Salesforce');
    expect(resolveSystemName(statement('Must integrate with our Acme Billing platform'), [])).toBe('Acme Billing');
    expect(resolveSystemName(statement('must integrate with the payroll system'), ['integration:api', 'integration:hr'])).toBe('the HR platform');
    expect(resolveSystemName(statement('must integrate with other tools'), [])).toBeUndefined();
  });
});

describe('risk inference', () => {
  it('derives signal-based risks that cite the trigger line and the related requirements', () => {
    const items = analyse([
      'The portal must integrate with our legacy mainframe.',
      'We must migrate ten years of claims history.',
      'A chatbot should answer member questions.',
      'The go-live deadline is fixed.',
      'The solution must comply with HIPAA.',
    ]);
    const risks = byKind(items, 'risk');
    expect(risks.map((risk) => risk.title)).toEqual([
      'Legacy integration complexity',
      'Data migration quality and cutover',
      'AI output quality depends on source data',
      'Fixed deadline compresses delivery',
      'Compliance obligations extend assurance effort',
    ]);
    for (const risk of risks) {
      expect(risk.provenance).toBe('ai-inferred');
      expect(risk.source?.verified).toBe(true);
      expect(risk.relatedIds.length).toBeGreaterThan(0);
      expect(risk.description).toContain('Mitigation:');
    }
    expect(risks.at(0)?.source?.lineStart).toBe(1);
    expect(risks.at(4)?.source?.lineStart).toBe(5);
  });

  it('infers no risk when no trigger signal is present', () => {
    expect(byKind(analyse(['Users must be able to update their address.']), 'risk')).toEqual([]);
  });
});
