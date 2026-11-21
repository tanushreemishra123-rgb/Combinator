/**
 * Safe filesystem layer — the enforcement point for the challenge's source
 * protection rules:
 *
 *  - Source submissions/reviews/scorecards/schemas/verification are READ-ONLY.
 *  - All code writes are restricted to <workspace>/combined-solution/ (code mode)
 *    or <workspace>/synthesized-concept/ (ideation) plus the workspace metadata
 *    files the tool itself owns.
 *  - Path traversal ("../") and symlink escapes are rejected.
 *  - Every modifying operation is audited.
 *
 * Reads of source are allowed from anywhere under the (resolved) starter-pack
 * root; writes are allowed only under explicitly registered writable roots.
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
  statSync,
  realpathSync,
  readdirSync,
  rmSync,
  existsSync,
} from "node:fs";
import { resolve, dirname, relative, join, isAbsolute, sep } from "node:path";
import type { Logger } from "./logger.js";

export class SourceProtectionError extends Error {}

function isInside(child: string, parent: string): boolean {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

export class SafeFs {
  /** Roots that may be read (the starter pack + the workspace). */
  private readonly readRoots: string[];
  /** Roots that may be written (workspace writable subtrees only). */
  private writeRoots: string[] = [];
  private readonly log: Logger;

  constructor(opts: { readRoots: string[]; log: Logger }) {
    this.readRoots = opts.readRoots.map((r) => resolve(r));
    this.log = opts.log;
  }

  /** Register an additional subtree as writable (e.g. combined-solution/). */
  allowWrite(root: string): void {
    const r = resolve(root);
    mkdirSync(r, { recursive: true });
    this.writeRoots.push(r);
    // A writable root is implicitly readable.
    this.readRoots.push(r);
  }

  /** Register an additional subtree as readable (e.g. a disposable extraction dir). */
  allowRead(root: string): void {
    this.readRoots.push(resolve(root));
  }

  private resolveForRead(p: string): string {
    const abs = resolve(p);
    const real = existsSync(abs) ? realpathSync(abs) : abs;
    if (!this.readRoots.some((root) => isInside(real, root))) {
      throw new SourceProtectionError(`Read outside permitted roots: ${p}`);
    }
    return abs;
  }

  private resolveForWrite(p: string): string {
    const abs = resolve(p);
    // Resolve the nearest existing ancestor's realpath to catch symlink escapes
    // without requiring the leaf to exist yet.
    let probe = abs;
    while (!existsSync(probe) && probe !== dirname(probe)) probe = dirname(probe);
    const realAncestor = realpathSync(probe);
    const tail = relative(probe, abs);
    if (tail.split(sep).includes("..")) {
      throw new SourceProtectionError(`Path traversal rejected: ${p}`);
    }
    const realTarget = join(realAncestor, tail);
    if (!this.writeRoots.some((root) => isInside(realTarget, root))) {
      throw new SourceProtectionError(
        `Write denied — only workspace writable roots are writable. Target: ${p}`,
      );
    }
    return realTarget;
  }

  // ── Reads (source is read-only; these never mutate) ────────────────────────

  readText(p: string): string {
    return readFileSync(this.resolveForRead(p), "utf8");
  }
  readBuffer(p: string): Buffer {
    return readFileSync(this.resolveForRead(p));
  }
  stat(p: string) {
    return statSync(this.resolveForRead(p));
  }
  list(p: string): string[] {
    return readdirSync(this.resolveForRead(p));
  }
  exists(p: string): boolean {
    try {
      this.resolveForRead(p);
      return existsSync(resolve(p));
    } catch {
      return existsSync(resolve(p));
    }
  }

  /** Recursively walk a source tree, skipping node_modules/.git by default. */
  walk(root: string, opts: { skip?: string[] } = {}): string[] {
    const skip = new Set(opts.skip ?? ["node_modules", ".git", "dist", ".next", "build", "__pycache__"]);
    const out: string[] = [];
    const start = this.resolveForRead(root);
    const stack = [start];
    while (stack.length) {
      const dir = stack.pop()!;
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        continue;
      }
      for (const name of entries) {
        if (skip.has(name) || name === ".DS_Store") continue;
        const full = join(dir, name);
        let st;
        try {
          st = statSync(full);
        } catch {
          continue;
        }
        if (st.isDirectory()) stack.push(full);
        else if (st.isFile()) out.push(full);
      }
    }
    return out.sort();
  }

  // ── Writes (confined + audited) ────────────────────────────────────────────

  writeText(p: string, content: string): void {
    const target = this.resolveForWrite(p);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
    this.log.recordAudit({ op: "write", target: p, detail: `${content.length} bytes` });
  }
  writeJson(p: string, obj: unknown): void {
    this.writeText(p, JSON.stringify(obj, null, 2) + "\n");
  }
  mkdirp(p: string): void {
    const target = this.resolveForWrite(p);
    mkdirSync(target, { recursive: true });
    this.log.recordAudit({ op: "mkdir", target: p });
  }
  /** Copy a source file into a writable root (disposable analysis / transplant). */
  copyInto(srcPath: string, destPath: string): void {
    const src = this.resolveForRead(srcPath);
    const dest = this.resolveForWrite(destPath);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    this.log.recordAudit({ op: "copy", target: destPath, detail: `from ${srcPath}` });
  }
  removeInWritable(p: string): void {
    const target = this.resolveForWrite(p);
    rmSync(target, { recursive: true, force: true });
    this.log.recordAudit({ op: "delete", target: p });
  }
}
