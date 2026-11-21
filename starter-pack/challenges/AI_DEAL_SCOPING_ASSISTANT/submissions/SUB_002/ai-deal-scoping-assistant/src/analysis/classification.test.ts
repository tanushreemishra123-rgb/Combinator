import type { ScopeItemKind } from '../domain';
import { classifyStatement } from './classification';
import type { Statement } from './segmentation';
import { normalizeForMatch } from './textMatch';

function statement(text: string, sectionTitle = '', label = ''): Statement {
  return { text, normalized: normalizeForMatch(text), lineNumber: 1, sectionId: 'S1', sectionTitle, label };
}

describe('classifyStatement', () => {
  const cases: readonly [string, ScopeItemKind][] = [
    ['Our objective is to increase online renewals by 20%.', 'business'],
    ['Members must be able to download their policy documents.', 'functional'],
    ['The platform must offer 99.9% uptime and sub-second latency.', 'nonFunctional'],
    ['We currently use a legacy AS/400 policy administration system.', 'existingSystem'],
    ['The portal must integrate with SAP for invoicing.', 'integration'],
    ['Ten years of claims history must be migrated and retained for seven years.', 'data'],
    ['All personal data must be encrypted and access controlled through RBAC.', 'security'],
    ['We are standardised on Microsoft Azure and .NET.', 'technology'],
    ['The budget is capped and go-live is fixed for Q3.', 'constraint'],
    ['Delivery depends on the CRM vendor providing sandbox access.', 'dependency'],
    ['We are worried about data quality in the old system.', 'risk'],
    ['We assume existing licences can be reused.', 'assumption'],
    ['The hosting region is to be confirmed.', 'gap'],
  ];

  it.each(cases)('classifies "%s" as %s', (text, kind) => {
    expect(classifyStatement(statement(text))?.kind).toBe(kind);
  });

  it('treats a literal customer question as a gap that needs an answer', () => {
    const result = classifyStatement(statement('Can the solution work offline?'));
    expect(result).toMatchObject({ kind: 'gap', isQuestion: true });
  });

  it('reports the cue that decided the classification', () => {
    expect(classifyStatement(statement('Delivery depends on vendor access.'))?.cue).toBe('depends on');
  });

  it('lets uncertainty outrank every other cue', () => {
    expect(classifyStatement(statement('The Salesforce integration approach is TBD.'))?.kind).toBe('gap');
  });

  it('keeps capability phrasing functional even when it mentions security terms', () => {
    expect(classifyStatement(statement('Members must be able to sign in with SSO.'))?.kind).toBe('functional');
  });

  it('classifies capability phrasing that synchronises systems as integration', () => {
    expect(classifyStatement(statement('Agents should be able to sync cases with ServiceNow.'))?.kind).toBe('integration');
  });

  it('needs a named technology before a preference becomes a technology item', () => {
    expect(classifyStatement(statement('Users prefer a simple layout and must see their orders.'))?.kind).toBe('functional');
  });

  it('uses the section heading when the statement has no cue of its own', () => {
    expect(classifyStatement(statement('Poor adoption by branch staff.', 'Risks and concerns'))?.kind).toBe('risk');
    expect(classifyStatement(statement('Branch staff onboarding wizard.', 'Functional requirements'))?.kind).toBe('functional');
  });

  it("honours the customer's own requirement label, except for open points", () => {
    expect(classifyStatement(statement('The portal must retain claim history for seven years.', '', 'FR'))).toMatchObject({ kind: 'functional', cue: 'customer label FR' });
    expect(classifyStatement(statement('Recovery time objective must be under 4 hours.', '', 'NFR'))?.kind).toBe('nonFunctional');
    expect(classifyStatement(statement('The archive approach is to be confirmed.', '', 'DATA'))?.kind).toBe('gap');
    expect(classifyStatement(statement('The portal must retain claim history for seven years.', '', 'XYZ'))?.kind).toBe('data');
  });

  it('reads discovery-note wording about undecided points as gaps', () => {
    expect(classifyStatement(statement('Nobody on the call could say how many active members there are.'))?.kind).toBe('gap');
    expect(classifyStatement(statement('No decision has been made on the hosting model.'))?.kind).toBe('gap');
  });

  it('falls back to functional for bare obligation wording', () => {
    expect(classifyStatement(statement('We need a quoting wizard.'))?.kind).toBe('functional');
  });

  it('returns null for background context, document metadata and non-Latin text', () => {
    expect(classifyStatement(statement('Northwind Mutual was founded in 1952.'))).toBeNull();
    expect(classifyStatement(statement('Attendees: Chief Compliance Officer, Head of Security'))).toBeNull();
    expect(classifyStatement(statement('システムは使いやすくなければなりません。'))).toBeNull();
  });
});
