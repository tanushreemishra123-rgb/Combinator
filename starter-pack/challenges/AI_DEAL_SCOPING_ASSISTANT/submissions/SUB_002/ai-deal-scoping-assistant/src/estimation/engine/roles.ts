/**
 * Rule CR_09: split a workstream's likely effort across roles. Each driver type contributes its
 * days multiplied by the configured role mix; the result is allocated in tenths of a day with the
 * largest-remainder method so the role days always add up exactly to the likely effort.
 */
import type { RoleAllocation, RoleId } from '../../domain';
import type { ConfigLookups, MixKey } from './lookups';
import { roundWhole, stabilise, sum } from './numbers';

const TENTHS_PER_DAY = 10;

/** Effort that needs staffing, per driver type (or 'overhead' for the percentage phases). */
export interface RoleDemand {
  key: MixKey;
  days: number;
}

export interface RoleAllocationResult {
  roles: RoleAllocation[];
  unmixedTypes: MixKey[];
}

function roleWeights(demands: readonly RoleDemand[], lookups: ConfigLookups): Map<RoleId, number> {
  const weights = new Map<RoleId, number>();
  for (const demand of demands) {
    for (const share of lookups.roleShares(demand.key)) {
      weights.set(share.roleId, (weights.get(share.roleId) ?? 0) + demand.days * share.weight);
    }
  }
  return weights;
}

function orderRoles(roleIds: readonly RoleId[], roleOrder: readonly RoleId[]): RoleId[] {
  const listed = roleOrder.filter((roleId) => roleIds.includes(roleId));
  return [...listed, ...roleIds.filter((roleId) => !listed.includes(roleId))];
}

/** Largest-remainder apportionment of `units` across `weights` (ties go to the earlier entry). */
export function apportion(units: number, weights: readonly number[]): number[] {
  const totalWeight = sum(weights);
  if (totalWeight <= 0 || units <= 0) {
    return weights.map(() => 0);
  }
  const exact = weights.map((weight) => stabilise((units * weight) / totalWeight));
  const floors = exact.map((value) => Math.floor(value));
  const leftover = units - sum(floors);
  const winners = new Set(
    exact
      .map((value, index) => ({ index, fraction: value - (floors.at(index) ?? 0) }))
      .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
      .slice(0, leftover)
      .map((entry) => entry.index),
  );
  return floors.map((floor, index) => floor + (winners.has(index) ? 1 : 0));
}

function toAllocation(roleId: RoleId, tenths: number, lookups: ConfigLookups): RoleAllocation {
  const rate = lookups.rate(roleId);
  const days = tenths / TENTHS_PER_DAY;
  return {
    roleId,
    label: rate.label,
    days,
    dayRate: rate.dayRate,
    cost: rate.dayRate === null ? null : roundWhole(days * rate.dayRate),
  };
}

export function allocateRoles(
  likelyDays: number,
  demands: readonly RoleDemand[],
  lookups: ConfigLookups,
): RoleAllocationResult {
  const staffed = demands.filter((demand) => demand.days > 0);
  const unmixedTypes = staffed.filter((demand) => lookups.roleShares(demand.key).length === 0).map((d) => d.key);
  const weights = roleWeights(staffed, lookups);
  const roleIds = orderRoles([...weights.keys()], lookups.roleOrder);
  const tenths = apportion(
    roundWhole(likelyDays * TENTHS_PER_DAY),
    roleIds.map((roleId) => weights.get(roleId) ?? 0),
  );
  const roles = roleIds
    .map((roleId, index) => toAllocation(roleId, tenths.at(index) ?? 0, lookups))
    .filter((role) => role.days > 0);
  return { roles, unmixedTypes };
}
