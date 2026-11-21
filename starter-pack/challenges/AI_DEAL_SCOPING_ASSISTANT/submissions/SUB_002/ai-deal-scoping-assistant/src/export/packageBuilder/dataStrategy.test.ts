import { fixtureSession } from '../../test/fixtures';
import { buildFullyPopulatedSession } from '../packageFixture.data';
import { buildDataStrategySection } from './dataStrategy';

describe('buildDataStrategySection', () => {
  it('says the data strategy has not been generated yet without a plan', () => {
    const section = buildDataStrategySection(fixtureSession());
    expect(section.blocks.at(0)).toMatchObject({ type: 'callout', title: 'Not generated yet' });
  });

  it('lists the domains table and all ten data topics', () => {
    const section = buildDataStrategySection(buildFullyPopulatedSession());
    const topicHeadings = section.blocks.filter((block) => block.type === 'heading' && block.level === 4);
    expect(topicHeadings).toHaveLength(10);
    const domainTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Domain'));
    expect(domainTable?.type).toBe('table');
  });

  it('carries the data domain id so it can be cross-referenced from elsewhere in the package', () => {
    const section = buildDataStrategySection(buildFullyPopulatedSession());
    const domainTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Domain'));
    expect(domainTable?.type).toBe('table');
    if (domainTable?.type === 'table') {
      expect(domainTable.columns.at(0)).toBe('ID');
      expect(domainTable.rows.at(0)?.at(0)).toBe('DOM_01');
    }
  });

  it('shows a "not yet planned" line for a topic the plan does not cover', () => {
    const populated = buildFullyPopulatedSession();
    const plan = populated.outputs.dataIntegration.data;
    if (plan === null) {
      throw new Error('expected a data integration plan');
    }
    const withoutRetention = { ...plan, topics: plan.topics.filter((topic) => topic.topic !== 'retention') };
    const section = buildDataStrategySection({ ...populated, outputs: { ...populated.outputs, dataIntegration: { ...populated.outputs.dataIntegration, data: withoutRetention } } });
    const paragraphs = section.blocks.filter((block) => block.type === 'paragraph').map((block) => (block.type === 'paragraph' ? block.text : ''));
    expect(paragraphs).toContain('Not yet planned for this session.');
  });
});
