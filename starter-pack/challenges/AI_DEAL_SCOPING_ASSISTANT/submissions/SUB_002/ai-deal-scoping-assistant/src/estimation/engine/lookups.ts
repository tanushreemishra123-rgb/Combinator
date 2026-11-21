/**
 * Map-based views over EstimationConfig. Every number the engine uses is read through these
 * lookups; a missing or invalid value is reported as "not configured" and never replaced by a default.
 */
import type {
  Complexity,
  Confidence,
  ConfidenceSpread,
  DriverType,
  EstimationConfig,
  RoleId,
  RoleRate,
} from '../../domain';
import { sum } from './numbers';

export type MixKey = DriverType | 'overhead';

/** A role's share of one driver type, normalised so the shares of a row add up to 1. */
export interface RoleShare {
  roleId: RoleId;
  weight: number;
}

export interface ConfigLookups {
  /** Person-days for one driver, or null when the base-effort table has no usable value. */
  unitDays(type: DriverType, complexity: Complexity): number | null;
  /** Normalised role mix; empty when no usable row is configured for the key. */
  roleShares(key: MixKey): readonly RoleShare[];
  /** Rate row for the role; dayRate is null when no valid rate is configured. */
  rate(roleId: RoleId): RoleRate;
  spread(confidence: Confidence): ConfidenceSpread;
  /** Display and tie-break order of roles: the order of the rate table. */
  roleOrder: readonly RoleId[];
}

function effortKey(type: DriverType, complexity: Complexity): string {
  return `${type}|${complexity}`;
}

function isUsableNumber(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0;
}

function buildUnitDays(config: EstimationConfig): ReadonlyMap<string, number> {
  const entries = config.baseEffort.flatMap((row) =>
    row.days
      .filter((cell) => isUsableNumber(cell.value))
      .map((cell): [string, number] => [effortKey(row.driverType, cell.complexity), cell.value]),
  );
  return new Map(entries);
}

function buildRoleShares(config: EstimationConfig): ReadonlyMap<MixKey, readonly RoleShare[]> {
  const entries = config.roleMix.map((row): [MixKey, readonly RoleShare[]] => {
    const usable = row.shares.filter((share) => Number.isFinite(share.pct) && share.pct > 0);
    const total = sum(usable.map((share) => share.pct));
    return [row.driverType, usable.map((share) => ({ roleId: share.roleId, weight: share.pct / total }))];
  });
  return new Map(entries);
}

function humaniseRoleId(roleId: RoleId): string {
  return roleId
    .split('-')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function buildRates(config: EstimationConfig): ReadonlyMap<RoleId, RoleRate> {
  return new Map(
    config.rates.map((rate) => [rate.roleId, { ...rate, dayRate: isUsableNumber(rate.dayRate) ? rate.dayRate : null }]),
  );
}

/** Widest configured spread: the honest fallback when a confidence level has no row of its own. */
function widestSpread(spreads: readonly ConfidenceSpread[], confidence: Confidence): ConfidenceSpread {
  const widest = spreads.reduce<ConfidenceSpread | null>(
    (best, spread) => (best === null || spread.lowPct + spread.highPct > best.lowPct + best.highPct ? spread : best),
    null,
  );
  return { confidence, lowPct: widest?.lowPct ?? 0, highPct: widest?.highPct ?? 0 };
}

export function createConfigLookups(config: EstimationConfig): ConfigLookups {
  const unitDays = buildUnitDays(config);
  const roleShares = buildRoleShares(config);
  const rates = buildRates(config);
  const spreads = new Map(config.confidenceSpreads.map((spread) => [spread.confidence, spread]));
  return {
    unitDays: (type, complexity) => unitDays.get(effortKey(type, complexity)) ?? null,
    roleShares: (key) => roleShares.get(key) ?? [],
    rate: (roleId) => rates.get(roleId) ?? { roleId, label: humaniseRoleId(roleId), dayRate: null },
    spread: (confidence) => spreads.get(confidence) ?? widestSpread(config.confidenceSpreads, confidence),
    roleOrder: config.rates.map((rate) => rate.roleId),
  };
}
