import type { EstimateResult, ScopingSession, WorkstreamEstimate } from '../../domain';
import { fixtureSession } from '../../test/fixtures';
import { buildFullyPopulatedSession } from '../packageFixture.data';
import { buildEffortTimelineSection } from './effortTimeline';

/** An overhead-phase workstream (rule CR_05: no drivers, sized as a percentage of build effort)
 * with no configured role rate, so it also exercises the blocked-cost path. */
function overheadWorkstream(): WorkstreamEstimate {
  return {
    id: 'WS_PH_1',
    name: 'Discovery and Architecture',
    phaseId: 'PH_1',
    requirementIds: [],
    skills: [],
    drivers: [],
    complexity: 'Medium',
    baseDays: 70,
    adjustments: [{ label: 'Percentage of build effort', factor: 0.12, reason: 'Discovery and Architecture is sized at 12% of the total adjusted build effort of 580 days.' }],
    effortDays: { low: 60, likely: 70, high: 85 },
    roles: [],
    cost: null,
    commercialBasis: 'Time and materials',
    confidence: 'Medium',
    confidenceLimitations: [],
    calculation: ['Discovery and Architecture = 12% of 580 build days = 70 days.'],
  };
}

function withExtraWorkstream(session: ScopingSession, workstream: WorkstreamEstimate): ScopingSession {
  const bundle = session.outputs.estimate.data;
  if (bundle === null) {
    throw new Error('expected a populated estimate bundle');
  }
  const result: EstimateResult = { ...bundle.result, workstreams: [...bundle.result.workstreams, workstream] };
  return { ...session, outputs: { ...session.outputs, estimate: { ...session.outputs.estimate, data: { ...bundle, result } } } };
}

function findTableWithColumn(section: ReturnType<typeof buildEffortTimelineSection>, column: string) {
  return section.blocks.find((block) => block.type === 'table' && block.columns.includes(column));
}

describe('buildEffortTimelineSection', () => {
  it('says the estimate has not been generated yet without a result', () => {
    const section = buildEffortTimelineSection(fixtureSession());
    expect(section.blocks.at(0)).toMatchObject({ type: 'callout', title: 'Not generated yet' });
  });

  it('reports the workstream table, phases, calculation steps and calculation rules', () => {
    const section = buildEffortTimelineSection(buildFullyPopulatedSession());
    const workstreamTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Workstream'));
    expect(workstreamTable?.type).toBe('table');
    const rulesTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Formula'));
    expect(rulesTable?.type).toBe('table');
    const calculationHeadings = section.blocks.filter((block) => block.type === 'heading' && block.level === 4);
    expect(calculationHeadings.length).toBeGreaterThan(0);
  });

  it('walks through the timeline calculation as well as the effort totals, so the weeks are reproducible too', () => {
    const section = buildEffortTimelineSection(buildFullyPopulatedSession());
    const headings = section.blocks.filter((block) => block.type === 'heading').map((block) => (block.type === 'heading' ? block.text : ''));
    expect(headings).toEqual(expect.arrayContaining(['Totals calculation', 'Timeline calculation']));
    const timelineIndex = section.blocks.findIndex((block) => block.type === 'heading' && block.text === 'Timeline calculation');
    const steps = section.blocks.at(timelineIndex + 1);
    expect(steps?.type).toBe('list');
    if (steps?.type === 'list') {
      expect(steps.items.at(0)).toContain('Team capacity');
      expect(steps.items.at(-1)).toContain('Total timeline');
    }
  });

  it('states the ID, requirement refs and likely cost for every workstream', () => {
    const section = buildEffortTimelineSection(buildFullyPopulatedSession());
    const table = findTableWithColumn(section, 'ID');
    expect(table?.type).toBe('table');
    if (table?.type === 'table') {
      expect(table.rows.some((row) => row.includes('WS_01') && row.some((cell) => cell.includes('FR_01')) && row.some((cell) => cell.includes('USD')))).toBe(true);
    }
  });

  it('states what sizes an overhead workstream instead of the generic "No drivers identified"', () => {
    const session = withExtraWorkstream(buildFullyPopulatedSession(), overheadWorkstream());
    const section = buildEffortTimelineSection(session);
    const table = findTableWithColumn(section, 'Drivers');
    expect(table?.type).toBe('table');
    if (table?.type === 'table') {
      const row = table.rows.find((cells) => cells.includes('WS_PH_1'));
      expect(row?.some((cell) => cell.includes('Sized at 12% of build days (CR_05)'))).toBe(true);
      expect(row?.includes('No drivers identified')).toBe(false);
    }
  });

  it('reports a workstream cost as blocked when no role rate covers it', () => {
    const session = withExtraWorkstream(buildFullyPopulatedSession(), overheadWorkstream());
    const section = buildEffortTimelineSection(session);
    const table = findTableWithColumn(section, 'Cost (likely)');
    expect(table?.type).toBe('table');
    if (table?.type === 'table') {
      const row = table.rows.find((cells) => cells.includes('WS_PH_1'));
      expect(row?.some((cell) => cell.includes('Blocked'))).toBe(true);
    }
  });

  it('reports a driver-basis table with every driver\'s complexity rationale and requirement refs', () => {
    const section = buildEffortTimelineSection(buildFullyPopulatedSession());
    const table = findTableWithColumn(section, 'Basis');
    expect(table?.type).toBe('table');
    if (table?.type === 'table') {
      expect(table.rows.some((row) => row.includes('DRV_01') && row.includes('Core self-service capability.') && row.some((cell) => cell.includes('FR_01')))).toBe(true);
    }
  });

  it('reports the estimation configuration used, so the package alone reproduces the role split', () => {
    const section = buildEffortTimelineSection(buildFullyPopulatedSession());
    const heading = section.blocks.find((block) => block.type === 'heading' && block.text === 'Estimation configuration used');
    expect(heading).toBeDefined();
    const roleMixTable = findTableWithColumn(section, 'Role split');
    expect(roleMixTable?.type).toBe('table');
    if (roleMixTable?.type === 'table') {
      expect(roleMixTable.rows.some((row) => row.some((cell) => cell.includes('%')))).toBe(true);
    }
    const baseEffortTable = findTableWithColumn(section, 'Very High');
    expect(baseEffortTable?.type).toBe('table');
    const overheadTable = findTableWithColumn(section, 'Overhead % of build');
    expect(overheadTable?.type).toBe('table');
    const spreadTable = findTableWithColumn(section, 'Variance around likely');
    expect(spreadTable?.type).toBe('table');
  });
});
