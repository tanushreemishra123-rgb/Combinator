/** Unit tests for the seed-scenario category display labels shown on the welcome screen. */
import type { ScenarioCategory } from '../seed';
import { scenarioCategoryLabel } from './scenarioLabels';

describe('scenarioCategoryLabel', () => {
  it('labels every known scenario category in the spec seed-content categories', () => {
    expect(scenarioCategoryLabel('application-modernization')).toBe('Application modernization');
    expect(scenarioCategoryLabel('data-integration')).toBe('Data & integration');
    expect(scenarioCategoryLabel('ai-enabled')).toBe('AI-enabled solution');
    expect(scenarioCategoryLabel('missing-information')).toBe('Missing information');
  });

  it('falls back to the raw category value for one it does not recognise', () => {
    const unknownCategory = 'future-category' as ScenarioCategory;
    expect(scenarioCategoryLabel(unknownCategory)).toBe('future-category');
  });
});
