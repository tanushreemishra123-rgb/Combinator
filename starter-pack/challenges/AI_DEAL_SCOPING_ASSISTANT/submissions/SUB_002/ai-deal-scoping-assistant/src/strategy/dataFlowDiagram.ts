/**
 * Renderer-neutral data-flow diagram (spec 4: "Data and integration diagram"): source systems feed
 * the integration layer, which lands in the specific platform data store it actually writes to (not
 * every store the platform happens to have), which feeds analytics/AI, which feeds consumers. Built
 * from the same plan and design the strategy and architecture already produced, so the diagram never
 * drifts from the text describing it. Wiring every integration to every store (a Cartesian product)
 * would not be a real data-flow design.
 */
import type { ArchitectureComponent, ArchitectureDesign, DataIntegrationOutput, DiagramEdge, DiagramModel, DiagramNode, IntegrationSpec } from '../domain';
import { findComponents } from './componentLookup';
import { isIdentityInterface, isNotificationInterface } from './integrationCatalog.data';

const TIER_SOURCE_SYSTEMS = 'source-systems';
const TIER_INTEGRATION = 'integration';
const TIER_DATA_STORES = 'data-stores';
const TIER_ANALYTICS_AI = 'analytics-ai';
const TIER_CONSUMERS = 'consumers';

function slug(prefix: string, name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return `${prefix}-${cleaned.length > 0 ? cleaned : 'node'}`;
}

const PATTERN_EDGE_KIND: ReadonlyMap<IntegrationSpec['pattern'], DiagramEdge['kind']> = new Map([
  ['api', 'request'],
  ['event', 'event'],
  ['batch', 'batch'],
  ['file', 'data'],
]);

/**
 * One node per distinct system name (case-insensitive, trimmed - `slug` already normalises both),
 * merging the requirement ids of every integration that cites it into a sorted, distinct union
 * instead of keeping only the first citing integration's refs and silently dropping the rest.
 */
function sourceSystemNodes(integrations: readonly IntegrationSpec[]): DiagramNode[] {
  const seen = new Map<string, DiagramNode>();
  for (const integration of integrations) {
    const id = slug('src', integration.system);
    const existing = seen.get(id);
    if (existing === undefined) {
      seen.set(id, {
        id,
        label: integration.system.trim(),
        sublabel: integration.systemType,
        tierId: TIER_SOURCE_SYSTEMS,
        refs: [...integration.requirementIds],
        external: integration.systemType === 'external',
      });
    } else {
      const refs = [...new Set([...existing.refs, ...integration.requirementIds])].sort();
      seen.set(id, { ...existing, refs });
    }
  }
  return Array.from(seen.values());
}

function integrationNodes(integrations: readonly IntegrationSpec[]): DiagramNode[] {
  return integrations.map((integration) => ({
    id: slug('int', integration.id),
    label: integration.name,
    sublabel: `${integration.pattern} - ${integration.protocol}`,
    tierId: TIER_INTEGRATION,
    refs: [...integration.requirementIds],
    external: false,
  }));
}

function componentNodes(design: ArchitectureDesign, area: 'data-storage' | 'ai-ml' | 'user-apps', tierId: string, prefix: string): DiagramNode[] {
  return findComponents(design.components, { areas: [area] }).map((component) => ({
    id: slug(prefix, component.id),
    label: component.name,
    sublabel: component.service,
    tierId,
    refs: [...component.requirementIds],
    external: false,
  }));
}

/** Fallback analytics node so the tier is never empty even when the design has no dedicated ai-ml component. */
function analyticsFallbackNode(plan: DataIntegrationOutput): DiagramNode | undefined {
  const reporting = plan.topics.find((topic) => topic.topic === 'reporting-analytics');
  if (reporting === undefined || reporting.services.length === 0) {
    return undefined;
  }
  return { id: slug('an', 'reporting-and-analytics'), label: 'Reporting and Analytics', sublabel: reporting.services.join(', '), tierId: TIER_ANALYTICS_AI, refs: [...reporting.requirementIds], external: false };
}

function edgesBetween(from: readonly DiagramNode[], to: readonly DiagramNode[], kind: DiagramEdge['kind'], label: string): DiagramEdge[] {
  const edges: DiagramEdge[] = [];
  for (const source of from) {
    for (const target of to) {
      edges.push({ from: source.id, to: target.id, label, kind });
    }
  }
  return edges;
}

function sourceToIntegrationEdges(integrations: readonly IntegrationSpec[]): DiagramEdge[] {
  return integrations.map((integration) => ({
    from: slug('src', integration.system),
    to: slug('int', integration.id),
    label: integration.direction,
    kind: isIdentityInterface(integration.protocol) ? 'auth' : PATTERN_EDGE_KIND.get(integration.pattern) ?? 'request',
  }));
}

const OBJECT_STORE_KEYWORDS = ['object storage', 'blob storage', 'object-storage', 'blob'];
const RELATIONAL_STORE_KEYWORDS = ['relational', 'transactional', 'primary'];

function storeText(component: ArchitectureComponent): string {
  return `${component.logicalComponent} ${component.name} ${component.service}`.toLowerCase();
}

function storeMatching(stores: readonly ArchitectureComponent[], keywords: readonly string[]): ArchitectureComponent | undefined {
  return stores.find((store) => keywords.some((keyword) => storeText(store).includes(keyword)));
}

/** The one store a pattern actually writes to: object storage for a file/batch drop, the primary relational store otherwise - never every store the platform happens to have. */
function primaryStoreFor(pattern: IntegrationSpec['pattern'], stores: readonly ArchitectureComponent[]): ArchitectureComponent | undefined {
  if (stores.length === 0) {
    return undefined;
  }
  if (pattern === 'file' || pattern === 'batch') {
    return storeMatching(stores, OBJECT_STORE_KEYWORDS) ?? storeMatching(stores, RELATIONAL_STORE_KEYWORDS) ?? stores.at(0);
  }
  return storeMatching(stores, RELATIONAL_STORE_KEYWORDS) ?? stores.at(0);
}

/** One persistence edge per integration into the specific store it writes to; none for an authentication or notification interface, which persist nothing. */
function integrationStoreEdges(integrations: readonly IntegrationSpec[], storeComponents: readonly ArchitectureComponent[], storeNodes: readonly DiagramNode[]): DiagramEdge[] {
  return integrations.flatMap((integration): DiagramEdge[] => {
    if (isIdentityInterface(integration.protocol) || isNotificationInterface(integration.dataSync)) {
      return [];
    }
    const store = primaryStoreFor(integration.pattern, storeComponents);
    const storeNode = store === undefined ? undefined : storeNodes.find((node) => node.id === slug('ds', store.id));
    if (storeNode === undefined) {
      return [];
    }
    const integrationNodeId = slug('int', integration.id);
    return integration.direction === 'outbound'
      ? [{ from: storeNode.id, to: integrationNodeId, label: 'feeds', kind: 'data' }]
      : [{ from: integrationNodeId, to: storeNode.id, label: 'persists', kind: 'data' }];
  });
}

/** Tiered Source Systems -> Integration -> Platform Data Stores -> Analytics and AI -> Consumers diagram. */
export function buildDataFlowDiagram(plan: DataIntegrationOutput, design: ArchitectureDesign): DiagramModel {
  const sources = sourceSystemNodes(plan.integrations);
  const integrations = integrationNodes(plan.integrations);
  const storeComponents = findComponents(design.components, { areas: ['data-storage'] });
  const dataStores = componentNodes(design, 'data-storage', TIER_DATA_STORES, 'ds');
  const analyticsComponents = componentNodes(design, 'ai-ml', TIER_ANALYTICS_AI, 'an');
  const analyticsFallback = analyticsComponents.length > 0 ? undefined : analyticsFallbackNode(plan);
  const analytics = analyticsFallback === undefined ? analyticsComponents : [...analyticsComponents, analyticsFallback];
  const consumers = componentNodes(design, 'user-apps', TIER_CONSUMERS, 'ux');

  const edges: DiagramEdge[] = [
    ...sourceToIntegrationEdges(plan.integrations),
    ...integrationStoreEdges(plan.integrations, storeComponents, dataStores),
    ...edgesBetween(dataStores, analytics, 'data', 'feeds'),
    ...edgesBetween(analytics, consumers, 'data', 'informs'),
  ];

  return {
    title: 'Data and Integration Flow',
    tiers: [
      { id: TIER_SOURCE_SYSTEMS, label: 'Source Systems' },
      { id: TIER_INTEGRATION, label: 'Integration' },
      { id: TIER_DATA_STORES, label: 'Platform Data Stores' },
      { id: TIER_ANALYTICS_AI, label: 'Analytics and AI' },
      { id: TIER_CONSUMERS, label: 'Consumers' },
    ],
    nodes: [...sources, ...integrations, ...dataStores, ...analytics, ...consumers],
    edges,
  };
}
