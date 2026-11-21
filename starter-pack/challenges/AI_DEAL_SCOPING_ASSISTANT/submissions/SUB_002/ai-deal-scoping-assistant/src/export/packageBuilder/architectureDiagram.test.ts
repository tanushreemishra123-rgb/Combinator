import type { DiagramModel } from '../../domain';
import { buildArchitectureDiagramSection } from './architectureDiagram';

const MODEL: DiagramModel = {
  title: 'Microsoft Azure Solution Architecture',
  tiers: [{ id: 'application', label: 'Application' }],
  nodes: [{ id: 'ARC_01', label: 'Member Web App', sublabel: 'Static Web Apps', tierId: 'application', refs: ['FR_01'], external: false }],
  edges: [],
};

describe('buildArchitectureDiagramSection', () => {
  it('renders a Mermaid diagram block for a known DiagramModel', () => {
    const section = buildArchitectureDiagramSection(MODEL);
    expect(section.blocks).toHaveLength(1);
    const block = section.blocks.at(0);
    expect(block).toMatchObject({ type: 'diagram', diagramId: 'architecture', title: MODEL.title });
    if (block?.type === 'diagram') {
      expect(block.mermaid).toContain('Member Web App');
    }
  });

  it('says the architecture has not been generated yet when there is no diagram model', () => {
    const section = buildArchitectureDiagramSection(undefined);
    expect(section.blocks.at(0)).toMatchObject({ type: 'callout', title: 'Not generated yet' });
  });
});
