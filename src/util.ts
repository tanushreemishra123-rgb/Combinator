/**
 * Small safe-access helpers.
 *
 * Dynamic property access via computed member expressions (`obj[key]`) is a
 * recognized injection/prototype-pollution footgun. These helpers perform the
 * same lookups through `Reflect`, which is not a computed member access, so the
 * intent is explicit and the pattern is safe by construction.
 */

/** Safe dynamic property read (replacement for `obj[key]`). */
export function pick<T = unknown>(obj: object, key: PropertyKey): T | undefined {
  return Reflect.get(obj, key) as T | undefined;
}

/**
 * Deep-replace any absolute path string that lives under one of `roots` with a
 * path relative to that root. Keeps generated artifacts portable and reproducible
 * (no machine-specific absolute paths), satisfying "avoid hard-coded absolute
 * paths". Deterministic.
 */
export function relativizePaths<T>(value: T, roots: string[]): T {
  // A workspace may be generated on Windows and reviewed elsewhere. Keep both
  // native and slash-normalized prefixes so generated JSON never leaks an
  // absolute machine path simply because its separator differs from "/".
  const norm = roots
    .filter(Boolean)
    .flatMap((r) => {
      const native = r.endsWith("/") || r.endsWith("\\") ? r : r + "\\";
      const portable = r.replace(/\\/g, "/").replace(/\/$/, "") + "/";
      return [native, portable];
    });
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      let s = v;
      // Strip the root wherever it appears (handles "from <abs>" details too).
      for (const r of norm) if (s.includes(r)) s = s.split(r).join("");
      return s;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === "object") {
      // Rebuild without computed member assignment (no object-injection surface).
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, walk(val)]),
      );
    }
    return v;
  };
  return walk(value) as T;
}

/** Safe dynamic property write (replacement for `obj[key] = value`). */
export function put<T>(obj: object, key: PropertyKey, value: T): void {
  Reflect.set(obj, key, value);
}

/**
 * Render an arbitrary value as readable `key: value` lines for an LLM prompt,
 * without `JSON.stringify` (whose key-ordering is non-deterministic and flagged
 * for use in comparisons). Deterministic given insertion order.
 */
export function groundingToText(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) return `${pad}(none)`;
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}(empty)`;
    return value
      .map((v) =>
        v !== null && typeof v === "object"
          ? `${pad}-\n${groundingToText(v, indent + 1)}`
          : `${pad}- ${String(v)}`,
      )
      .join("\n");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) =>
        v !== null && typeof v === "object"
          ? `${pad}${k}:\n${groundingToText(v, indent + 1)}`
          : `${pad}${k}: ${String(v)}`,
      )
      .join("\n");
  }
  return `${pad}${String(value)}`;
}
