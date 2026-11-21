import { fixtureSession } from '../../test/fixtures';
import { buildFullyPopulatedSession } from '../packageFixture.data';
import { buildPrdSection } from './prd';

describe('buildPrdSection', () => {
  it('says the PRD has not been generated yet when there is no PRD bundle', () => {
    const section = buildPrdSection(fixtureSession());
    expect(section.blocks.at(0)).toMatchObject({ type: 'callout', title: 'Not generated yet' });
  });

  it('renders all 14 PRD sections, each statement suffixed with its refs and label', () => {
    const section = buildPrdSection(buildFullyPopulatedSession());
    const headings = section.blocks.filter((block) => block.type === 'heading').map((block) => (block.type === 'heading' ? block.text : ''));
    expect(headings).toHaveLength(14);
    const paragraphs = section.blocks.filter((block) => block.type === 'paragraph').map((block) => (block.type === 'paragraph' ? block.text : ''));
    expect(paragraphs.some((text) => text.includes('Refs: FR_01') && text.includes('Customer-requested'))).toBe(true);
  });
});
