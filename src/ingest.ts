/**
 * Input ingestion + source protection (challenge §Input Ingestion).
 *
 * Validates the manifest, per-challenge packages, paths and submissions, then
 * exposes a typed, discovered view of a challenge. Nothing is hard-coded: the
 * manifest drives which challenges and submissions exist, their modes, and where
 * review context lives. Path traversal / escapes are rejected by SafeFs.
 */
import { resolve, join, relative } from "node:path";
import type { SafeFs } from "./fs-safe.js";
import type { ChallengeMode } from "./types.js";

export interface ManifestChallenge {
  challengeId: string;
  title: string;
  mode: ChallengeMode;
  path: string;
  reviewContextRef: string;
  submissionIds: string[];
}

export interface Manifest {
  schemaVersion: string;
  starterPackId: string;
  challengeCount: number;
  challenges: ManifestChallenge[];
}

export interface DiscoveredSubmission {
  submissionId: string;
  rootPath: string; // absolute
  /** For ideation: the actual document files. For code: the project roots. */
  files: string[]; // absolute, excluding node_modules
}

export interface DiscoveredChallenge {
  challengeId: string;
  title: string;
  mode: ChallengeMode;
  packageRoot: string; // absolute
  challengeContextPath: string | null;
  reviewContextPath: string | null; // absolute, resolved from ref (may be absent)
  submissions: DiscoveredSubmission[];
  reviewsDir: string | null;
  verificationConfigPath: string | null;
  integrityPath: string | null;
}

export class IngestError extends Error {}

function parseJson<T>(fs: SafeFs, path: string): T {
  try {
    return JSON.parse(fs.readText(path)) as T;
  } catch (e) {
    throw new IngestError(`Invalid or unreadable JSON: ${path} (${(e as Error).message})`);
  }
}

export function loadManifest(fs: SafeFs, packRoot: string): Manifest {
  const manifestPath = join(packRoot, "manifest.json");
  if (!fs.exists(manifestPath)) throw new IngestError(`manifest.json not found at ${packRoot}`);
  const m = parseJson<Manifest>(fs, manifestPath);
  if (!Array.isArray(m.challenges) || m.challenges.length === 0) {
    throw new IngestError("manifest.challenges is empty or missing");
  }
  for (const c of m.challenges) {
    if (!c.challengeId || !c.path || !c.mode) {
      throw new IngestError(`manifest challenge entry incomplete: ${JSON.stringify(c)}`);
    }
    if (c.mode !== "code" && c.mode !== "ideation") {
      throw new IngestError(`unknown mode "${c.mode}" for ${c.challengeId}`);
    }
  }
  return m;
}

/** Resolve reviewContextRef (relative to the challenge package) to an absolute path. */
function resolveReviewContext(packageRoot: string, ref: string, fs: SafeFs): string | null {
  if (!ref) return null;
  const abs = resolve(packageRoot, ref);
  return fs.exists(abs) ? abs : null;
}

export function discoverChallenge(
  fs: SafeFs,
  packRoot: string,
  mc: ManifestChallenge,
): DiscoveredChallenge {
  const packageRoot = resolve(packRoot, mc.path);
  if (!fs.exists(packageRoot)) throw new IngestError(`challenge path missing: ${mc.path}`);

  // challenge-package.json is the authority for sub-paths; fall back to defaults.
  const pkgPath = join(packageRoot, "challenge-package.json");
  const pkg = fs.exists(pkgPath)
    ? parseJson<{ paths?: Record<string, string> }>(fs, pkgPath)
    : { paths: {} };
  const paths = pkg.paths ?? {};
  const submissionsDir = resolve(packageRoot, paths.submissions ?? "submissions");
  const reviewsDir = resolve(packageRoot, paths.reviews ?? "reviews");
  const verificationDir = resolve(packageRoot, paths.verification ?? "verification");
  const integrityDir = resolve(packageRoot, paths.integrity ?? "integrity");

  const submissions: DiscoveredSubmission[] = [];
  for (const sid of mc.submissionIds) {
    const subRoot = join(submissionsDir, sid);
    if (!fs.exists(subRoot)) {
      // Record an empty submission rather than crash — the pack may ship without
      // files inserted yet (README: "add untouched ZIPs/docs").
      submissions.push({ submissionId: sid, rootPath: subRoot, files: [] });
      continue;
    }
    submissions.push({
      submissionId: sid,
      rootPath: subRoot,
      files: fs.walk(subRoot),
    });
  }

  const ccPath = join(packageRoot, "challenge-context.json");
  const verCfg = join(verificationDir, "verification-config.json");
  const integ = join(integrityDir, "source-hashes.json");

  return {
    challengeId: mc.challengeId,
    title: mc.title,
    mode: mc.mode,
    packageRoot,
    challengeContextPath: fs.exists(ccPath) ? ccPath : null,
    reviewContextPath: resolveReviewContext(packageRoot, mc.reviewContextRef, fs),
    submissions,
    reviewsDir: fs.exists(reviewsDir) ? reviewsDir : null,
    verificationConfigPath: fs.exists(verCfg) ? verCfg : null,
    integrityPath: fs.exists(integ) ? integ : null,
  };
}

/** Relative-to-package path for evidence/source-location records. */
export function pkgRelative(packageRoot: string, abs: string): string {
  return relative(packageRoot, abs);
}
