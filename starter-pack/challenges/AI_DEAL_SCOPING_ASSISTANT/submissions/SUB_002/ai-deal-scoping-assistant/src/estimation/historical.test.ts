import type { EstimateResult, HistoricalProjectReference } from '../domain';
import type * as SeedModule from '../seed';
import { calculationInput, platformSuggestion } from './testing/estimateFixtures';

const SMALL_PROJECT: HistoricalProjectReference = {
  id: 'HIST_01',
  name: 'Claims intake portal',
  category: 'application-modernization',
  summary: 'Customer portal delivered through a challenge series.',
  durationWeeks: 14,
  effortPersonWeeks: 60,
  deliveryModel: 'topcoder-challenge-series',
};

const HUGE_PROJECT: HistoricalProjectReference = { ...SMALL_PROJECT, id: 'HIST_02', durationWeeks: 300, effortPersonWeeks: 9000 };

interface Loaded {
  references: readonly HistoricalProjectReference[];
  result: EstimateResult;
}

/** Loads the module graph with the given historical data and calculates the same estimate. */
async function calculateWithHistory(projects: readonly HistoricalProjectReference[]): Promise<Loaded> {
  vi.resetModules();
  vi.doMock('../seed', async (importOriginal) => ({ ...(await importOriginal<typeof SeedModule>()), HISTORICAL_PROJECTS: projects }));
  const { getHistoricalReferences } = await import('./historical');
  const { calculateEstimate } = await import('./engine/calculateEstimate');
  return { references: getHistoricalReferences(), result: calculateEstimate(calculationInput({ suggestion: platformSuggestion() })) };
}

describe('getHistoricalReferences', () => {
  afterEach(() => {
    vi.doUnmock('../seed');
    vi.resetModules();
  });

  it('returns the seeded historical projects for display', async () => {
    const { references } = await calculateWithHistory([SMALL_PROJECT]);
    expect(references).toEqual([SMALL_PROJECT]);
  });

  it('never influences the calculated estimate, whatever it returns', async () => {
    const withoutHistory = await calculateWithHistory([]);
    const withHistory = await calculateWithHistory([SMALL_PROJECT, HUGE_PROJECT]);
    expect(withHistory.references).toHaveLength(2);
    expect(withHistory.result).toEqual(withoutHistory.result);
    expect(JSON.stringify(withHistory.result)).not.toContain('HIST_');
  });
});
