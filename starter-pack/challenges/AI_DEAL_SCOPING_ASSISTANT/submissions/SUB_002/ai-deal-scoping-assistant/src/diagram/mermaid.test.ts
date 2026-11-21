import { describe, expect, it } from 'vitest';
import { diagramToMermaid } from './mermaid';
import type { DiagramModel } from '../domain';

function sampleModel(): DiagramModel {
  return {
    title: 'Data Flow',
    tiers: [
      { id: 'source-systems', label: 'Source Systems' },
      { id: 'data-stores', label: 'Platform Data Stores' },
    ],
    nodes: [
      { id: 'salesforce-crm', label: 'Salesforce CRM', sublabel: 'external', tierId: 'source-systems', refs: ['INT_01'], external: true },
      { id: 'relational-db', label: 'Relational "DB"', sublabel: 'Azure Database for PostgreSQL', tierId: 'data-stores', refs: [], external: false },
    ],
    edges: [{ from: 'salesforce-crm', to: 'relational-db', label: 'Sync [profile]', kind: 'batch' }],
  };
}

describe('diagramToMermaid', () => {
  it('starts with the flowchart TB header', () => {
    expect(diagramToMermaid(sampleModel()).startsWith('flowchart TB')).toBe(true);
  });

  it('renders one subgraph per tier with a sanitised id', () => {
    const text = diagramToMermaid(sampleModel());
    expect(text).toContain('subgraph tier_source_systems[');
    expect(text).toContain('subgraph tier_data_stores[');
  });

  it('sanitises node ids and strips characters Mermaid cannot handle from labels', () => {
    const text = diagramToMermaid(sampleModel());
    expect(text).toContain('salesforce_crm(["Salesforce CRM<br/>external"])');
    expect(text).not.toContain('"DB"');
    expect(text).not.toContain('[profile]');
  });

  it('renders the edge label between pipes on the correct arrow style for its kind', () => {
    const text = diagramToMermaid(sampleModel());
    expect(text).toMatch(/salesforce_crm ==>\|Sync profile\| relational_db/);
  });

  it('skips an edge that references an unknown node id', () => {
    const model = sampleModel();
    const withGhostEdge: DiagramModel = { ...model, edges: [...model.edges, { from: 'salesforce-crm', to: 'ghost', label: '', kind: 'request' }] };
    const text = diagramToMermaid(withGhostEdge);
    expect(text).not.toContain('ghost');
  });

  it('renders an explanatory comment for an empty model instead of a bare header', () => {
    const text = diagramToMermaid({ title: 'Empty', tiers: [], nodes: [], edges: [] });
    expect(text).toBe('flowchart TB\n  %% No diagram elements to display yet.');
  });
});
