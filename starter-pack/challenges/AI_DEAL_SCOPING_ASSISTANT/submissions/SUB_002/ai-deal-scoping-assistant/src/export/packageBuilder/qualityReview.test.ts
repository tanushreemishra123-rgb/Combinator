import { fixtureSession } from '../../test/fixtures';
import { buildFullyPopulatedSession } from '../packageFixture.data';
import { buildQualityReviewSection } from './qualityReview';

describe('buildQualityReviewSection', () => {
  it('warns that the quality gate has not been run when session.quality is null', () => {
    const section = buildQualityReviewSection(fixtureSession());
    expect(section.blocks).toEqual([{ type: 'callout', tone: 'warning', title: 'Quality gate has not been run', text: expect.any(String) }]);
  });

  it('reports the quality summary and every check, including its findings', () => {
    const populated = buildFullyPopulatedSession();
    const section = buildQualityReviewSection(populated);
    const summary = section.blocks.find((block) => block.type === 'keyValues');
    expect(summary?.type).toBe('keyValues');
    if (summary?.type === 'keyValues') {
      expect(summary.pairs.find((pair) => pair.key === 'Export status')?.value).toBe(populated.quality?.summary.exportStatus);
    }
    const checksTable = section.blocks.find((block) => block.type === 'table');
    expect(checksTable?.type).toBe('table');
    if (checksTable?.type === 'table') {
      expect(checksTable.rows.length).toBe(populated.quality?.checks.length);
    }
  });
});
