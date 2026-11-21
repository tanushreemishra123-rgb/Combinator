import type { ImpactReport, ScopingSession } from '../../domain';
import { fixtureSession } from '../../test/fixtures';
import { buildFullyPopulatedSession } from '../packageFixture.data';
import { buildChangeLogSection } from './changeLog';

/** Two affected entries on the same report: one section already resolved, one still pending. */
function reportWithMixedStatus(): ImpactReport {
  return {
    id: 'IMP_02',
    change: { kind: 'cloud-platform', targetId: 'cloudPlatform', label: 'Cloud platform', from: 'AWS', to: 'Azure' },
    affected: [
      { section: 'architecture', area: 'Solution architecture', elementIds: [], reason: 'The recommended cloud changed.', action: 'regenerate' },
      { section: 'estimate', area: 'Effort and timeline estimate', elementIds: [], reason: 'Infrastructure drivers depend on the target cloud.', action: 'regenerate' },
    ],
    unaffected: [],
    explanation: 'Changing the cloud platform regenerates the architecture and the estimate.',
    createdAt: '2026-01-02T00:00:00.000Z',
    resolvedSections: ['architecture'],
  };
}

function withChangeLog(session: ScopingSession, changeLog: ImpactReport[]): ScopingSession {
  return { ...session, changeLog };
}

describe('buildChangeLogSection', () => {
  it('says no changes have been recorded for a brand-new session', () => {
    const section = buildChangeLogSection(fixtureSession());
    expect(section.blocks).toEqual([{ type: 'callout', tone: 'info', title: 'No changes recorded', text: expect.any(String) }]);
  });

  it('renders each recorded ImpactReport: the change, affected entries with reasons, and unaffected entries', () => {
    const section = buildChangeLogSection(buildFullyPopulatedSession());
    const heading = section.blocks.find((block) => block.type === 'heading');
    expect(heading).toMatchObject({ text: expect.stringContaining('Contingency') });
    const affectedTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Action'));
    expect(affectedTable?.type).toBe('table');
    if (affectedTable?.type === 'table') {
      expect(affectedTable.rows.some((row) => row.includes('Recalculate'))).toBe(true);
      // Sections are named the way the workspaces name them, never by their internal key.
      expect(affectedTable.rows.every((row) => row.at(0) !== 'commercials')).toBe(true);
      expect(affectedTable.rows.some((row) => row.at(0) === 'ROM commercials')).toBe(true);
    }
    const headings = section.blocks.filter((block) => block.type === 'heading').map((block) => (block.type === 'heading' ? block.text : ''));
    expect(headings).toEqual(expect.arrayContaining(['Affected sections', 'Confirmed unaffected']));
    const unaffectedTable = section.blocks.find((block) => block.type === 'table' && !block.columns.includes('Action'));
    expect(unaffectedTable?.type).toBe('table');
  });

  it('marks an affected section Refreshed once resolvedSections says it was regenerated, and Pending otherwise', () => {
    const session = withChangeLog(buildFullyPopulatedSession(), [reportWithMixedStatus()]);
    const section = buildChangeLogSection(session);
    const affectedTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Status'));
    expect(affectedTable?.type).toBe('table');
    if (affectedTable?.type === 'table') {
      const statusIndex = affectedTable.columns.indexOf('Status');
      const architectureRow = affectedTable.rows.find((row) => row.at(0) === 'Solution architecture');
      const estimateRow = affectedTable.rows.find((row) => row.at(0) === 'Effort and timeline estimate');
      expect(architectureRow?.at(statusIndex)).toBe('Refreshed');
      expect(estimateRow?.at(statusIndex)).toBe('Pending');
    }
  });
});
