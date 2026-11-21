import { EstimateSuggestionSchema } from '../domain';
import type { DriverSuggestion, EstimateSuggestion } from '../domain';
import { fixtureConfig, fixtureScope } from '../test/fixtures';
import { planEstimateInputs } from './inputPlanner';
import { findDoubleCountedDrivers } from './planner/doubleCounting';
import { emptyScope, estimateContext, fixtureIntegration } from './testing/estimateFixtures';
import { containsEffortOrCostFigure } from './validation';

function allDrivers(suggestion: EstimateSuggestion): DriverSuggestion[] {
  return suggestion.workstreams.flatMap((workstream) => workstream.drivers);
}

function driverByLabel(suggestion: EstimateSuggestion, label: string): DriverSuggestion {
  const found = allDrivers(suggestion).find((driver) => driver.label === label);
  if (found === undefined) {
    throw new Error(`Driver "${label}" was not planned`);
  }
  return found;
}

describe('planEstimateInputs - workstreams and phases', () => {
  const suggestion = planEstimateInputs(estimateContext());

  it('passes the same schema a live provider response must satisfy', () => {
    expect(EstimateSuggestionSchema.safeParse(suggestion).success).toBe(true);
  });

  it('maps workstreams to the build phases in order with sequential ids', () => {
    // CAP_03 "AI policy assistant" cites the same requirement (FR_03) as the AI use case "Policy
    // question answering", so rule 1 drops the capability driver and its now-empty workstream
    // disappears instead of pricing FR_03 twice (see planner/doubleCounting.ts).
    expect(suggestion.workstreams.map((workstream) => [workstream.id, workstream.name, workstream.phaseId])).toEqual([
      ['WS_01', 'Member Experience', 'PH_2'],
      ['WS_02', 'Security and Compliance', 'PH_2'],
      ['WS_03', 'Cloud Infrastructure and Hardening', 'PH_2'],
      ['WS_04', 'System Integration', 'PH_3'],
      ['WS_05', 'Data Platform and Migration', 'PH_3'],
      ['WS_06', 'AI Capabilities', 'PH_4'],
    ]);
    const ids = allDrivers(suggestion).map((driver) => driver.id);
    expect(ids).toEqual(ids.map((_, index) => `DRV_${String(index + 1).padStart(2, '0')}`));
    expect(allDrivers(suggestion).some((driver) => driver.label === 'AI policy assistant')).toBe(false);
  });

  it('never leaves two drivers in different workstreams pricing the identical set of ids', () => {
    expect(findDoubleCountedDrivers(suggestion)).toEqual([]);
  });

  it('states which security model was used, since only one of the two workstreams is planned', () => {
    expect(suggestion.explanation).toContain('security and compliance controls are estimated as their own workstream');
  });

  it('lists the requirements and skills of each workstream', () => {
    const integration = suggestion.workstreams.find((workstream) => workstream.name === 'System Integration');
    expect(integration?.requirementIds).toEqual(['INT_01']);
    expect(integration?.skills).toContain('Salesforce CRM interface expertise');
    const platform = suggestion.workstreams.find((workstream) => workstream.name === 'Cloud Infrastructure and Hardening');
    expect(platform?.skills.at(0)).toBe('Microsoft Azure infrastructure as code');
    expect(platform?.requirementIds).toEqual(expect.arrayContaining(['NFR_01', 'NFR_02']));
  });

  it('omits the AI phase when there are no AI use cases', () => {
    const withoutAi = planEstimateInputs(estimateContext({ aiUseCases: [] }));
    expect(withoutAi.workstreams.some((workstream) => workstream.phaseId === 'PH_4')).toBe(false);
  });

  it('never states effort, duration or cost figures', () => {
    const texts = [
      suggestion.explanation,
      ...allDrivers(suggestion).map((driver) => driver.rationale),
      ...suggestion.exclusions.map((note) => note.text),
      ...suggestion.assumptions.map((note) => note.text),
    ];
    expect(texts.filter(containsEffortOrCostFigure)).toEqual([]);
    expect(texts.join(' ')).not.toMatch(/undefined|null|NaN|\[object/);
  });

  it('is deterministic', () => {
    expect(planEstimateInputs(estimateContext())).toEqual(suggestion);
  });
});

describe('planEstimateInputs - driver complexity and rationale', () => {
  const suggestion = planEstimateInputs(estimateContext());

  it('scores capabilities from requirement count, priority and demanding signals', () => {
    const profile = driverByLabel(suggestion, 'Registration and profile');
    expect(profile.complexity).toBe('Medium');
    expect(profile.rationale).toBe('Medium complexity: covers 1 requirement (FR_01) at High priority.');
    expect(profile.refIds).toEqual(['CAP_01', 'FR_01']);
    const search = driverByLabel(suggestion, 'Policy document search');
    expect(search.rationale).toContain('demanding features (Search and discovery)');
  });

  it('reuses the reviewed complexity of integrations and AI use cases', () => {
    const sync = driverByLabel(suggestion, 'Salesforce CRM profile sync');
    expect(sync.type).toBe('integration');
    expect(sync.complexity).toBe('High');
    expect(sync.rationale).toContain('interface readiness is not yet confirmed');
    expect(sync.refIds).toEqual(['IS_01', 'INT_01', 'ARC_03']);
    const assistant = driverByLabel(suggestion, 'Policy question answering');
    expect(assistant.complexity).toBe('High');
    expect(assistant.refIds).toEqual(['AIUC_01', 'FR_03']);
  });

  it('groups security and compliance controls and raises regulated or high-priority groups', () => {
    const protection = driverByLabel(suggestion, 'Data protection and privacy controls');
    expect(protection.type).toBe('security');
    expect(protection.complexity).toBe('Medium');
    // DATA_01 is priced once, by its own "data" driver (see the next test); a data-kind item is
    // never also swept into a generic security/non-functional group, or its PII sensitivity would
    // be costed twice (once raising the data driver's own complexity, once here).
    expect(protection.refIds).toEqual(['SEC_01']);
    expect(driverByLabel(suggestion, 'Regulatory compliance evidence').rationale).toContain('GDPR');
    expect(driverByLabel(suggestion, 'Identity and access management').refIds).toEqual(['FR_01']);
  });

  it('never lets a data-kind item be priced by both its own driver and a generic security/non-functional group', () => {
    const data = driverByLabel(suggestion, 'Member and policy document data');
    expect(data.type).toBe('data');
    expect(data.refIds).toEqual(['DATA_01']);
    expect(allDrivers(suggestion).filter((entry) => entry.refIds.includes('DATA_01'))).toHaveLength(1);
    expect(findDoubleCountedDrivers(suggestion)).toEqual([]);
  });

  it('rates infrastructure from components, availability and expected-user bands', () => {
    const foundation = driverByLabel(suggestion, 'Cloud platform foundation and environments');
    expect(foundation.complexity).toBe('Medium');
    expect(foundation.rationale).toContain('3 architecture components on Microsoft Azure');
    expect(foundation.rationale).toContain('50,000 expected users');
    expect(foundation.refIds).toEqual(['ARC_01', 'ARC_02', 'ARC_03', 'NFR_01']);
    expect(driverByLabel(suggestion, 'Delivery pipeline and observability').complexity).toBe('Low');
  });

  it('says so when the expected number of users is unknown', () => {
    const unknown = planEstimateInputs(estimateContext({ config: fixtureConfig({ expectedUsers: null }) }));
    const foundation = driverByLabel(unknown, 'Cloud platform foundation and environments');
    expect(foundation.rationale).toContain('The expected number of users has not been provided');
    expect(foundation.complexity).toBe('Low');
  });

  it('creates non-functional hardening and data drivers from the scope signals', () => {
    expect(driverByLabel(suggestion, 'Availability and resilience hardening').complexity).toBe('Medium');
    expect(driverByLabel(suggestion, 'Performance and scalability hardening').refIds).toEqual(['NFR_02']);
    const data = driverByLabel(suggestion, 'Member and policy document data');
    expect(data.type).toBe('data');
    expect(data.complexity).toBe('Medium');
    expect(data.rationale).toContain('personal or sensitive data');
  });

  it('estimates integration requirements the strategy has not detailed yet', () => {
    const uncovered = planEstimateInputs(estimateContext({ integrations: [] }));
    const sync = driverByLabel(uncovered, 'Salesforce CRM profile sync');
    expect(sync.complexity).toBe('High');
    expect(sync.rationale).toContain('INT_01 is not yet detailed in the integration strategy');
  });
});

describe('planEstimateInputs - notes and edge cases', () => {
  it('derives estimation-specific risk, dependency and assumption notes instead of restating the reviewed items', () => {
    const suggestion = planEstimateInputs(estimateContext());
    expect(suggestion.risks.at(0)).toEqual({
      id: 'ER_01',
      text: 'RSK_01 is not priced as its own effort line; the estimate carries it through the workstream confidence rating instead of a dedicated cost, and the affected driver(s) must be revisited if it materialises.',
      refs: ['RSK_01'],
    });
    expect(suggestion.risks.map((note) => note.text).join(' ')).toContain('Critical open item CRM API readiness unknown (GAP_01) is unresolved');
    expect(suggestion.dependencies.at(0)?.id).toBe('ED_01');
    expect(suggestion.dependencies.at(0)?.text).toContain('DEP_01 is treated as a precondition');
    expect(suggestion.dependencies.map((note) => note.refs).flat()).toEqual(expect.arrayContaining(['DEP_01', 'SYS_01', 'Q_01', 'Q_02']));
    expect(suggestion.assumptions.at(0)?.text).toContain('still to be validated with the customer');
    expect(suggestion.assumptions.at(0)?.refs).toEqual(['ASM_01']);
    // Every note must add estimation-specific information, never just restate the item's own text.
    const noteTexts = [...suggestion.risks, ...suggestion.dependencies, ...suggestion.assumptions].map((note) => note.text);
    expect(noteTexts.some((text) => text.includes('Poorly structured policy documents may reduce AI answer quality'))).toBe(false);
  });

  it('lists standard exclusions, out-of-scope requirements and recommended enhancements', () => {
    const base = estimateContext();
    const scope = { ...base.scope, items: base.scope.items.map((item) => (item.id === 'FR_02' ? { ...item, inScope: false } : item)) };
    const enhancements = base.capabilities
      .slice(0, 1)
      .map((capability) => ({ ...capability, id: 'CAP_09', name: 'Proactive renewal reminders', label: 'recommended-enhancement' as const }));
    const suggestion = planEstimateInputs({ ...base, scope, capabilities: [...base.capabilities, ...enhancements] });
    const texts = suggestion.exclusions.map((note) => note.text).join(' ');
    expect(suggestion.exclusions.at(0)?.id).toBe('EX_01');
    expect(texts).toContain('licences');
    expect(texts).toContain('Hypercare');
    expect(texts).toContain('Policy document search and download (FR_02) is out of scope');
    expect(texts).toContain('Recommended enhancement CAP_09 Proactive renewal reminders is not estimated');
    expect(texts).toContain('Capability CAP_02 Policy document search is not estimated');
    expect(allDrivers(suggestion).some((driver) => driver.label === 'Proactive renewal reminders')).toBe(false);
  });

  it('skips the generic security workstream once a capability already delivers security work (rule 3)', () => {
    const base = estimateContext();
    const securityCapability = { ...base.capabilities[0], id: 'CAP_20', name: 'Multi-Factor Authentication', requirementIds: ['SEC_01'], workstream: 'Security Controls' } as (typeof base.capabilities)[number];
    const suggestion = planEstimateInputs({ ...base, capabilities: [...base.capabilities, securityCapability] });
    expect(suggestion.workstreams.some((workstream) => workstream.name === 'Security Controls')).toBe(true);
    expect(suggestion.workstreams.some((workstream) => workstream.name === 'Security and Compliance')).toBe(false);
    expect(suggestion.explanation).toContain('Security and compliance work is delivered through the named security capability');
    expect(findDoubleCountedDrivers(suggestion)).toEqual([]);
  });

  it('sizes and staffs capabilities of a security-named workstream as security controls', () => {
    const base = estimateContext();
    const securityCapability = { ...base.capabilities[0], id: 'CAP_20', name: 'Multi-Factor Authentication', requirementIds: ['SEC_01'], workstream: 'Security Controls' } as (typeof base.capabilities)[number];
    const suggestion = planEstimateInputs({ ...base, capabilities: [...base.capabilities, securityCapability] });
    const security = suggestion.workstreams.find((workstream) => workstream.name === 'Security Controls');
    expect(security?.drivers.map((driver) => [driver.label, driver.type])).toEqual([['Multi-Factor Authentication', 'security']]);
    const others = suggestion.workstreams.filter((workstream) => workstream.phaseId === 'PH_2' && workstream !== security);
    expect(others.flatMap((workstream) => workstream.drivers).some((driver) => driver.type === 'security')).toBe(false);
  });

  it('still returns a valid suggestion for an empty scope without deliverables', () => {
    const suggestion = planEstimateInputs(
      estimateContext({ scope: emptyScope(), capabilities: [], components: [], integrations: [], aiUseCases: [], config: fixtureConfig({ cloudPlatform: null }) }),
    );
    expect(EstimateSuggestionSchema.safeParse(suggestion).success).toBe(true);
    expect(suggestion.workstreams).toHaveLength(1);
    expect(allDrivers(suggestion).at(0)?.rationale).toContain('No architecture components have been generated');
  });

  it('flags integrations whose readiness is confirmed differently from unknown ones', () => {
    const confirmed = planEstimateInputs(estimateContext({ integrations: [fixtureIntegration({ readiness: 'confirmed' })], scope: fixtureScope() }));
    expect(driverByLabel(confirmed, 'Salesforce CRM profile sync').rationale).toContain('interface readiness is confirmed');
    expect(confirmed.risks.some((note) => note.text.startsWith('Interface readiness'))).toBe(false);
  });
});
