import { fixtureSession } from '../../test/fixtures';
import { buildFullyPopulatedSession } from '../packageFixture.data';
import { buildRomCommercialsSection } from './romCommercials';

describe('buildRomCommercialsSection', () => {
  it('says the ROM estimate has not been generated yet without a result', () => {
    const section = buildRomCommercialsSection(fixtureSession());
    expect(section.blocks.at(0)).toMatchObject({ type: 'callout', title: 'Not generated yet' });
  });

  it('reports the rate card, role allocation and totals when every rate is provided', () => {
    const section = buildRomCommercialsSection(buildFullyPopulatedSession());
    expect(section.blocks.some((block) => block.type === 'callout' && block.tone === 'danger')).toBe(false);
    const totals = section.blocks.find((block) => block.type === 'keyValues' && block.pairs.some((pair) => pair.key === 'ROM range'));
    expect(totals?.type).toBe('keyValues');
    if (totals?.type === 'keyValues') {
      expect(totals.pairs.find((pair) => pair.key === 'ROM range')?.value).not.toContain('Blocked');
    }
  });

  it('renders an explicit blocked callout listing the missing rates when the ROM range is null', () => {
    const populated = buildFullyPopulatedSession();
    const bundle = populated.outputs.estimate.data;
    if (bundle === null) {
      throw new Error('expected an estimate bundle');
    }
    const blockedResult = {
      ...bundle.result,
      totals: { ...bundle.result.totals, subtotal: null, contingency: null, rom: null },
      missingInputs: [{ key: 'roleRate' as const, label: 'Frontend Engineer rate', effect: 'calculation-blocked' as const, affected: ['WS_01'], relatedScopeIds: [], howToResolve: 'Provide a day rate for the Frontend Engineer role.' }],
    };
    const session = { ...populated, outputs: { ...populated.outputs, estimate: { ...populated.outputs.estimate, data: { ...bundle, result: blockedResult } } } };
    const section = buildRomCommercialsSection(session);
    const blocked = section.blocks.find((block) => block.type === 'callout' && block.tone === 'danger');
    expect(blocked).toBeDefined();
    if (blocked?.type === 'callout') {
      expect(blocked.text).toContain('Frontend Engineer rate');
    }
  });
});
