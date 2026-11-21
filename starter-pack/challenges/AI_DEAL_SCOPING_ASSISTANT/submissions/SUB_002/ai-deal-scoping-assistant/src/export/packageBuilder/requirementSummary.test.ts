import { fixtureSession } from '../../test/fixtures';
import { buildRequirementSummarySection } from './requirementSummary';

describe('buildRequirementSummarySection', () => {
  it('reports counts by type, priority and provenance plus the full requirement table', () => {
    const section = buildRequirementSummarySection(fixtureSession());
    const headings = section.blocks.filter((block) => block.type === 'heading').map((block) => (block.type === 'heading' ? block.text : ''));
    expect(headings).toEqual([
      'Counts by requirement type',
      'Counts by priority',
      'Counts by provenance (all in-scope items)',
      'Reviewed requirements',
      'Context and constraints',
    ]);
    const table = section.blocks.find((block) => block.type === 'table' && block.columns.includes('ID'));
    expect(table?.type).toBe('table');
    if (table?.type === 'table') {
      expect(table.rows.some((row) => row.at(0) === 'FR_01')).toBe(true);
      expect(table.columns.at(-1)).toBe('Related IDs');
      expect(table.rows.find((row) => row.at(0) === 'FR_01')?.at(-1)).toBe('Q_01');
    }
  });

  it('defines every persona, existing system, technology preference, constraint and dependency by ID', () => {
    const section = buildRequirementSummarySection(fixtureSession());
    const table = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Title: description'));
    expect(table?.type).toBe('table');
    if (table?.type === 'table') {
      expect(table.columns).toEqual(['ID', 'Type', 'Title: description', 'Provenance', 'Source reference']);
      expect(table.rows.map((row) => row.at(0))).toEqual(['PER_01', 'SYS_01', 'TECH_01', 'CON_01', 'DEP_01']);
      expect(table.rows.at(3)?.at(2)).toBe('Go-live before renewal period: Go live before the annual renewal period.');
    }
  });

  it('counts provenance over every in-scope item, not only requirement kinds', () => {
    const section = buildRequirementSummarySection(fixtureSession());
    const index = section.blocks.findIndex((block) => block.type === 'heading' && block.text.startsWith('Counts by provenance'));
    const counts = section.blocks.at(index + 1);
    expect(counts?.type).toBe('table');
    if (counts?.type === 'table') {
      expect(counts.rows.map((row) => row.at(0))).toEqual(['Customer-stated', 'AI-inferred', 'Assumed']);
    }
  });

  it('says no requirements have been analysed yet when there is no scope', () => {
    const section = buildRequirementSummarySection({ ...fixtureSession(), scope: null });
    expect(section.blocks.at(0)).toMatchObject({ type: 'callout', title: 'Not generated yet' });
  });
});
