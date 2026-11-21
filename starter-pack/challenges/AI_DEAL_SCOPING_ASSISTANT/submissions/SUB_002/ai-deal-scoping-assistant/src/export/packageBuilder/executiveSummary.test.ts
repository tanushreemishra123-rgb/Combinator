import { fixtureSession } from '../../test/fixtures';
import { buildExecutiveSummarySection } from './executiveSummary';

describe('buildExecutiveSummarySection', () => {
  it('renders the session\'s own reviewed executive summary when one is set', () => {
    const session = { ...fixtureSession(), executiveSummary: 'First paragraph.\n\nSecond paragraph.' };
    const section = buildExecutiveSummarySection(session);
    expect(section.blocks).toEqual([
      { type: 'paragraph', text: 'First paragraph.' },
      { type: 'paragraph', text: 'Second paragraph.' },
    ]);
  });

  it('falls back to a deterministic summary grounded in the reviewed scope when none is set', () => {
    const section = buildExecutiveSummarySection({ ...fixtureSession(), executiveSummary: '' });
    expect(section.blocks.length).toBeGreaterThan(0);
    const text = section.blocks.map((block) => (block.type === 'paragraph' ? block.text : '')).join(' ');
    expect(text).toContain('Northwind Mutual');
    expect(text).not.toMatch(/undefined|\bnull\b|NaN/);
  });

  it('says an executive summary cannot be produced yet when there is no approved scope', () => {
    const section = buildExecutiveSummarySection({ ...fixtureSession(), executiveSummary: '', scope: null });
    expect(section.blocks.at(0)).toMatchObject({ type: 'callout', title: 'Not generated yet' });
  });
});
