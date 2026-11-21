/** Rule CR_01 (driver effort) and the workstream complexity roll-up of rule CR_02. */
import type { Complexity, DriverSuggestion, DriverType, EstimateDriver } from '../../domain';
import { complexityFromLevel, complexityLevel } from '../complexity';
import { formatWhole } from '../format';
import type { EngineContext } from './model';
import { sum } from './numbers';

const DRIVER_TYPE_LABELS: ReadonlyMap<DriverType, string> = new Map<DriverType, string>([
  ['capability', 'capability'],
  ['integration', 'integration'],
  ['data', 'data'],
  ['ai', 'AI use case'],
  ['security', 'security control'],
  ['infrastructure', 'infrastructure'],
  ['nonFunctional', 'non-functional hardening'],
]);

export function driverTypeLabel(type: DriverType): string {
  return DRIVER_TYPE_LABELS.get(type) ?? type;
}

export interface ResolvedDriver {
  driver: EstimateDriver;
  /** True when the base-effort table has no value for this driver type and complexity. */
  blocked: boolean;
  suggestedComplexity: Complexity;
}

/** Complexity = reviewer override ?? AI suggestion; unit days come only from the base-effort table. */
export function resolveDriver(suggestion: DriverSuggestion, context: EngineContext): ResolvedDriver {
  const override = context.overrides.get(suggestion.id);
  const complexity = override ?? suggestion.complexity;
  const unitDays = context.lookups.unitDays(suggestion.type, complexity);
  return {
    driver: {
      ...suggestion,
      refIds: [...suggestion.refIds],
      complexity,
      complexitySource: override === undefined ? 'ai-suggested' : 'user-set',
      unitDays: unitDays ?? 0,
    },
    blocked: unitDays === null,
    suggestedComplexity: suggestion.complexity,
  };
}

/** One reproducible trace line per driver, e.g. 'DRV_03 Salesforce CRM sync: High integration = 22 days'. */
export function describeDriver(resolved: ResolvedDriver): string {
  const { driver } = resolved;
  const head = `${driver.id} ${driver.label}: ${driver.complexity} ${driverTypeLabel(driver.type)}`;
  const source =
    driver.complexitySource === 'user-set'
      ? ` (complexity set by the reviewer; the AI suggested ${resolved.suggestedComplexity})`
      : '';
  if (resolved.blocked) {
    return `${head} has no base effort configured - it contributes no days until the base-effort table is completed${source}`;
  }
  return `${head} = ${formatWhole(driver.unitDays)} days${source}`;
}

/** Weighted average of complexity levels (Low 1 ... Very High 4), rounded to the nearest level. */
export function weightedComplexity(entries: readonly { complexity: Complexity; weight: number }[]): Complexity {
  if (entries.length === 0) {
    return 'Low';
  }
  const totalWeight = sum(entries.map((entry) => entry.weight));
  if (totalWeight <= 0) {
    return complexityFromLevel(sum(entries.map((entry) => complexityLevel(entry.complexity))) / entries.length);
  }
  const weighted = sum(entries.map((entry) => complexityLevel(entry.complexity) * entry.weight));
  return complexityFromLevel(weighted / totalWeight);
}
