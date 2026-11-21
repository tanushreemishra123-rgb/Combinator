/** Unit tests for resolving architecture component ids to readable "Name (Service)" labels. */
import { buildComponentLookup, componentLabelsFor } from './componentNames';
import { fixtureArchitectureDesign } from './strategyFixtures';

describe('buildComponentLookup', () => {
  it('returns an empty map when there is no architecture design yet', () => {
    expect(buildComponentLookup(null).size).toBe(0);
  });

  it('indexes every component by id', () => {
    const lookup = buildComponentLookup(fixtureArchitectureDesign());
    expect(lookup.get('ARC_07')?.name).toBe('Integration Platform');
  });
});

describe('componentLabelsFor', () => {
  it('formats known ids as "Name (Service)"', () => {
    const lookup = buildComponentLookup(fixtureArchitectureDesign());
    expect(componentLabelsFor(['ARC_07'], lookup)).toEqual(['Integration Platform (Azure Logic Apps)']);
  });

  it('drops an id the design no longer has instead of showing it raw', () => {
    const lookup = buildComponentLookup(fixtureArchitectureDesign());
    expect(componentLabelsFor(['ARC_99'], lookup)).toEqual([]);
  });

  it('returns an empty list for no ids', () => {
    const lookup = buildComponentLookup(fixtureArchitectureDesign());
    expect(componentLabelsFor([], lookup)).toEqual([]);
  });
});
