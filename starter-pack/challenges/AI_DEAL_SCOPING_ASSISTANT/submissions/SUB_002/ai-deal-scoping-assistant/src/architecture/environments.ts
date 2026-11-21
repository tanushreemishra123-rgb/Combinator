/**
 * Development/test/production environment plan, sized from SolutionConfig.environments. When the
 * user has not provided a count, a documented default is used and every environment's sizing note
 * says so explicitly, so the assumption is visible rather than silently baked in.
 */
import type { EnvironmentPlan, ScopeItem, ScopeModel, SolutionConfig } from '../domain';
import { formatList, itemsOfKind } from './scopeQueries';

/** Used only when the user has not configured an environment count. */
export const DEFAULT_ENVIRONMENT_COUNT = 3;

const ENVIRONMENT_PURPOSES: ReadonlyMap<string, string> = new Map([
  ['Development', 'Feature development and integration testing for engineers before promotion.'],
  ['Test/QA', 'Functional, regression and non-functional test execution prior to release.'],
  ['Staging', 'Production-like rehearsal environment for release validation and performance testing.'],
  ['Production', 'Live environment serving end users under production SLAs.'],
]);

/** Named environments for a small (1-4) requested count; Production is always present and last. */
const SMALL_ENVIRONMENT_SETS: ReadonlyMap<number, readonly string[]> = new Map([
  [1, ['Production']],
  [2, ['Development', 'Production']],
  [3, ['Development', 'Test/QA', 'Production']],
  [4, ['Development', 'Test/QA', 'Staging', 'Production']],
]);

function selectEnvironmentNames(count: number): string[] {
  const smallSet = SMALL_ENVIRONMENT_SETS.get(count);
  if (smallSet !== undefined) {
    return [...smallSet];
  }
  const extraCount = count - SMALL_ENVIRONMENT_SETS.size;
  const extraNames = Array.from({ length: extraCount }, (_unused, index) => `Additional Non-Production ${index + 1}`);
  const nonProdNames = ['Development', 'Test/QA', 'Staging'];
  return [...nonProdNames, ...extraNames, 'Production'];
}

/** A number below this reads as a rate, percentage or duration (e.g. '2% variance', '4-second
 *  response') rather than a real load volume worth sizing production for. */
const MIN_VOLUME_FIGURE = 100;

/** Matches a plain integer with optional thousands separators, e.g. '85,000' or '900'. */
const LEADING_NUMBER = /\d{1,3}(?:,\d{3})*/;

function leadingFigure(text: string): number | null {
  const match = LEADING_NUMBER.exec(text);
  if (match === null) {
    return null;
  }
  const digits = match.at(0) ?? '';
  return Number(digits.split(',').join(''));
}

/**
 * NFR/data items whose title states a distinct load figure (e.g. monthly conversations or
 * documents) worth sizing production for, separate from config.expectedUsers - so production
 * sizing does not silently ignore a volume the reviewed scope itself states elsewhere.
 */
function statedVolumeItems(scope: ScopeModel, expectedUsers: number | null): ScopeItem[] {
  const candidates = [...itemsOfKind(scope, 'nonFunctional'), ...itemsOfKind(scope, 'data')];
  return candidates.filter((item) => {
    const figure = leadingFigure(item.title);
    return figure !== null && figure >= MIN_VOLUME_FIGURE && figure !== expectedUsers;
  });
}

function volumeClause(volumes: readonly ScopeItem[]): string {
  if (volumes.length === 0) {
    return '';
  }
  const parts = volumes.map((item) => `${item.title} (${item.id})`);
  return `, plus the stated ${formatList(parts)}`;
}

function environmentSizing(name: string, config: SolutionConfig, isAssumption: boolean, volumes: readonly ScopeItem[]): string {
  const assumptionNote = isAssumption ? ' Environment count is not configured, so this is an assumption pending confirmation.' : '';
  if (name === 'Production') {
    const users = config.expectedUsers === null ? 'the expected user volume once confirmed' : `${config.expectedUsers.toLocaleString('en-US')} expected users`;
    return `Sized for ${users}${volumeClause(volumes)}, with autoscaling enabled.${assumptionNote}`;
  }
  return `Matches the production topology at reduced instance/node counts.${assumptionNote}`;
}

/** Builds the dev/test/prod environment plan from config.environments, defaulting when unset, and
 *  sizes Production from every stated volume - expected users plus any distinct NFR/data figure. */
export function buildEnvironments(config: SolutionConfig, scope: ScopeModel): EnvironmentPlan[] {
  const isAssumption = config.environments === null;
  const count = Math.max(1, config.environments ?? DEFAULT_ENVIRONMENT_COUNT);
  const volumes = statedVolumeItems(scope, config.expectedUsers);
  return selectEnvironmentNames(count).map((name) => ({
    name,
    purpose: ENVIRONMENT_PURPOSES.get(name) ?? 'Supports an additional stage of the delivery lifecycle for this solution.',
    sizing: environmentSizing(name, config, isAssumption, volumes),
  }));
}
