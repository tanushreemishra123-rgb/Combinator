/**
 * Turns a constant table into a Map.
 *
 * The object literal keeps its exhaustiveness check against the union it is typed with,
 * while callers read it with `.get()`, so no lookup is a dynamic property access.
 */
export function lookupTable<K extends string, V>(entries: Record<K, V>): ReadonlyMap<string, V> {
  return new Map(Object.entries(entries))
}
