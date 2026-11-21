import { describe, expect, it } from 'vitest';
import type { Capability, PrdOutput, ScopeModel } from '../domain';
import { PRD_SECTION_IDS } from '../domain';
import { resolveItem } from '../scope';
import { fixtureCustomer, fixtureScope } from '../test/fixtures';
import { buildFunctionalScope, buildPrdBundle, buildPrdDocument } from './assemble';

const SPEC_SECTION_TITLES = [
  'Product or solution overview',
  'Business problem',
  'Business objectives',
  'Target users and personas',
  'User journeys or key workflows',
  'Functional requirements',
  'Non-functional requirements',
  'Integrations',
  'Dependencies',
  'Assumptions',
  'Risks',
  'Out-of-scope items',
  'Open questions',
  'Requirement traceability',
];

const CAPABILITY_A: Capability = {
  id: 'CAP_01',
  name: 'Identity, Sign-In and Profile Management',
  scope: 'Provide identity.',
  requirementIds: ['FR_01'],
  priority: 'High',
  dependencies: [],
  label: 'customer-requested',
  module: 'Platform Foundation',
  workstream: 'Identity and Access',
  deliveryPackage: 'Package 1 - Foundation',
  acceptance: [],
};

const CAPABILITY_B: Capability = { ...CAPABILITY_A, id: 'CAP_02', name: 'Search and Discovery', requirementIds: ['FR_02'], module: 'Application Experience', workstream: 'Core Product Experience' };
const CAPABILITY_C: Capability = { ...CAPABILITY_A, id: 'CAP_03', name: 'AI Conversational Assistant', requirementIds: ['FR_03'], module: 'AI Capabilities', workstream: 'AI and Machine Learning', deliveryPackage: 'Package 3 - AI Capabilities' };

function fixtureOutput(): PrdOutput {
  return {
    overview: [{ text: 'Overview statement.', refs: ['BR_01'], label: 'customer-requested' }],
    businessProblem: [{ text: 'Problem statement.', refs: ['BR_01'], label: 'customer-requested' }],
    journeys: [{ id: 'JNY_01', name: 'Member journey', persona: 'PER_01', steps: ['Step 1: does a thing.'], requirementIds: ['FR_01'] }],
    capabilities: [CAPABILITY_A, CAPABILITY_B, CAPABILITY_C],
    recommendedEnhancements: [],
    outOfScope: [{ text: 'Excluded item.', refs: [], label: 'out-of-scope' }],
  };
}

describe('buildPrdDocument', () => {
  it('produces the 14 sections in PRD_SECTION_IDS order with the spec titles', () => {
    const document = buildPrdDocument(fixtureOutput(), fixtureScope(), fixtureCustomer());
    expect(document.sections.map((section) => section.id)).toEqual(PRD_SECTION_IDS);
    expect(document.sections.map((section) => section.title)).toEqual(SPEC_SECTION_TITLES);
  });

  it('takes the narrative sections directly from the PrdOutput', () => {
    const output = fixtureOutput();
    const document = buildPrdDocument(output, fixtureScope(), fixtureCustomer());
    const overview = document.sections.find((section) => section.id === 'overview');
    expect(overview?.statements).toEqual(output.overview);
  });

  it('projects the functional-requirements section deterministically from the scope model, folding in data items', () => {
    const document = buildPrdDocument(fixtureOutput(), fixtureScope(), fixtureCustomer());
    const section = document.sections.find((section) => section.id === 'functionalRequirements');
    const refs = section?.statements.flatMap((statement) => statement.refs) ?? [];
    expect(refs).toEqual(expect.arrayContaining(['FR_01', 'FR_02', 'FR_03', 'DATA_01']));
    const fr01 = section?.statements.find((statement) => statement.refs.includes('FR_01'));
    expect(fr01?.text).toMatch(/^FR_\d+ - .+: .+/);
  });

  it('projects the non-functional-requirements section, folding in security items', () => {
    const document = buildPrdDocument(fixtureOutput(), fixtureScope(), fixtureCustomer());
    const section = document.sections.find((section) => section.id === 'nonFunctionalRequirements');
    const refs = section?.statements.flatMap((statement) => statement.refs) ?? [];
    expect(refs).toEqual(expect.arrayContaining(['NFR_01', 'NFR_02', 'SEC_01']));
  });

  it('projects the traceability section, listing which capabilities cover each requirement', () => {
    const document = buildPrdDocument(fixtureOutput(), fixtureScope(), fixtureCustomer());
    const section = document.sections.find((section) => section.id === 'traceability');
    const fr01 = section?.statements.find((statement) => statement.refs.includes('FR_01'));
    expect(fr01?.text).toContain('CAP_01');
    const nfr01 = section?.statements.find((statement) => statement.refs.includes('NFR_01'));
    expect(nfr01?.text).toContain('uncovered');
  });

  it('is deterministic for the same output and scope', () => {
    const output = fixtureOutput();
    const scope = fixtureScope();
    const customer = fixtureCustomer();
    expect(buildPrdDocument(output, scope, customer)).toEqual(buildPrdDocument(output, scope, customer));
  });

  it('returns a well-formed document for an empty scope, explaining an empty section instead of leaving it blank', () => {
    const empty: ScopeModel = { summary: '', items: [], version: 1, approvedAt: null, approvedVersion: null, issues: [] };
    const document = buildPrdDocument(fixtureOutput(), empty, fixtureCustomer());
    expect(document.sections).toHaveLength(14);
    const objectives = document.sections.find((section) => section.id === 'objectives')?.statements;
    expect(objectives).toHaveLength(1);
    expect(objectives?.at(0)?.text).toContain("did not state a business objective");
    expect(objectives?.at(0)?.text).not.toContain('No statements were generated');
  });

  it('shows an answered question and a validated assumption as settled, with the reviewer resolution', () => {
    const answered = resolveItem(fixtureScope(), 'Q_01', 'Okta is the identity provider.');
    const scope = resolveItem(answered, 'ASM_01', 'Confirmed by the customer on the discovery call.');
    const document = buildPrdDocument(fixtureOutput(), scope, fixtureCustomer());
    const statementFor = (sectionId: string, ref: string) =>
      document.sections.find((section) => section.id === sectionId)?.statements.find((statement) => statement.refs.includes(ref));
    expect(statementFor('openQuestions', 'Q_01')?.text).toContain('Answered: Okta is the identity provider.');
    expect(statementFor('openQuestions', 'Q_02')?.text).not.toContain('Answered');
    const assumption = statementFor('assumptions', 'ASM_01');
    expect(assumption?.text).toContain('Validated: Confirmed by the customer on the discovery call.');
    expect(assumption?.label).not.toBe('assumption-to-confirm');
  });

  it('cites an open gap or question that tracks why a requirement-listing section is empty', () => {
    const scope = fixtureScope();
    const noIntegrations: ScopeModel = {
      ...scope,
      items: scope.items
        .filter((item) => item.kind !== 'integration')
        .map((item) => (item.id === 'GAP_01' ? { ...item, signals: ['integration:crm'] } : item)),
    };
    const document = buildPrdDocument(fixtureOutput(), noIntegrations, fixtureCustomer());
    const integrations = document.sections.find((section) => section.id === 'integrations')?.statements;
    expect(integrations).toHaveLength(1);
    expect(integrations?.at(0)?.refs).toEqual(['GAP_01']);
    expect(integrations?.at(0)?.text).toContain('GAP_01');
    expect(integrations?.at(0)?.label).toBe('assumption-to-confirm');
  });

  it('says plainly that nothing tracks an empty section when no open gap or question relates to it either', () => {
    const scope = fixtureScope();
    const noIntegrationsOrGaps: ScopeModel = { ...scope, items: scope.items.filter((item) => item.kind !== 'integration' && item.kind !== 'gap') };
    const document = buildPrdDocument(fixtureOutput(), noIntegrationsOrGaps, fixtureCustomer());
    const integrations = document.sections.find((section) => section.id === 'integrations')?.statements;
    expect(integrations).toHaveLength(1);
    expect(integrations?.at(0)?.refs).toEqual([]);
    expect(integrations?.at(0)?.text).toContain('confirmed empty');
    expect(integrations?.at(0)?.label).toBe('ai-interpretation');
  });
});

describe('buildFunctionalScope', () => {
  it('groups capabilities into modules and workstreams', () => {
    const functionalScope = buildFunctionalScope(fixtureOutput());
    const moduleNames = functionalScope.modules.map((group) => group.name);
    expect(moduleNames).toEqual(expect.arrayContaining(['Platform Foundation', 'Application Experience', 'AI Capabilities']));
    const aiModule = functionalScope.modules.find((group) => group.name === 'AI Capabilities');
    expect(aiModule?.capabilityIds).toEqual(['CAP_03']);
  });

  it('builds a delivery package per unique deliveryPackage with an engagement model and a QA challenge type', () => {
    const functionalScope = buildFunctionalScope(fixtureOutput());
    expect(functionalScope.deliveryPackages.length).toBeGreaterThan(0);
    for (const plan of functionalScope.deliveryPackages) {
      expect(plan.suggestedChallengeTypes).toContain('QA / bug hunt');
      expect(['topcoder-challenge-series', 'dedicated-team', 'blended']).toContain(plan.engagementModel);
    }
    const aiPackage = functionalScope.deliveryPackages.find((plan) => plan.name === 'Package 3 - AI Capabilities');
    expect(aiPackage?.suggestedChallengeTypes).toContain('Data science challenge');
    expect(aiPackage?.engagementModel).toBe('dedicated-team');
  });

  it('carries recommendedEnhancements and outOfScope through unchanged', () => {
    const output = fixtureOutput();
    const functionalScope = buildFunctionalScope(output);
    expect(functionalScope.recommendedEnhancements).toBe(output.recommendedEnhancements);
    expect(functionalScope.outOfScope).toEqual(output.outOfScope);
  });
});

describe('buildPrdBundle', () => {
  it('combines the PRD document and functional scope', () => {
    const bundle = buildPrdBundle(fixtureOutput(), fixtureScope(), fixtureCustomer());
    expect(bundle.prd.sections).toHaveLength(14);
    expect(bundle.functionalScope.capabilities).toHaveLength(3);
  });
});
