import type { TraceLink } from '../../domain';
import { fixtureSession } from '../../test/fixtures';
import { buildTraceabilityInfoSection, customerWording } from './traceabilityInfo';

const LINKS: TraceLink[] = [
  { requirementId: 'FR_01', targetType: 'capability', targetId: 'CAP_01', targetLabel: 'Member self-service portal' },
  { requirementId: 'FR_02', targetType: 'capability', targetId: 'CAP_01', targetLabel: 'Member self-service portal' },
  { requirementId: 'FR_01', targetType: 'capability', targetId: 'CAP_01', targetLabel: 'Member self-service portal' },
  { requirementId: 'DATA_01', targetType: 'dataTopic', targetId: 'retention', targetLabel: 'Data retention' },
];

vi.mock('../../traceability', () => ({ buildTraceLinks: vi.fn(() => LINKS) }));

describe('buildTraceabilityInfoSection', () => {
  it('says no requirements have been analysed yet when there is no scope', () => {
    const section = buildTraceabilityInfoSection({ ...fixtureSession(), scope: null });
    expect(section.blocks.at(0)).toMatchObject({ type: 'callout', title: 'Not generated yet' });
  });

  it('lists the source reference for every requirement and one row per generated output with the requirements it cites', () => {
    const section = buildTraceabilityInfoSection(fixtureSession());
    const sourceTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Source reference'));
    expect(sourceTable?.type).toBe('table');
    if (sourceTable?.type === 'table') {
      expect(sourceTable.rows.some((row) => row.at(0) === 'FR_01')).toBe(true);
    }
    const linkTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Output type'));
    expect(linkTable?.type).toBe('table');
    if (linkTable?.type === 'table') {
      expect(linkTable.rows).toEqual([
        ['Capability', 'CAP_01', 'Member self-service portal', 'FR_01, FR_02'],
        ['Data topic', 'Identified by name', 'Data retention', 'DATA_01'],
      ]);
    }
  });

  it('shows the customer wording behind each requirement next to its source reference', () => {
    const section = buildTraceabilityInfoSection(fixtureSession());
    const sourceTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Customer wording'));
    expect(sourceTable?.type).toBe('table');
    if (sourceTable?.type === 'table') {
      const fr01 = sourceTable.rows.find((row) => row.at(0) === 'FR_01');
      expect(fr01?.at(4)).toMatch(/^".+"$/);
    }
  });
});

describe('customerWording', () => {
  const item = fixtureSession().scope?.items.at(0);

  it('cuts a long quote at a word boundary and says when no wording was recorded', () => {
    expect(item).toBeDefined();
    if (item === undefined || item.source === null) {
      return;
    }
    const long = `${'word '.repeat(40)}end`;
    const wording = customerWording({ ...item, source: { ...item.source, quote: long } });
    expect(wording.endsWith('word..."')).toBe(true);
    expect(wording.length).toBeLessThanOrEqual(146);
    expect(customerWording({ ...item, source: null })).toBe('No customer wording recorded');
  });
});
