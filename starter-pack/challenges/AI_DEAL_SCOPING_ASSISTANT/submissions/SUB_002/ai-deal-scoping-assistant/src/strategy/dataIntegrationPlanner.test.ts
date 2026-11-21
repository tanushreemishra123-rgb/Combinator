import type { DataIntegrationContext } from '../ai/types';
import { DATA_TOPICS } from '../domain';
import { fixtureConfig, fixtureCustomer, fixtureScope } from '../test/fixtures';
import { planDataIntegration } from './dataIntegrationPlanner';
import { fixtureArchitectureDesign } from './testFixtures';

function context(overrides: Partial<DataIntegrationContext> = {}): DataIntegrationContext {
  const design = fixtureArchitectureDesign();
  return {
    task: 'plan-data-integration',
    scope: fixtureScope(),
    customer: fixtureCustomer(),
    config: fixtureConfig(),
    platform: design.platform,
    components: design.components,
    ...overrides,
  };
}

describe('planDataIntegration', () => {
  it('produces all ten fixed data topics', () => {
    const output = planDataIntegration(context());
    const topics = output.topics.map((topic) => topic.topic);
    expect(output.topics).toHaveLength(10);
    for (const topic of DATA_TOPICS) {
      expect(topics).toContain(topic);
    }
  });

  it('names a data domain from the reviewed data item, not a generic label', () => {
    const output = planDataIntegration(context());
    expect(output.domains).toHaveLength(1);
    expect(output.domains.at(0)?.name).toBe('Member and policy document data');
    expect(output.domains.at(0)?.classification).toBe('regulated');
    expect(output.domains.at(0)?.requirementIds).toEqual(['DATA_01']);
  });

  it('falls back to one honest placeholder domain when no data item is reviewed', () => {
    const scope = fixtureScope();
    scope.items = scope.items.filter((item) => item.kind !== 'data');
    const output = planDataIntegration(context({ scope }));
    expect(output.domains).toHaveLength(1);
    expect(output.domains.at(0)?.name).not.toBe('');
  });

  it('produces one integration per reviewed integration item, resolving componentIds against the design', () => {
    const output = planDataIntegration(context());
    const salesforce = output.integrations.find((integration) => integration.id === 'IF_01');
    expect(salesforce).toBeDefined();
    expect(salesforce?.system).toBe('Salesforce CRM');
    // A named third-party SaaS platform is external even when the customer already runs their own instance of it.
    expect(salesforce?.systemType).toBe('external');
    expect(salesforce?.pattern).toBe('event');
    expect(salesforce?.componentIds).toContain('ARC_06');
    // GAP_01 (affectsInputs: integrationReadiness) relates to INT_01, so readiness stays honest.
    expect(salesforce?.readiness).toBe('unknown');
    expect(salesforce?.requirementIds).toEqual(expect.arrayContaining(['INT_01']));
  });

  it('adds an integration entry for an existing system no integration item references', () => {
    const scope = fixtureScope();
    scope.items.push({
      id: 'SYS_02',
      kind: 'existingSystem',
      title: 'Legacy Billing Mainframe',
      description: 'A legacy mainframe holds billing records.',
      priority: 'Medium',
      provenance: 'customer-stated',
      source: null,
      relatedIds: [],
      affectsInputs: [],
      critical: false,
      signals: ['integration:legacy'],
      review: 'approved',
      inScope: true,
      userEdited: false,
      resolved: false,
      resolution: '',
    });
    const output = planDataIntegration(context({ scope }));
    const legacy = output.integrations.find((integration) => integration.system === 'Legacy Billing Mainframe');
    expect(legacy).toBeDefined();
    expect(legacy?.complexity).toBe('High');
    expect(legacy?.name).toContain('Legacy Billing Mainframe');
  });

  it('excludes an existing system the customer says is being replaced, and does not flow it into any data store', () => {
    const scope = fixtureScope();
    scope.items.push({
      id: 'SYS_03',
      kind: 'existingSystem',
      title: 'Legacy Member Portal',
      description: 'The current member portal, being replaced by this program.',
      priority: 'Medium',
      provenance: 'customer-stated',
      source: null,
      relatedIds: [],
      affectsInputs: [],
      critical: false,
      signals: [],
      review: 'approved',
      inScope: true,
      userEdited: false,
      resolved: false,
      resolution: '',
    });
    const output = planDataIntegration(context({ scope }));
    expect(output.integrations.some((integration) => integration.system === 'Legacy Member Portal')).toBe(false);
    expect(output.flows.some((flow) => flow.from === 'Legacy Member Portal' || flow.to === 'Legacy Member Portal')).toBe(false);
  });

  it('changes topic approach text when the architecture component service changes', () => {
    const outputBefore = planDataIntegration(context());
    const storageTopicBefore = outputBefore.topics.find((topic) => topic.topic === 'transactional-storage');
    expect(storageTopicBefore?.approach).toContain('Azure SQL Database');

    const design = fixtureArchitectureDesign();
    const swapped = design.components.map((c) => (c.id === 'ARC_04' ? { ...c, service: 'Azure Cosmos DB' } : c));
    const outputAfter = planDataIntegration(context({ components: swapped }));
    const storageTopicAfter = outputAfter.topics.find((topic) => topic.topic === 'transactional-storage');
    expect(storageTopicAfter?.approach).toContain('Azure Cosmos DB');
    expect(storageTopicAfter?.approach).not.toContain('Azure SQL Database');
  });

  it('is deterministic for the same input', () => {
    const first = planDataIntegration(context());
    const second = planDataIntegration(context());
    expect(second).toEqual(first);
  });

  it('never crashes on an empty scope and still returns every topic', () => {
    const scope = fixtureScope();
    scope.items = [];
    const output = planDataIntegration(context({ scope }));
    expect(output.topics).toHaveLength(10);
    expect(output.integrations).toEqual([]);
  });
});
