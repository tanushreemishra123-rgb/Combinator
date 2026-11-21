/** Ordinal handling of the four complexity levels (Low = 1 ... Very High = 4). */
import type { Complexity } from '../domain';

export const COMPLEXITY_LEVELS: readonly Complexity[] = ['Low', 'Medium', 'High', 'Very High'];

const LEVEL_BY_COMPLEXITY: ReadonlyMap<Complexity, number> = new Map(
  COMPLEXITY_LEVELS.map((complexity, index) => [complexity, index + 1]),
);

export function complexityLevel(complexity: Complexity): number {
  return LEVEL_BY_COMPLEXITY.get(complexity) ?? 1;
}

/** Clamps any numeric level into the Low..Very High scale. */
export function complexityFromLevel(level: number): Complexity {
  const clamped = Math.min(COMPLEXITY_LEVELS.length, Math.max(1, Math.round(level)));
  return COMPLEXITY_LEVELS.at(clamped - 1) ?? 'Low';
}

export function raiseComplexity(complexity: Complexity, steps: number): Complexity {
  return complexityFromLevel(complexityLevel(complexity) + steps);
}

export function atLeast(complexity: Complexity, floor: Complexity): Complexity {
  return complexityLevel(complexity) >= complexityLevel(floor) ? complexity : floor;
}
