import type { EstimationInputKey, ScopeItemDraft } from '../domain';
import { planAnalysis } from './heuristicAnalyzer';
import { analyzeContextFor, blankCustomer } from './testKit';

const COMPLETE_BRIEF: readonly string[] = [
  'The portal must support 20,000 registered users across the UK and Ireland.',
  'Go-live is required by 30 September 2027 with a budget of $750,000.',
  'We need development, UAT and production environments.',
  'The portal must integrate with Salesforce through its documented REST API and a sandbox is available.',
  'Members must sign in with SSO through our Okta identity provider.',
  'We must migrate 2 million policy records and comply with GDPR.',
  'An AI assistant should answer policy questions; a labelled dataset of 5,000 historical tickets is already available.',
];

const THIN_BRIEF: readonly string[] = [
  'The portal must integrate with Salesforce.',
  'Members must sign in with SSO.',
  'We must migrate our policy records.',
  'An AI assistant should answer policy questions from our knowledge base.',
  'We need to go live before the renewal season.',
];

function itemsOfKind(items: readonly ScopeItemDraft[], kind: ScopeItemDraft['kind']): ScopeItemDraft[] {
  return items.filter((item) => item.kind === kind);
}

function gapInputs(items: readonly ScopeItemDraft[]): EstimationInputKey[] {
  return itemsOfKind(items, 'gap').flatMap((gap) => gap.affectsInputs);
}

describe('critical-information checklist', () => {
  it('raises no checklist gap when the text states every critical input', () => {
    const { items } = planAnalysis(analyzeContextFor(COMPLETE_BRIEF));
    expect(itemsOfKind(items, 'gap').map((gap) => gap.title)).toEqual([]);
    expect(itemsOfKind(items, 'question')).toEqual([]);
  });

  it('raises a gap and a linked question for every missing input', () => {
    const { items } = planAnalysis(analyzeContextFor(THIN_BRIEF));
    expect(new Set(gapInputs(items))).toEqual(
      new Set<EstimationInputKey>(['expectedUsers', 'deliveryDeadline', 'environments', 'integrationReadiness', 'dataVolume', 'complianceScope', 'aiDataAvailability', 'targetRegions']),
    );
    const gaps = itemsOfKind(items, 'gap');
    const questions = itemsOfKind(items, 'question');
    expect(questions).toHaveLength(gaps.length);
    for (const gap of gaps) {
      const question = questions.find((candidate) => gap.relatedIds.includes(candidate.id));
      expect(question?.relatedIds).toContain(gap.id);
      expect(question?.affectsInputs).toEqual(gap.affectsInputs);
      expect(question?.critical).toBe(gap.critical);
      expect(gap.provenance).toBe('ai-inferred');
    }
  });

  it('marks estimation-blocking gaps as critical and the rest as non-critical', () => {
    const { items } = planAnalysis(analyzeContextFor(THIN_BRIEF));
    const criticalByTitle = new Map(itemsOfKind(items, 'gap').map((gap) => [gap.title, gap.critical]));
    expect(criticalByTitle.get('Expected user volume not stated')).toBe(true);
    expect(criticalByTitle.get('Go-live date not stated')).toBe(true);
    expect(criticalByTitle.get('Interface readiness of Salesforce not stated')).toBe(true);
    expect(criticalByTitle.get('Data volume and migration size not stated')).toBe(true);
    expect(criticalByTitle.get('Availability and quality of AI source data not stated')).toBe(true);
    expect(criticalByTitle.get('Required environments not stated')).toBe(false);
    expect(criticalByTitle.get('Budget expectation not stated')).toBe(false);
  });

  it('only asks about AI data and the identity provider when AI and SSO are in scope', () => {
    const { items } = planAnalysis(analyzeContextFor(['Members must be able to download statements.']));
    const titles = itemsOfKind(items, 'gap').map((gap) => gap.title);
    expect(titles).not.toContain('Availability and quality of AI source data not stated');
    expect(titles).not.toContain('Identity provider for single sign-on not named');
    expect(titles).not.toContain('Data volume and migration size not stated');
  });

  it('treats the region from the customer context as stated', () => {
    const withRegion = planAnalysis(analyzeContextFor(THIN_BRIEF, blankCustomer({ region: 'EU' })));
    expect(gapInputs(withRegion.items)).not.toContain('targetRegions');
  });

  it('cites the triggering line for a gap that has one and links it to the affected items', () => {
    const { items } = planAnalysis(analyzeContextFor(THIN_BRIEF));
    const deadlineGap = items.find((item) => item.title === 'Go-live date not stated');
    const constraint = items.find((item) => item.kind === 'constraint');
    expect(deadlineGap?.source).toMatchObject({ lineStart: 5, verified: true });
    expect(deadlineGap?.relatedIds).toContain(constraint?.id);
    expect(constraint?.relatedIds).toContain(deadlineGap?.id);
  });

  it('does not repeat an input the customer already flagged as open', () => {
    const items = planAnalysis(analyzeContextFor(['We need a member portal.', 'The go-live date is not yet decided.'])).items;
    const deadlineGaps = items.filter((item) => item.kind === 'gap' && item.affectsInputs.includes('deliveryDeadline'));
    expect(deadlineGaps).toHaveLength(1);
    expect(deadlineGaps.at(0)).toMatchObject({ provenance: 'customer-stated', critical: true });
  });

  it('turns a customer-stated open point into a customer-stated gap plus a question', () => {
    const { items } = planAnalysis(analyzeContextFor(['The number of users is still TBD.', 'Can the portal work offline?']));
    const openPoints = itemsOfKind(items, 'gap').filter((gap) => gap.provenance === 'customer-stated');
    expect(openPoints).toHaveLength(2);
    expect(openPoints.at(0)).toMatchObject({ critical: true, affectsInputs: ['expectedUsers'] });
    expect(openPoints.at(0)?.source?.verified).toBe(true);
    const questionTitles = itemsOfKind(items, 'question').map((question) => question.title);
    expect(questionTitles).toContain('Can the portal work offline');
  });
});

describe('ambiguity assumptions', () => {
  it('records vague wording as an assumed working assumption linked to the requirement', () => {
    const { items } = planAnalysis(analyzeContextFor(['The portal must be fast, user friendly and scalable.']));
    const assumptions = itemsOfKind(items, 'assumption');
    expect(assumptions.map((assumption) => assumption.title)).toEqual([
      'Performance target interpreted as two-second response',
      'Usability expectation interpreted as WCAG 2.1 AA and tested journeys',
      'Scalability interpreted as three-fold growth headroom',
    ]);
    const requirement = items.find((item) => item.kind === 'nonFunctional');
    for (const assumption of assumptions) {
      expect(assumption.provenance).toBe('assumed');
      expect(assumption.description).toContain('Working assumption');
      expect(assumption.relatedIds).toContain(requirement?.id);
      expect(requirement?.relatedIds).toContain(assumption.id);
      expect(assumption.source?.verified).toBe(true);
    }
  });

  it('does not assume anything when the wording is quantified', () => {
    const { items } = planAnalysis(analyzeContextFor(['Pages must be fast: under 2 seconds for 5,000 concurrent users.']));
    expect(itemsOfKind(items, 'assumption')).toEqual([]);
  });
});
