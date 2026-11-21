import { fixtureSession } from '../../test/fixtures';
import { buildCustomerObjectivesSection } from './customerObjectives';

describe('buildCustomerObjectivesSection', () => {
  it('lists every reviewed business objective with its priority and source reference', () => {
    const section = buildCustomerObjectivesSection(fixtureSession());
    expect(section.blocks).toHaveLength(1);
    const block = section.blocks.at(0);
    if (block === undefined || block.type !== 'table') {
      throw new Error('expected a table block');
    }
    expect(block.rows.some((row) => row.at(0) === 'BR_01')).toBe(true);
  });

  it('says no requirements have been analysed yet when there is no scope', () => {
    const section = buildCustomerObjectivesSection({ ...fixtureSession(), scope: null });
    expect(section.blocks.at(0)).toMatchObject({ type: 'callout', title: 'Not generated yet' });
  });
});
