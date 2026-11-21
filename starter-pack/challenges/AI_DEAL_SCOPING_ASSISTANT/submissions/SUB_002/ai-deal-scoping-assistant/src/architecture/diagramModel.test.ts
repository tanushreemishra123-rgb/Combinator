import { describe, expect, it } from 'vitest';
import type { ArchitectureContext } from '../ai/types';
import type { ScopeItem, ScopeModel } from '../domain';
import { fixtureConfig, fixtureCustomer, fixtureScope } from '../test/fixtures';
import { CLOUD_SERVICE_CATALOG } from './catalog/cloudServiceCatalog.data';
import { buildArchitectureDiagram } from './diagramModel';
import { recommendPlatform } from './recommender';
import { planArchitecture } from './planner';

/** The named item from a fixture scope, or a clear failure if the fixture ever loses it. */
function findItem(scope: ScopeModel, id: string): ScopeItem {
  const found = scope.items.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`fixture scope is missing ${id}`);
  }
  return found;
}

/**
 * Three more integrations citing the same claims system as INT_01 cites Salesforce - spelled with
 * different case and surrounding whitespace, and split across a batch and a file-transfer style so
 * both the diagram's external-node merge (by trimmed, case-insensitive label) and its identical-edge
 * merge (same from/to/kind, labels joined) are exercised together.
 */
function scopeWithDuplicateExternalSystem(): ScopeModel {
  const base = fixtureScope();
  const template = findItem(base, 'INT_01');
  const citing = (id: string, title: string, signals: string[]): ScopeItem => ({
    ...template,
    id,
    title,
    description: `Synchronize claims data with ${title}.`,
    relatedIds: [],
    signals,
  });
  return {
    ...base,
    items: [
      ...base.items,
      citing('INT_02', 'Guidewire ClaimCenter', ['integration:batch']),
      citing('INT_03', 'guidewire claimcenter', ['integration:batch']),
      citing('INT_04', ' Guidewire ClaimCenter ', ['integration:file']),
    ],
  };
}

function buildDesign(overrides: Partial<ArchitectureContext> = {}) {
  const context: ArchitectureContext = {
    task: 'design-architecture',
    scope: fixtureScope(),
    customer: fixtureCustomer(),
    config: fixtureConfig(),
    platform: 'azure',
    catalog: [...CLOUD_SERVICE_CATALOG],
    capabilities: [],
    ...overrides,
  };
  const output = planArchitecture(context);
  const recommendation = recommendPlatform(context.scope, context.config);
  return { ...output, selection: 'user-selected' as const, recommendation };
}

describe('buildArchitectureDiagram', () => {
  it('declares the seven expected tiers, in order', () => {
    const diagram = buildArchitectureDiagram(buildDesign());
    expect(diagram.tiers.map((tier) => tier.label)).toEqual([
      'Users and Channels',
      'Edge and Security',
      'Application',
      'Integration and Messaging',
      'Data',
      'AI and ML',
      'Operations',
    ]);
  });

  it('creates one node per component, labelled with the component name and service sublabel', () => {
    const design = buildDesign();
    const diagram = buildArchitectureDiagram(design);
    const relationalDbNode = diagram.nodes.find((node) => node.label === 'Primary Relational Database');
    expect(relationalDbNode?.sublabel).toContain('Azure Database for PostgreSQL');
    expect(relationalDbNode?.external).toBe(false);
    expect(diagram.nodes.filter((node) => !node.external)).toHaveLength(design.components.length);
  });

  it('places every node id inside a declared tier', () => {
    const diagram = buildArchitectureDiagram(buildDesign());
    const tierIds = new Set(diagram.tiers.map((tier) => tier.id));
    for (const node of diagram.nodes) {
      expect(tierIds.has(node.tierId), node.id).toBe(true);
    }
  });

  it('renders the external CRM system as an external node with a human-readable label', () => {
    const diagram = buildArchitectureDiagram(buildDesign());
    const external = diagram.nodes.filter((node) => node.external);
    expect(external.length).toBeGreaterThan(0);
    expect(external.some((node) => node.label.includes('Salesforce'))).toBe(true);
    expect(external.every((node) => node.refs.length > 0)).toBe(true);
  });

  it('creates one edge per flow, preserving label and kind', () => {
    const design = buildDesign();
    const diagram = buildArchitectureDiagram(design);
    expect(diagram.edges).toHaveLength(design.flows.length);
    expect(diagram.edges.at(0)).toEqual(design.flows.at(0));
  });

  it('titles the diagram with the platform', () => {
    const diagram = buildArchitectureDiagram(buildDesign({ platform: 'gcp' }));
    expect(diagram.title).toContain('Google Cloud Platform');
  });

  it('handles a design with no external systems (no dangling external nodes)', () => {
    const scope = { ...fixtureScope(), items: fixtureScope().items.filter((item) => item.kind !== 'integration' && item.kind !== 'existingSystem') };
    const diagram = buildArchitectureDiagram(buildDesign({ scope }));
    expect(diagram.nodes.every((node) => !node.external)).toBe(true);
  });
});

describe('buildArchitectureDiagram - external system de-duplication', () => {
  function claimCenterNode(diagram: ReturnType<typeof buildArchitectureDiagram>) {
    return diagram.nodes.find((node) => node.external && node.label.toLowerCase() === 'guidewire claimcenter');
  }

  it('merges external nodes that share a display label (case-insensitive, trimmed) into one', () => {
    const diagram = buildArchitectureDiagram(buildDesign({ scope: scopeWithDuplicateExternalSystem() }));

    const claimCenterNodes = diagram.nodes.filter((node) => node.external && node.label.toLowerCase() === 'guidewire claimcenter');
    expect(claimCenterNodes).toHaveLength(1);
    expect(claimCenterNodes.at(0)?.label).toBe('Guidewire ClaimCenter');
    expect(claimCenterNodes.at(0)?.refs).toEqual(['INT_02', 'INT_03', 'INT_04']);
  });

  it('keeps an unrelated external system (Salesforce) as its own, separate node', () => {
    const diagram = buildArchitectureDiagram(buildDesign({ scope: scopeWithDuplicateExternalSystem() }));

    const salesforce = diagram.nodes.find((node) => node.external && node.label === 'Salesforce CRM');
    expect(salesforce).toBeDefined();
    expect(salesforce?.id).not.toBe(claimCenterNode(diagram)?.id);
  });

  it('re-points every citing edge at the merged node', () => {
    const diagram = buildArchitectureDiagram(buildDesign({ scope: scopeWithDuplicateExternalSystem() }));

    const merged = claimCenterNode(diagram);
    expect(merged).toBeDefined();
    const edgesIntoMerged = diagram.edges.filter((edge) => edge.to === merged?.id);
    expect(edgesIntoMerged.length).toBeGreaterThan(0);
    expect(diagram.nodes.filter((node) => edgesIntoMerged.some((edge) => edge.to === node.id))).toHaveLength(1);
  });

  it('merges identical edges (same from, to and kind) once re-pointed, joining distinct labels with " / "', () => {
    const diagram = buildArchitectureDiagram(buildDesign({ scope: scopeWithDuplicateExternalSystem() }));

    const merged = claimCenterNode(diagram);
    const batchEdges = diagram.edges.filter((edge) => edge.to === merged?.id && edge.kind === 'batch');
    expect(batchEdges).toHaveLength(1);
    expect(batchEdges.at(0)?.label).toBe('Synchronize Guidewire ClaimCenter / Synchronize guidewire claimcenter');

    const fileEdges = diagram.edges.filter((edge) => edge.to === merged?.id && edge.kind === 'data');
    expect(fileEdges).toHaveLength(1);
  });
});
