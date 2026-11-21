import type { DiagramModel } from '../../domain';
import { fixtureSession } from '../../test/fixtures';
import { buildFullyPopulatedSession } from '../packageFixture.data';
import { buildIntegrationArchitectureSection } from './integrationArchitecture';

const FLOW_MODEL: DiagramModel = { title: 'Data and Integration Flow', tiers: [{ id: 'integration', label: 'Integration' }], nodes: [], edges: [] };

describe('buildIntegrationArchitectureSection', () => {
  it('says the integration architecture has not been generated yet without a plan', () => {
    const section = buildIntegrationArchitectureSection(fixtureSession(), undefined);
    expect(section.blocks.at(0)).toMatchObject({ type: 'callout', title: 'Not generated yet' });
  });

  it('lists integrations and data flows, and embeds the data-flow diagram when supplied', () => {
    const section = buildIntegrationArchitectureSection(buildFullyPopulatedSession(), FLOW_MODEL);
    const integrationTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Integration'));
    expect(integrationTable?.type).toBe('table');
    if (integrationTable?.type === 'table') {
      expect(integrationTable.rows.some((row) => row.includes('Salesforce CRM profile sync'))).toBe(true);
    }
    const diagramBlock = section.blocks.find((block) => block.type === 'diagram');
    expect(diagramBlock).toMatchObject({ diagramId: 'data-flow' });
  });

  it('carries the integration id and data-synchronization detail the UI already shows', () => {
    const section = buildIntegrationArchitectureSection(buildFullyPopulatedSession(), FLOW_MODEL);
    const integrationTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Integration'));
    expect(integrationTable?.type).toBe('table');
    if (integrationTable?.type === 'table') {
      expect(integrationTable.columns.at(0)).toBe('ID');
      expect(integrationTable.columns).toContain('Data synchronization');
      const dataSyncIndex = integrationTable.columns.indexOf('Data synchronization');
      const row = integrationTable.rows.find((candidate) => candidate.includes('Salesforce CRM profile sync'));
      expect(row?.at(0)).toBe('INT_01');
      expect(row?.at(dataSyncIndex)).toBe('Near real-time.');
    }
  });

  it('says no data-flow diagram is available when the architecture has not been generated', () => {
    const section = buildIntegrationArchitectureSection(buildFullyPopulatedSession(), undefined);
    const diagramArea = section.blocks.at(-1);
    expect(diagramArea).toMatchObject({ type: 'callout' });
  });
});
