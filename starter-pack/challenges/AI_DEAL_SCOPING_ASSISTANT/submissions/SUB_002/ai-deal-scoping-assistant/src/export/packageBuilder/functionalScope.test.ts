import { fixtureSession } from '../../test/fixtures';
import { buildFullyPopulatedSession } from '../packageFixture.data';
import { buildFunctionalScopeSection } from './functionalScope';

describe('buildFunctionalScopeSection', () => {
  it('says functional scope has not been generated yet without a PRD bundle', () => {
    const section = buildFunctionalScopeSection(fixtureSession());
    expect(section.blocks.at(0)).toMatchObject({ type: 'callout', title: 'Not generated yet' });
  });

  it('lists capabilities, recommended enhancements (marked AI recommendation), modules, workstreams, delivery packages and out-of-scope items', () => {
    const section = buildFunctionalScopeSection(buildFullyPopulatedSession());
    const tables = section.blocks.filter((block) => block.type === 'table' && block.columns.includes('Capability'));
    expect(tables).toHaveLength(2);
    const enhancementsTable = tables.at(1);
    expect(enhancementsTable?.type).toBe('table');
    if (enhancementsTable?.type === 'table') {
      expect(enhancementsTable.rows.some((row) => row.includes('AI recommendation'))).toBe(true);
    }
    const headings = section.blocks.filter((block) => block.type === 'heading').map((block) => (block.type === 'heading' ? block.text : ''));
    expect(headings).toEqual(['Capabilities', 'Recommended enhancements (AI recommendation)', 'Modules', 'Workstreams', 'Delivery packages', 'Out of scope']);
  });
});
