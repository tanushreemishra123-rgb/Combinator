/** Display label for each seed scenario category (spec "Seed Content" - one scenario per category). */
import type { ScenarioCategory } from '../seed';

const CATEGORY_LABELS: ReadonlyMap<ScenarioCategory, string> = new Map([
  ['application-modernization', 'Application modernization'],
  ['data-integration', 'Data & integration'],
  ['ai-enabled', 'AI-enabled solution'],
  ['missing-information', 'Missing information'],
]);

export function scenarioCategoryLabel(category: ScenarioCategory): string {
  return CATEGORY_LABELS.get(category) ?? category;
}
