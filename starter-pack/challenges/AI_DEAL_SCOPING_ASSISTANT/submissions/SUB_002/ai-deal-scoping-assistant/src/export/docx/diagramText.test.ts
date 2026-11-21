import { diagramToMermaid } from '../../diagram';
import type { DiagramModel } from '../../domain';
import { diagramFlowLines, diagramTiers } from './diagramText';

const MODEL: DiagramModel = {
  title: 'Architecture',
  tiers: [
    { id: 'application', label: 'Application' },
    { id: 'data', label: 'Data' },
  ],
  nodes: [
    { id: 'ARC_01', label: 'Member Web App', sublabel: 'Static Web Apps', tierId: 'application', refs: ['FR_01'], external: false },
    { id: 'ext:salesforce', label: 'Salesforce CRM', sublabel: 'External system', tierId: 'data', refs: ['INT_01'], external: true },
  ],
  edges: [{ from: 'ARC_01', to: 'ext:salesforce', label: 'sync', kind: 'request' }],
};

describe('diagramTiers', () => {
  it('reads back the tier labels and node labels this project\'s own diagramToMermaid produces', () => {
    const tiers = diagramTiers(diagramToMermaid(MODEL));
    expect(tiers.map((tier) => tier.label)).toEqual(['Application', 'Data']);
    expect(tiers.at(0)?.nodes).toEqual(['Member Web App - Static Web Apps']);
    expect(tiers.at(1)?.nodes).toEqual(['Salesforce CRM - External system']);
  });

  it('returns no tiers for an empty diagram', () => {
    expect(diagramTiers(diagramToMermaid({ title: 'Empty', tiers: [], nodes: [], edges: [] }))).toEqual([]);
  });
});

describe('diagramFlowLines', () => {
  it('reads back one line per edge, including its label', () => {
    const lines = diagramFlowLines(diagramToMermaid(MODEL));
    expect(lines).toHaveLength(1);
    expect(lines.at(0)).toContain('sync');
  });

  it('returns no flows when the diagram has none', () => {
    expect(diagramFlowLines(diagramToMermaid({ title: 'Empty', tiers: [], nodes: [], edges: [] }))).toEqual([]);
  });
});
