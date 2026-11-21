import { fixtureSession } from '../../test/fixtures';
import { buildFullyPopulatedSession } from '../packageFixture.data';
import { buildDeliveryPhasesSection } from './deliveryPhases';

describe('buildDeliveryPhasesSection', () => {
  it('says both delivery packages and phases are not yet available for a brand-new session', () => {
    const section = buildDeliveryPhasesSection(fixtureSession());
    const callouts = section.blocks.filter((block) => block.type === 'callout');
    expect(callouts).toHaveLength(2);
  });

  it('lists delivery packages and shows which workstreams run in which phase, without any numbers', () => {
    const section = buildDeliveryPhasesSection(buildFullyPopulatedSession());
    const packagesTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Delivery package'));
    expect(packagesTable?.type).toBe('table');
    const phasesTable = section.blocks.find((block) => block.type === 'table' && block.columns.includes('Phase'));
    expect(phasesTable?.type).toBe('table');
    if (phasesTable?.type === 'table') {
      expect(phasesTable.columns).toEqual(['Phase', 'Workstreams', 'Milestone']);
      expect(phasesTable.rows.some((row) => row.includes('Member Experience'))).toBe(true);
    }
  });
});
