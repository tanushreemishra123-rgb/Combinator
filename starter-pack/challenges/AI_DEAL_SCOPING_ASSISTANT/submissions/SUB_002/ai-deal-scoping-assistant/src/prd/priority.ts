/** Shared High > Medium > Low ordering used when rolling requirement priorities up to capabilities and journeys. */
import type { Priority } from '../domain';

const PRIORITY_RANK: ReadonlyMap<Priority, number> = new Map([
  ['High', 3],
  ['Medium', 2],
  ['Low', 1],
]);

export function priorityRank(priority: Priority): number {
  return PRIORITY_RANK.get(priority) ?? 0;
}

/** Returns whichever of the two priorities ranks higher (ties keep `a`). */
export function higherPriority(a: Priority, b: Priority): Priority {
  return priorityRank(a) >= priorityRank(b) ? a : b;
}
