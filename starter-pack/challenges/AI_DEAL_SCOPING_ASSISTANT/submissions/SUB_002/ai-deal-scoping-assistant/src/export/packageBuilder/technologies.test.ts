import { fixtureSession } from '../../test/fixtures';
import { buildFullyPopulatedSession } from '../packageFixture.data';
import { buildTechnologiesSection } from './technologies';

describe('buildTechnologiesSection', () => {
  it('says neither the AI strategy nor the architecture has been generated yet', () => {
    const section = buildTechnologiesSection(fixtureSession());
    expect(section.blocks.some((block) => block.type === 'callout' && block.title === 'Not generated yet')).toBe(true);
  });

  it('lists frameworks with rationale and the selected cloud services', () => {
    const section = buildTechnologiesSection(buildFullyPopulatedSession());
    const frameworkTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Framework'));
    expect(frameworkTable?.type).toBe('table');
    if (frameworkTable?.type === 'table') {
      expect(frameworkTable.rows.some((row) => row.includes('LangChain'))).toBe(true);
    }
    const serviceTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Service'));
    expect(serviceTable?.type).toBe('table');
    if (serviceTable?.type === 'table') {
      expect(serviceTable.rows.some((row) => row.includes('Azure SQL Database'))).toBe(true);
    }
  });
});
