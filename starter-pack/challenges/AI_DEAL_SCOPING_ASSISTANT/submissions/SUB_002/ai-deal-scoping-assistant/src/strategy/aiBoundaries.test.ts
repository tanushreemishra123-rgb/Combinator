import type { AiUseCase, ScopeItem } from '../domain';
import { fixtureScope } from '../test/fixtures';
import { buildProcessingBoundaries } from './aiBoundaries';

/** Clones a real fixture item so every ScopeItem field is populated, then overrides what the test cares about. */
function reqItem(overrides: Partial<ScopeItem>): ScopeItem {
  const base = fixtureScope().items.find((item) => item.id === 'FR_01');
  if (base === undefined) {
    throw new Error('fixture scope no longer contains FR_01');
  }
  return { ...base, ...overrides };
}

function useCase(overrides: Partial<AiUseCase>): AiUseCase {
  return {
    id: 'AIUC_01',
    name: 'AI policy assistant',
    description: 'Retrieval-augmented generation (RAG) assistant delivering FR_03.',
    requirementIds: ['FR_03'],
    pattern: 'Retrieval-augmented generation (RAG) assistant',
    modelOptions: [],
    retrieval: '',
    orchestration: '',
    evaluation: '',
    safety: '',
    privacy: '',
    humanReview: 'The assistant answers informational questions only; any answer touching a binding decision is withheld and routed to a human.',
    monitoring: '',
    complexity: 'High',
    ...overrides,
  };
}

describe('buildProcessingBoundaries deterministic rationale', () => {
  it('gives a payment activity and a search activity different, activity-specific reasons', () => {
    const payment = reqItem({ id: 'FR_10', title: 'Post payment to ledger', signals: ['capability:payments'] });
    const search = reqItem({ id: 'FR_11', title: 'Search the member directory', signals: ['capability:search'] });
    const rows = buildProcessingBoundaries([payment, search], []);
    const paymentReason = rows.find((row) => row.activity === 'Post payment to ledger')?.reason;
    const searchReason = rows.find((row) => row.activity === 'Search the member directory')?.reason;
    expect(paymentReason).toBeDefined();
    expect(searchReason).toBeDefined();
    expect(paymentReason).not.toBe(searchReason);
    expect(paymentReason).toContain('accounting rules');
    expect(searchReason).toContain('search index');
  });

  it('never repeats the exact same generic fallback sentence twice when several items carry no recognised signal', () => {
    const first = reqItem({ id: 'FR_10', title: 'Unclassified activity one', signals: [] });
    const second = reqItem({ id: 'FR_11', title: 'Unclassified activity two', signals: [] });
    const third = reqItem({ id: 'FR_12', title: 'Unclassified activity three', signals: [] });
    const rows = buildProcessingBoundaries([first, second, third], []);
    const reasons = rows.map((row) => row.reason);
    expect(new Set(reasons).size).toBeGreaterThan(1);
    // The very first generic fallback sentence appears at most once.
    const firstFallbackCount = reasons.filter((reason) => reason === reasons.at(0)).length;
    expect(firstFallbackCount).toBe(1);
  });

  it('reasons from the activity its title names, not from a neighbouring system the description merely mentions', () => {
    const timeline = reqItem({ id: 'FR_03', title: 'Consolidated claim timeline', description: 'Display a timeline combining claim activity and SAP payment postings.', signals: ['capability:payments'] });
    const row = buildProcessingBoundaries([timeline], []).at(0);
    expect(row?.reason).not.toContain('GL codes');
    expect(row?.reason).toContain('"Consolidated claim timeline" is fully specified by FR_03');
  });

  it('an integration activity gets an integration-specific reason distinct from a capability-driven one', () => {
    const erpIntegration = reqItem({ id: 'INT_01', kind: 'integration', title: 'Post to ERP', signals: ['integration:erp'] });
    const rows = buildProcessingBoundaries([erpIntegration], []);
    expect(rows.at(0)?.reason).toContain('ERP');
  });
});

describe('buildProcessingBoundaries human-decision rationale', () => {
  it('cites the compliance regulation and requirement id that requires the sign-off when the use case evidence names one', () => {
    const hipaaItem = reqItem({
      id: 'SEC_01',
      kind: 'security',
      title: 'HIPAA compliance',
      description: 'A clinician must review and approve every output before it is acted on, per our HIPAA obligations.',
      signals: ['compliance:hipaa'],
      provenance: 'customer-stated',
    });
    const rag = useCase({ requirementIds: ['SEC_01'] });
    const rows = buildProcessingBoundaries([hipaaItem], [rag]);
    const humanRow = rows.find((row) => row.type === 'human-decision');
    expect(humanRow?.reason).toContain('HIPAA');
    expect(humanRow?.reason).toContain('SEC_01');
  });

  it('falls back to the pattern’s own human-review sentence when no cited requirement names a regulation or customer statement', () => {
    const inferredItem = reqItem({ id: 'GAP_01', kind: 'gap', title: 'Unresolved gap', signals: [], provenance: 'ai-inferred' });
    const rag = useCase({ requirementIds: ['GAP_01'] });
    const rows = buildProcessingBoundaries([inferredItem], [rag]);
    const humanRow = rows.find((row) => row.type === 'human-decision');
    expect(humanRow?.reason).toBe(rag.humanReview);
  });

  it('never cites a business or technology item as the authority for a sign-off when its own wording names no review, approval or sign-off step, even if it carries a compliance signal', () => {
    const techPreference = reqItem({
      id: 'TECH_02',
      kind: 'business',
      title: 'Managed AI/ML service preference',
      description: 'We are open to a managed AI/ML service for extraction and the assistant, as long as it meets our HIPAA requirements.',
      signals: ['compliance:hipaa'],
      provenance: 'customer-stated',
    });
    const rag = useCase({ requirementIds: ['TECH_02'] });
    const rows = buildProcessingBoundaries([techPreference], [rag]);
    const humanRow = rows.find((row) => row.type === 'human-decision');
    expect(humanRow?.reason).toBe(rag.humanReview);
    expect(humanRow?.reason).not.toContain('required by');
  });

  it('never cites an unrelated business goal as the authority for a sign-off merely because it is a customer-stated business item', () => {
    const forecastGoal = reqItem({
      id: 'BR_03',
      kind: 'business',
      title: 'Two-week-ahead stockout forecasting',
      description: 'The platform should let planners forecast depot-level stockouts at least two weeks in advance.',
      signals: [],
      provenance: 'customer-stated',
    });
    const rag = useCase({ requirementIds: ['BR_03'] });
    const rows = buildProcessingBoundaries([forecastGoal], [rag]);
    const humanRow = rows.find((row) => row.type === 'human-decision');
    expect(humanRow?.reason).toBe(rag.humanReview);
    expect(humanRow?.reason).not.toContain('required by');
  });
});

describe('buildProcessingBoundaries human decisions stated outside an AI use case', () => {
  it('routes a mandatory clerk review requirement to human-decision instead of deterministic', () => {
    const clerkReview = reqItem({
      id: 'FR_03',
      title: 'Mandatory clerk review before write-back',
      description: 'Present each extracted document to a medical records clerk for review and correction before anything is written to Epic.',
      signals: [],
    });
    const rows = buildProcessingBoundaries([clerkReview], []);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe('human-decision');
    expect(rows[0]?.reason).toContain('FR_03');
    expect(rows[0]?.reason).toContain('for review and correction');
  });

  it('routes a data-steward correction workflow to human-decision', () => {
    const stewardWorkflow = reqItem({
      id: 'FR_07',
      title: 'Data-steward correction workflow',
      description: 'Data stewards see and correct records that fail data-quality validation before they reach reporting layers.',
      signals: [],
    });
    const rows = buildProcessingBoundaries([stewardWorkflow], []);
    expect(rows.at(0)?.type).toBe('human-decision');
  });

  it('routes an SIU-review flagging requirement to human-decision', () => {
    const siuFlagging = reqItem({
      id: 'FR_09',
      title: 'SIU flagging with automatic notification',
      description: 'Let examiners flag a claim for special-investigation-unit review, notifying the SIU team automatically.',
      signals: [],
    });
    const rows = buildProcessingBoundaries([siuFlagging], []);
    expect(rows.at(0)?.type).toBe('human-decision');
  });

  it('leaves an unrelated integration that merely mentions stewarding in passing as deterministic', () => {
    const oktaForStewardTooling = reqItem({
      id: 'INT_05',
      kind: 'integration',
      title: 'Okta staff authentication for Looker',
      description: 'Integrate with the existing Okta tenant for staff authentication into Looker and any data-steward tooling.',
      signals: [],
    });
    const rows = buildProcessingBoundaries([oktaForStewardTooling], []);
    expect(rows.at(0)?.type).toBe('deterministic');
  });

  it('leaves an "approved" posting activity that names no reviewer as deterministic', () => {
    const posting = reqItem({
      id: 'INT_02',
      kind: 'integration',
      title: 'SAP S/4HANA payment-posting integration',
      description: 'Integrate with SAP S/4HANA to post approved claim payments as finance journal entries.',
      signals: [],
    });
    const rows = buildProcessingBoundaries([posting], []);
    expect(rows.at(0)?.type).toBe('deterministic');
  });
});

describe('buildProcessingBoundaries table shape', () => {
  it('produces one ai row and one human-decision row per use case, plus one deterministic row per non-AI functional/integration item', () => {
    const functionalNonAi = reqItem({ id: 'FR_20', title: 'Deterministic activity', signals: [] });
    const rows = buildProcessingBoundaries([functionalNonAi], [useCase({})]);
    expect(rows.filter((row) => row.type === 'ai')).toHaveLength(1);
    expect(rows.filter((row) => row.type === 'human-decision')).toHaveLength(1);
    expect(rows.filter((row) => row.type === 'deterministic')).toHaveLength(1);
  });
});
