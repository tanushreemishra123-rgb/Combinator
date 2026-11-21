import type { DataIntegrationContext } from '../ai/types';
import type { ArchitectureDesign, DataIntegrationOutput, IntegrationSpec } from '../domain';
import { fixtureConfig, fixtureCustomer, fixtureScope } from '../test/fixtures';
import { buildDataFlowDiagram } from './dataFlowDiagram';
import { planDataIntegration } from './dataIntegrationPlanner';
import { fixtureArchitectureDesign } from './testFixtures';

/** A minimal, valid IntegrationSpec so tests can focus on the one field under test. */
function integrationSpec(overrides: Partial<IntegrationSpec>): IntegrationSpec {
  return {
    id: 'IF_TEST',
    name: 'Test integration',
    system: 'Test System',
    systemType: 'external',
    direction: 'bidirectional',
    pattern: 'api',
    protocol: 'REST/JSON over HTTPS',
    authentication: 'API key in a request header.',
    errorHandling: 'Retried with backoff, then dead-lettered.',
    retry: 'Retried up to 3 times.',
    monitoring: 'Tracked in platform monitoring.',
    dataSync: '',
    requirementIds: [],
    componentIds: [],
    complexity: 'Medium',
    readiness: 'unknown',
    ...overrides,
  };
}

/** Three integrations citing the same source system, spelled with different case and whitespace. */
function planWithDuplicateSourceSystem(): DataIntegrationOutput {
  return {
    domains: [],
    topics: [],
    flows: [],
    integrations: [
      integrationSpec({ id: 'IF_01', name: 'Claims sync A', system: 'Guidewire ClaimCenter', requirementIds: ['INT_02'] }),
      integrationSpec({ id: 'IF_02', name: 'Claims sync B', system: 'guidewire claimcenter', requirementIds: ['INT_03'] }),
      integrationSpec({ id: 'IF_03', name: 'Claims sync C', system: ' Guidewire ClaimCenter ', requirementIds: ['INT_04'] }),
    ],
  };
}

function planFor(overrides: Partial<DataIntegrationContext> = {}) {
  const design = fixtureArchitectureDesign();
  const context: DataIntegrationContext = {
    task: 'plan-data-integration',
    scope: fixtureScope(),
    customer: fixtureCustomer(),
    config: fixtureConfig(),
    platform: design.platform,
    components: design.components,
    ...overrides,
  };
  return { plan: planDataIntegration(context), design };
}

describe('buildDataFlowDiagram', () => {
  it('has the five required tiers in order', () => {
    const { plan, design } = planFor();
    const diagram = buildDataFlowDiagram(plan, design);
    expect(diagram.tiers.map((tier) => tier.label)).toEqual(['Source Systems', 'Integration', 'Platform Data Stores', 'Analytics and AI', 'Consumers']);
  });

  it('places one source-system node and one integration node per integration, connected by an edge', () => {
    const { plan, design } = planFor();
    const diagram = buildDataFlowDiagram(plan, design);
    const sourceNode = diagram.nodes.find((node) => node.label === 'Salesforce CRM');
    const integrationNode = diagram.nodes.find((node) => node.label === 'Salesforce CRM profile sync');
    expect(sourceNode).toBeDefined();
    expect(integrationNode).toBeDefined();
    expect(diagram.edges.some((edge) => edge.from === sourceNode?.id && edge.to === integrationNode?.id)).toBe(true);
  });

  it('carries the platform data-storage components into the Platform Data Stores tier', () => {
    const { plan, design } = planFor();
    const diagram = buildDataFlowDiagram(plan, design);
    const storeNodes = diagram.nodes.filter((node) => node.tierId === 'data-stores');
    expect(storeNodes.map((node) => node.label)).toEqual(expect.arrayContaining(['Member Transactional Store', 'Analytics Warehouse']));
  });

  it('never crashes when there are no integrations, and still renders every tier', () => {
    const scope = fixtureScope();
    scope.items = scope.items.filter((item) => item.kind !== 'integration' && item.kind !== 'existingSystem');
    const { plan, design } = planFor({ scope });
    const diagram = buildDataFlowDiagram(plan, design);
    expect(diagram.tiers).toHaveLength(5);
    expect(diagram.nodes.filter((node) => node.tierId === 'source-systems')).toEqual([]);
  });

  it('is deterministic for the same input', () => {
    const { plan, design } = planFor();
    const first = buildDataFlowDiagram(plan, design);
    const second = buildDataFlowDiagram(plan, design);
    expect(second).toEqual(first);
  });
});

describe('buildDataFlowDiagram - source-system de-duplication', () => {
  it('merges source-system nodes that share a name (case-insensitive, trimmed) into one', () => {
    const design = fixtureArchitectureDesign();
    const diagram = buildDataFlowDiagram(planWithDuplicateSourceSystem(), design);

    const sourceNodes = diagram.nodes.filter((node) => node.tierId === 'source-systems');
    expect(sourceNodes).toHaveLength(1);
    expect(sourceNodes.at(0)?.label).toBe('Guidewire ClaimCenter');
  });

  it('unions the citing requirement ids of every merged integration, sorted and de-duplicated', () => {
    const design = fixtureArchitectureDesign();
    const diagram = buildDataFlowDiagram(planWithDuplicateSourceSystem(), design);

    const sourceNode = diagram.nodes.find((node) => node.tierId === 'source-systems');
    expect(sourceNode?.refs).toEqual(['INT_02', 'INT_03', 'INT_04']);
  });

  it('still draws one edge from the merged source node to each of its distinct integrations', () => {
    const design = fixtureArchitectureDesign();
    const diagram = buildDataFlowDiagram(planWithDuplicateSourceSystem(), design);

    const sourceNode = diagram.nodes.find((node) => node.tierId === 'source-systems');
    const integrationNodes = diagram.nodes.filter((node) => node.tierId === 'integration');
    expect(integrationNodes).toHaveLength(3);
    for (const integrationNode of integrationNodes) {
      expect(diagram.edges.some((edge) => edge.from === sourceNode?.id && edge.to === integrationNode.id)).toBe(true);
    }
  });
});

/** Adds an Object Storage data-storage component to the fixture design, for the file/batch store-routing tests. */
function designWithObjectStorage(): ArchitectureDesign {
  const design = fixtureArchitectureDesign();
  const objectStorage: ArchitectureDesign['components'][number] = {
    id: 'ARC_OS',
    name: 'Object Storage',
    area: 'data-storage',
    logicalComponent: 'object-storage',
    service: 'Blob Storage',
    requirementIds: [],
    assumptionIds: [],
    purpose: 'Object Storage implements the data-storage area of the solution.',
    rationale: 'Blob Storage is the managed service selected for object-storage on this platform.',
    tradeOffs: [],
    dependencies: [],
    securityConsiderations: [],
  };
  return { ...design, components: [...design.components, objectStorage] };
}

function planWith(integrations: IntegrationSpec[]): DataIntegrationOutput {
  return { domains: [], topics: [], flows: [], integrations };
}

describe('buildDataFlowDiagram - integration -> data-store edges (no Cartesian-product wiring)', () => {
  it('persists a plain API integration into exactly one store, not every store the platform has', () => {
    const design = fixtureArchitectureDesign();
    const diagram = buildDataFlowDiagram(planWith([integrationSpec({ id: 'IF_01', system: 'CRM' })]), design);
    const persistEdges = diagram.edges.filter((edge) => edge.label === 'persists');
    expect(persistEdges).toHaveLength(1);
  });

  it('draws no persistence edge at all for an authentication interface', () => {
    const design = fixtureArchitectureDesign();
    const diagram = buildDataFlowDiagram(
      planWith([integrationSpec({ id: 'IF_01', system: 'Okta', direction: 'inbound', protocol: 'OIDC/SAML federation (browser redirect) with Okta over HTTPS' })]),
      design,
    );
    const integrationNode = diagram.nodes.find((node) => node.tierId === 'integration');
    const storeIds = new Set(diagram.nodes.filter((node) => node.tierId === 'data-stores').map((node) => node.id));
    expect(diagram.edges.some((edge) => (edge.from === integrationNode?.id && storeIds.has(edge.to)) || (edge.to === integrationNode?.id && storeIds.has(edge.from)))).toBe(false);
  });

  it('draws no persistence edge at all for a notification interface', () => {
    const design = fixtureArchitectureDesign();
    const diagram = buildDataFlowDiagram(
      planWith([integrationSpec({ id: 'IF_01', system: 'Twilio', direction: 'outbound', dataSync: 'Twilio is a one-way delivery channel, so nothing is written back or reconciled from it.' })]),
      design,
    );
    const integrationNode = diagram.nodes.find((node) => node.tierId === 'integration');
    const storeIds = new Set(diagram.nodes.filter((node) => node.tierId === 'data-stores').map((node) => node.id));
    expect(diagram.edges.some((edge) => (edge.from === integrationNode?.id && storeIds.has(edge.to)) || (edge.to === integrationNode?.id && storeIds.has(edge.from)))).toBe(false);
  });

  it('reverses the edge to store -> integration ("feeds") for an outbound integration that reads from the store', () => {
    const design = fixtureArchitectureDesign();
    const diagram = buildDataFlowDiagram(planWith([integrationSpec({ id: 'IF_01', system: 'Reporting Feed', direction: 'outbound' })]), design);
    const integrationNode = diagram.nodes.find((node) => node.tierId === 'integration');
    const feedsEdge = diagram.edges.find((edge) => edge.label === 'feeds');
    expect(feedsEdge?.to).toBe(integrationNode?.id);
  });

  it('routes a file/batch integration into object storage when the design has one, not the relational store', () => {
    const design = designWithObjectStorage();
    const diagram = buildDataFlowDiagram(planWith([integrationSpec({ id: 'IF_01', system: 'Carrier Feed', pattern: 'file', direction: 'inbound' })]), design);
    const objectStoreNode = diagram.nodes.find((node) => node.label === 'Object Storage');
    const persistEdge = diagram.edges.find((edge) => edge.label === 'persists');
    expect(persistEdge?.to).toBe(objectStoreNode?.id);
  });

  it('marks the source -> integration edge as an "auth" edge for an identity interface', () => {
    const design = fixtureArchitectureDesign();
    const diagram = buildDataFlowDiagram(
      planWith([integrationSpec({ id: 'IF_01', system: 'Okta', direction: 'inbound', protocol: 'OIDC/SAML federation (browser redirect) with Okta over HTTPS' })]),
      design,
    );
    const sourceNode = diagram.nodes.find((node) => node.tierId === 'source-systems');
    const integrationNode = diagram.nodes.find((node) => node.tierId === 'integration');
    const edge = diagram.edges.find((candidate) => candidate.from === sourceNode?.id && candidate.to === integrationNode?.id);
    expect(edge?.kind).toBe('auth');
  });
});
