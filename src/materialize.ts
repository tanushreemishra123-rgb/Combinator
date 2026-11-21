/**
 * Submission materialization (challenge §Input Ingestion + Copilot clarification:
 * "the submission ZIPs should remain unchanged and the Combinator should extract
 * them into isolated, disposable working directories for analysis, build, and
 * testing").
 *
 * - If a submission is delivered as a folder, it is used in place, read-only.
 * - If a submission is delivered as a ZIP (submissions/<SID>.zip, or a single
 *   .zip inside submissions/<SID>/), it is extracted into a fresh, disposable
 *   temp directory with zip-slip protection; the original ZIP is never modified.
 *
 * The caller cleans up disposable dirs after the run.
 */
import AdmZip from "adm-zip";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readdirSync,
  statSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, relative, isAbsolute } from "node:path";

export interface Materialized {
  /** Where the submission's files actually live (folder or extracted temp dir). */
  rootPath: string;
  /** Original source path (folder or .zip) — immutable; used for provenance. */
  originalPath: string;
  /** True when extracted from a ZIP into a disposable dir. */
  extracted: boolean;
}

const disposableDirs: string[] = [];

function findZip(submissionsDir: string, sid: string): string | null {
  const folder = join(submissionsDir, sid);
  const siblingZip = join(submissionsDir, `${sid}.zip`);
  if (existsSync(siblingZip) && statSync(siblingZip).isFile()) return siblingZip;
  if (existsSync(folder) && statSync(folder).isDirectory()) {
    const entries = readdirSync(folder).filter((f) => f !== ".DS_Store");
    const zips = entries.filter((f) => f.toLowerCase().endsWith(".zip"));
    const nonZips = entries.filter((f) => !f.toLowerCase().endsWith(".zip"));
    // Treat as a zipped submission only when the folder holds exactly one zip and
    // nothing else of substance (so folder-based packs are used as-is).
    if (zips.length === 1 && nonZips.length === 0) return join(folder, zips[0]!);
  }
  return null;
}

export function materializeSubmission(submissionsDir: string, sid: string): Materialized {
  const folder = join(submissionsDir, sid);
  const zipPath = findZip(submissionsDir, sid);
  if (!zipPath) {
    return { rootPath: folder, originalPath: folder, extracted: false };
  }

  const dest = mkdtempSync(join(tmpdir(), `combinator-${sid}-`));
  disposableDirs.push(dest);
  const zip = new AdmZip(zipPath);
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.replace(/\\/g, "/");
    const target = resolve(dest, name);
    const rel = relative(dest, target);
    // zip-slip guard: skip any entry that would escape the disposable dir.
    if (rel.startsWith("..") || isAbsolute(rel)) continue;
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.getData());
  }
  return { rootPath: dest, originalPath: zipPath, extracted: true };
}

function extractZipTo(zipPath: string, dest: string): void {
  const zip = new AdmZip(zipPath);
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.replace(/\\/g, "/");
    const target = resolve(dest, name);
    const rel = relative(dest, target);
    if (rel.startsWith("..") || isAbsolute(rel)) continue; // zip-slip guard
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.getData());
  }
}

/** Find the directory containing manifest.json, searching a few levels down. */
function findManifestRoot(dir: string): string {
  const queue: Array<{ d: string; depth: number }> = [{ d: dir, depth: 0 }];
  while (queue.length) {
    const { d, depth } = queue.shift()!;
    if (existsSync(join(d, "manifest.json"))) return d;
    if (depth >= 3) continue;
    let entries: string[] = [];
    try {
      entries = readdirSync(d);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (name === "__MACOSX" || name.startsWith(".")) continue;
      const p = join(d, name);
      try {
        if (statSync(p).isDirectory()) queue.push({ d: p, depth: depth + 1 });
      } catch {
        /* skip */
      }
    }
  }
  return dir; // fall back to the given dir (manifest check happens later)
}

/**
 * Resolve a --pack argument that is EITHER an extracted starter-pack folder OR
 * the starter-pack .zip (Copilot: "reviewers can point the solution to either the
 * ZIP or its extracted root folder"). A .zip is extracted to a disposable dir.
 * Returns the directory that contains manifest.json.
 */
export function resolvePackRoot(packArg: string): string {
  const abs = resolve(packArg);
  if (abs.toLowerCase().endsWith(".zip") && existsSync(abs) && statSync(abs).isFile()) {
    const dest = mkdtempSync(join(tmpdir(), "combinator-pack-"));
    disposableDirs.push(dest);
    extractZipTo(abs, dest);
    return findManifestRoot(dest);
  }
  return findManifestRoot(abs);
}

/** Remove all disposable extraction directories created this process. */
export function cleanupDisposable(): void {
  for (const d of disposableDirs.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }
}
