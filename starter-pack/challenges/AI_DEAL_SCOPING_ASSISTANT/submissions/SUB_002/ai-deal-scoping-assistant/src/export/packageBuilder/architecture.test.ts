import { fixtureSession } from '../../test/fixtures';
import { buildFullyPopulatedSession } from '../packageFixture.data';
import { buildSolutionArchitectureSection } from './architecture';

describe('buildSolutionArchitectureSection', () => {
  it('says the solution architecture has not been generated yet without a design', () => {
    const section = buildSolutionArchitectureSection(fixtureSession());
    expect(section.blocks.at(0)).toMatchObject({ type: 'callout', title: 'Not generated yet' });
  });

  it('reports the platform, selection, recommendation scores and the component table', () => {
    const section = buildSolutionArchitectureSection(buildFullyPopulatedSession());
    const platformBlock = section.blocks.find((block) => block.type === 'keyValues' && block.pairs.some((pair) => pair.key === 'Cloud platform'));
    expect(platformBlock?.type).toBe('keyValues');
    if (platformBlock?.type === 'keyValues') {
      expect(platformBlock.pairs.find((pair) => pair.key === 'Cloud platform')?.value).toContain('Azure');
    }
    const componentTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Service'));
    expect(componentTable?.type).toBe('table');
    if (componentTable?.type === 'table') {
      expect(componentTable.rows.some((row) => row.includes('Azure SQL Database'))).toBe(true);
    }
  });
});
