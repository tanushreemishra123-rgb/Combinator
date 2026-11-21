/**
 * Source integrity: SHA-256 of every source artifact before and after
 * processing. Any mismatch on a source file is a critical failure (spec:
 * "Any source hash mismatch is a critical failure").
 */
import { createHash } from "node:crypto";
import type { SafeFs } from "./fs-safe.js";
import type { HashRecord, IntegrityReport } from "./types.js";
import { relative, resolve } from "node:path";

export function hashTree(fs: SafeFs, root: string): HashRecord[] {
  const base = resolve(root);
  return fs.walk(root).map((abs) => {
    const buf = fs.readBuffer(abs);
    return {
      path: relative(base, abs),
      sha256: createHash("sha256").update(buf).digest("hex"),
      bytes: buf.length,
    };
  });
}

export function diffHashes(
  challengeId: string,
  before: HashRecord[],
  after: HashRecord[],
): IntegrityReport {
  const beforeMap = new Map(before.map((h) => [h.path, h.sha256]));
  const mismatches: IntegrityReport["mismatches"] = [];
  for (const h of after) {
    const prev = beforeMap.get(h.path);
    if (prev !== undefined && prev !== h.sha256) {
      mismatches.push({ path: h.path, before: prev, after: h.sha256 });
    }
  }
  // A source file that disappeared after processing is also a mismatch.
  const afterSet = new Set(after.map((h) => h.path));
  for (const h of before) {
    if (!afterSet.has(h.path)) {
      mismatches.push({ path: h.path, before: h.sha256, after: "<missing>" });
    }
  }
  return { challengeId, before, after, mismatches, critical: mismatches.length > 0 };
}
