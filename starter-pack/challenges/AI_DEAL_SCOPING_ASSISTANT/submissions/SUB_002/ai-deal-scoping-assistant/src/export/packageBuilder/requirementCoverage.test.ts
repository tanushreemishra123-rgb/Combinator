import type { CoverageReport } from '../../domain';
import { fixtureSession } from '../../test/fixtures';
import { buildRequirementCoverageSection } from './requirementCoverage';

const COVERAGE: CoverageReport = {
  rows: [{ requirementId: 'FR_01', title: 'Registration and SSO', kind: 'functional', priority: 'High', capabilityIds: ['CAP_01'], componentIds: [], strategyIds: [], workstreamIds: [], covered: true }],
  links: [],
  totalRequirements: 1,
  coveredRequirements: 1,
  coveragePct: 100,
  highPriorityCoveragePct: 100,
  uncoveredIds: [],
  unsupportedAdditions: [{ targetType: 'capability', targetId: 'CAP_09', label: 'Unreviewed capability', reason: 'Cites no reviewed requirement.', unknownRefs: [] }],
};

vi.mock('../../traceability', () => ({ buildCoverageReport: vi.fn(() => COVERAGE) }));

describe('buildRequirementCoverageSection', () => {
  it('says no requirements have been analysed yet when there is no scope', () => {
    const section = buildRequirementCoverageSection({ ...fixtureSession(), scope: null });
    expect(section.blocks.at(0)).toMatchObject({ type: 'callout', title: 'Not generated yet' });
  });

  it('reports coverage percentages, the per-requirement table and unsupported additions from buildCoverageReport', () => {
    const section = buildRequirementCoverageSection(fixtureSession());
    const summary = section.blocks.find((block) => block.type === 'keyValues');
    expect(summary?.type).toBe('keyValues');
    if (summary?.type === 'keyValues') {
      expect(summary.pairs.find((pair) => pair.key === 'Overall coverage')?.value).toBe('100%');
    }
    const coverageTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Covered'));
    expect(coverageTable?.type).toBe('table');
    if (coverageTable?.type === 'table') {
      expect(coverageTable.rows.at(0)?.at(0)).toBe('FR_01');
    }
    const unsupportedTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Element'));
    expect(unsupportedTable?.type).toBe('table');
    if (unsupportedTable?.type === 'table') {
      expect(unsupportedTable.rows.some((row) => row.includes('Unreviewed capability'))).toBe(true);
    }
  });

  it('states every requirement is covered when there are no uncovered ids', () => {
    const section = buildRequirementCoverageSection(fixtureSession());
    const list = section.blocks.find((block) => block.type === 'list');
    expect(list).toMatchObject({ items: ['Every reviewed requirement is covered by at least one capability or architecture/strategy element.'] });
  });
  it('warns that coverage is relative to a scope that still has open questions or missing information', () => {
    const section = buildRequirementCoverageSection(fixtureSession());
    const note = section.blocks.find((block) => block.type === 'callout');
    expect(note).toMatchObject({ tone: 'warning', text: expect.stringContaining('2 open clarification question(s) and 1 missing-information item(s)') });
  });

  it('adds no caveat once every question and gap is resolved', () => {
    const session = fixtureSession();
    const scope = session.scope;
    if (scope === null) {
      throw new Error('expected a scope model');
    }
    const resolved = { ...scope, items: scope.items.map((item) => (item.kind === 'question' || item.kind === 'gap' ? { ...item, resolved: true, resolution: 'Confirmed.' } : item)) };
    const section = buildRequirementCoverageSection({ ...session, scope: resolved });
    expect(section.blocks.some((block) => block.type === 'callout')).toBe(false);
  });
});
